import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { verifyToken, getTokenFromRequest } from './_shared.js';

export const config = { maxDuration: 60 };

const REPO = 'palivelajoel/4550-Website';
const ASSET_DIR = 'public/uploads';
const MEDIA_BUCKETS = ['team-assets', 'team-media'];
const MAX_FILE = 3 * 1024 * 1024;    // per file, binary (keeps base64 under Vercel body limit)
const MAX_TOTAL = 3 * 1024 * 1024;   // per batch, binary
const MAX_CLEANUP_OBJECTS = 300;
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
      message: `Upload media: ${files.map(f => f.fileName).join(', ')}`,
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

function objectInfoFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!/^https?:\/\//i.test(url)) return null;
  let path;
  try { path = new URL(url).pathname; } catch { return null; }
  for (const bucket of MEDIA_BUCKETS) {
    for (const needle of [`/storage/v1/object/public/${bucket}/`, `/object/public/${bucket}/`]) {
      const i = path.indexOf(needle);
      if (i !== -1) {
        let name = path.slice(i + needle.length);
        try { name = decodeURIComponent(name); } catch {}
        name = name.replace(/^\/+/, '');
        if (name) return { bucket, name };
      }
    }
  }
  return null;
}

const hashFileName = name => {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
  const ext = m ? m[1].toLowerCase() : 'bin';
  return ext;
};

