import { d1SelectOne } from './_gateway.js';
import { verifyToken, getTokenFromRequest } from './_shared.js';

export const config = { maxDuration: 60 };

const REPO = 'palivelajoel/4550-Website';
const ASSET_DIR = 'public/uploads';
const MAX_FILE = 3 * 1024 * 1024;    // per file, binary (keeps base64 under Vercel body limit)
const MAX_TOTAL = 3 * 1024 * 1024;   // per batch, binary
const CHUNK = 25;                    // files per GitHub commit
const GH = 'https://api.github.com';

async function gh(token, path, opts = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': '4550-website',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`GitHub ${opts.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

// Create a single commit containing every file (Git Data API, SHA-aware overwrites).
async function commitFilesToRepo(gitToken, files) {
  const ref = await gh(gitToken, `/repos/${REPO}/git/ref/heads/main`);
  const headSha = ref.object?.sha;

  const blobs = [];
  for (const f of files) {
    const blob = await gh(gitToken, `/repos/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: f.base64, encoding: 'base64' }),
    });
    blobs.push({ path: `${ASSET_DIR}/${f.fileName}`, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const headCommit = await gh(gitToken, `/repos/${REPO}/git/commits/${headSha}`);
  const tree = await gh(gitToken, `/repos/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: headCommit.tree?.sha, tree: blobs }),
  });

  const commit = await gh(gitToken, `/repos/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `Upload files: ${files.map(f => f.fileName).join(', ')}`,
      tree: tree.sha,
      parents: [headSha],
      author: { name: 'Cherry Creek Robotics', email: '4550@cherrycreekrobotics.org' },
      committer: { name: 'Cherry Creek Robotics', email: '4550@cherrycreekrobotics.org' },
    }),
  });

  await gh(gitToken, `/repos/${REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
}

export default async function handler(req, res) {
  try {
    const token = getTokenFromRequest(req) || req.body?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: 'Login required' });

    const { action } = req.body || {};

    if (action === 'cleanup' || action === 'status') {
      // Legacy storage-maintenance actions no longer apply — media lives in GitHub.
      if (payload.role !== 'Admin') return res.status(403).json({ error: 'Admin role required' });
      return res.status(200).json({ data: { notice: 'Media now lives in the GitHub repo; nothing to clean up.' } });
    }

    if (action !== 'upload') return res.status(400).json({ error: 'Invalid action' });

    if (!['Captain', 'Admin'].includes(payload.role)) {
      if (payload.role === 'Member') {
        const mem = await d1SelectOne('members', { filters: [{ col: 'id', op: 'eq', value: payload.userId }] });
        if (!mem || mem.subteam !== 'Build') return res.status(403).json({ error: 'Build team members only may upload images' });
        const onlyImages = /\.(png|jpe?g|gif|webp|avif)$/i;
        const anyNonImage = (req.body?.files || []).some(f => !onlyImages.test(String(f.fileName || '')));
        if (anyNonImage) return res.status(403).json({ error: 'Members may only upload images' });
      } else {
        return res.status(403).json({ error: 'Not authorized to upload' });
      }
    }

    const gitToken = process.env.GITHUB_TOKEN;
    if (!gitToken) return res.status(409).json({ error: 'GitHub storage not configured — set GITHUB_TOKEN in Vercel env' });

    const files = Array.isArray(req.body?.files) ? req.body.files.filter(Boolean) : [];
    if (!files.length) return res.status(400).json({ error: 'No files' });

    const okFiles = [];
    const errors = [];
    let total = 0;
    for (const f of files) {
      const fileName = String(f.fileName || '').replace(/[^a-zA-Z0-9._-]/g, '_');
      let bytes;
      try { bytes = Buffer.from(String(f.base64 || ''), 'base64'); } catch { bytes = Buffer.alloc(0); }
      if (!fileName || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|gif|webp|svg|avif|ico|pdf|zip|rar|7z|tar|gz|txt|csv|json|md|html|mp4|webm|mov|glb|gltf|docx?|xlsx?|pptx?|odt|ods|step|stp|stl|iges|igs|dxf|dwg|f3d|f2d|sldprt|sldasm|ai|psd)$/i.test(fileName)) {
        errors.push({ fileName, error: 'Unsupported file name/type' }); continue;
      }
      if (!bytes.length) { errors.push({ fileName, error: 'Empty file' }); continue; }
      if (bytes.length > MAX_FILE) { errors.push({ fileName, error: `File over ${Math.round(MAX_FILE / 1048576)}MB limit` }); continue; }
      total += bytes.length;
      if (total > MAX_TOTAL) { errors.push({ fileName, error: 'Batch over size limit' }); continue; }
      okFiles.push({ fileName, base64: f.base64 });
    }

    if (!okFiles.length) return res.status(200).json({ data: { files: [] }, errors });

    await commitFilesToRepo(gitToken, okFiles);

    return res.status(200).json({
      data: { files: okFiles.map(f => ({ fileName: f.fileName, url: `https://raw.githubusercontent.com/${REPO}/${ASSET_DIR}/${f.fileName}` })) },
      errors,
    });
  } catch (err) {
    return res.status(500).json({ error: String((err && err.message) || err) });
  }
}