async function cleanupUploads(res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const gitToken = process.env.GITHUB_TOKEN;
  const report = { mediaRows: 0, migrated: [], deleted: [], duplicateGroups: 0 };

  // ── A) Migrate existing media (hub_media + hub_resources) to GitHub ──
  const targets = [];
  const grab = async table => {
    try {
      const { data } = await supabase.from(table).select('id,url');
      for (const row of data || []) {
        const info = objectInfoFromUrl(row.url);
        if (info) targets.push({ table, id: row.id, ...info });
      }
    } catch {}
  };
  await grab('hub_media');
  await grab('hub_resources');
  report.mediaRows = targets.length;

  const migratedKeys = new Set();
  if (gitToken) {
    const gitFiles = [];
    const pending = [];
    for (const t of targets) {
      try {
        const { data: blob, error } = await supabase.storage.from(t.bucket).download(t.name);
        if (error || !blob) throw new Error('download failed');
        const buf = Buffer.from(await blob.arrayBuffer());
        const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
        const ext = hashFileName(t.name);
        const fileName = `${hash}.${ext}`;
        gitFiles.push({ fileName, base64: buf.toString('base64') });
        pending.push({ ...t, fileName });
      } catch (e) {
        report.migrated.push({ table: t.table, id: t.id, name: t.name, error: String((e && e.message) || e) });
      }
    }
    if (pending.length) {
      await commitFilesToRepo(gitToken, gitFiles);
      for (const p of pending) {
        const newUrl = `https://raw.githubusercontent.com/${REPO}/${ASSET_DIR}/${p.fileName}`;
        const { error: upErr } = await supabase.from(p.table).update({ url: newUrl }).eq('id', p.id);
        if (upErr) { report.migrated.push({ table: p.table, id: p.id, name: p.name, error: 'db update failed' }); continue; }
        migratedKeys.add(`${p.bucket}|${p.name}`);
        report.migrated.push({ table: p.table, id: p.id, fileName: p.fileName });
      }
    }
  } else {
    report.migrated.push({ error: 'GitHub storage not configured — set GITHUB_TOKEN in Vercel env' });
  }

  // ── B) Collect URLs still pointing at Supabase storage ──
  const refs = new Set();
  const addRef = v => { if (v && typeof v === 'string' && /^https?:\/\//i.test(v.trim())) refs.add(v.trim()); };
  const walk = v => {
    if (v == null) return;
    if (typeof v === 'string') {
      const t = v.trim();
      if (/^https?:\/\//i.test(t)) refs.add(t);
      if (t.startsWith('[') || t.startsWith('{')) { try { walk(JSON.parse(t)); } catch {} }
      return;
    }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') {
      for (const k of ['logo_url', 'url', 'image_url', 'photo_url', 'icon', 'src']) if (v[k]) addRef(v[k]);
      Object.values(v).forEach(walk);
    }
  };
  try {
    const { data: cfg } = await supabase.from('site_config').select('value');
    (cfg || []).forEach(r => walk(r.value));
  } catch {}
  for (const [tbl, cols] of [
    ['sponsors', ['logo_url']],
    ['captains', ['photo_url']],
    ['hub_media', ['url']],
    ['hub_resources', ['url']],
    ['articles', ['image_url']],
  ]) {
    try {
      const { data } = await supabase.from(tbl).select(cols.join(','));
      (data || []).forEach(r => cols.forEach(c => addRef(r[c])));
    } catch {}
  }

  // ── C) List objects, hash them, group duplicates ──
  const listed = [];
  for (const bucket of MEDIA_BUCKETS) {
    let page = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list('', { limit: 200, offset: page * 200 });
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.length === 0) break;
      listed.push(...data.map(o => ({ bucket, name: o.name })));
      if (data.length < 200) break;
      page++;
    }
  }
  if (listed.length > MAX_CLEANUP_OBJECTS) {
    return res.status(200).json({ data: { notice: `Storage has ${listed.length} objects (cap ${MAX_CLEANUP_OBJECTS}) — run again to continue.`, ...report, deleted: [] } });
  }

  const groups = new Map();
  for (const o of listed) {
    try {
      const { data: blob, error } = await supabase.storage.from(o.bucket).download(o.name);
      if (error || !blob) continue;
      const hash = crypto.createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex').slice(0, 16);
      if (!groups.has(hash)) groups.set(hash, []);
      groups.get(hash).push(`${o.bucket}|${o.name}`);
    } catch {}
  }

  const expand = k => { const i = k.indexOf('|'); return { bucket: k.slice(0, i), name: k.slice(i + 1) }; };
  const inRefs = (bucket, name) => {
    const encoded = encodeURIComponent(name);
    for (const r of refs) if (r.includes(`/public/${bucket}/`) && (r.endsWith(encoded) || r.endsWith(name))) return true;
    return false;
  };

  const toDelete = [];
  for (const [, keys] of groups) {
    if (keys.length === 1) {
      const k = keys[0];
      if (migratedKeys.has(k)) toDelete.push(expand(k));
      continue;
    }
    report.duplicateGroups++;
    const referenced = keys.filter(k => { const o = expand(k); return inRefs(o.bucket, o.name); });
    const migrated = keys.filter(k => migratedKeys.has(k));
    const rest = keys.filter(k => !referenced.includes(k) && !migrated.includes(k));
    migrated.forEach(k => toDelete.push(expand(k)));
    if (referenced.length) {
      rest.forEach(k => toDelete.push(expand(k)));
    } else {
      rest.sort((a, b) => {
        const aHash = /^[0-9a-f]{16}/.test(expand(a).name), bHash = /^[0-9a-f]{16}/.test(expand(b).name);
        if (aHash !== bHash) return aHash ? -1 : 1;
        return a.localeCompare(b);
      });
      rest.slice(1).forEach(k => toDelete.push(expand(k)));
    }
  }

  const deleted = [];
  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100);
    const byBucket = {};
    for (const o of chunk) (byBucket[o.bucket] = byBucket[o.bucket] || []).push(o.name);
    for (const b of Object.keys(byBucket)) {
      const { error } = await supabase.storage.from(b).remove(byBucket[b]);
      if (error) return res.status(500).json({ error: error.message });
    }
    deleted.push(...chunk.map(o => `${o.bucket} / ${o.name}`));
  }
  report.deleted = deleted;

  res.status(200).json({ data: report });
}

export default async function handler(req, res) {
  try {
    const token = getTokenFromRequest(req) || req.body?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: 'Admin/Captain authorization required' });

    const { action } = req.body || {};

    if (action === 'cleanup') {
      if (payload.role !== 'Admin') return res.status(403).json({ error: 'Admin role required for cleanup' });
      return await cleanupUploads(res);
    }

    if (action !== 'upload') return res.status(400).json({ error: 'Invalid action' });
    if (!['Captain', 'Admin'].includes(payload.role)) return res.status(403).json({ error: 'Captain or Admin role required' });

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
      if (!fileName || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|gif|webp|svg|avif|ico|pdf|zip|txt|csv|mp4|webm|mov)$/i.test(fileName)) {
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