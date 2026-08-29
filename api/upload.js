import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { verifyToken, getTokenFromRequest } from './_shared.js';

export const config = { maxDuration: 60 };

const REPO = 'palivelajoel/4550-Website';
const ASSET_DIR = 'public/uploads';
const BUCKETS = ['team-assets', 'team-media', 'inventory-images'];
const MAX_FILE = 3 * 1024 * 1024;    // per file, binary (keeps base64 under Vercel body limit)
const MAX_TOTAL = 3 * 1024 * 1024;   // per batch, binary
const MAX_MIGRATE = 150;             // storage objects migrated per cleanup run
const CHUNK = 25;                    // files per GitHub commit
const GH = 'https://api.github.com';

const TABLES_SCAN = [
  'site_config', 'sponsors', 'captains', 'hub_media', 'hub_resources', 'articles',
  'hub_announcements', 'members', 'hub_tasks', 'inventory_items', 'suggestions',
  'hub_calendar', 'hub_forms', 'hub_form_submissions',
];

// Only objects referenced by these tables are migrated to GitHub (Media Gallery + Resources docs).
const MIGRATE_TABLES = ['hub_media', 'hub_resources'];

// Matches any Supabase storage public URL (legacy + current form), with trailing punctuation intact.
const STORAGE_URL_RE = /(https?:\/\/[^"'\\\s]+?\/(?:storage\/v1\/object\/public|object\/public)\/(?:team-assets|team-media|inventory-images)\/[^"'\\\s]+)/gi;

function normalizeUrl(u) {
  return u.replace(/[)\]'";,]+$/g, '');
}

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

function objectInfoFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!/^https?:\/\//i.test(url)) return null;
  let path;
  try { path = new URL(url).pathname; } catch { return null; }
  for (const bucket of BUCKETS) {
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

function fileExt(name) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || '');
  return m ? m[1].toLowerCase() : 'bin';
}

// Full-tables scan: every string cell in every row, find all storage URLs.
async function scanReferencedUrls(supabase, tables = TABLES_SCAN) {
  const refs = new Map();
  for (const table of tables) {
    let rows = null;
    try { ({ data: rows } = await supabase.from(table).select('*')); } catch { continue; }
    for (const row of rows || []) {
      for (const val of Object.values(row)) {
        if (typeof val !== 'string') continue;
        STORAGE_URL_RE.lastIndex = 0;
        let m;
        while ((m = STORAGE_URL_RE.exec(val))) {
          const u = normalizeUrl(m[1]);
          if (objectInfoFromUrl(u)) refs.set(u, true);
        }
      }
    }
  }
  return refs;
}

// Rewrite every cell that references a migrated object's old storage URL.
async function updateReferences(supabase, urlMap) {
  let updated = 0;
  for (const table of TABLES_SCAN) {
    let rows = null;
    try { ({ data: rows } = await supabase.from(table).select('*')); } catch { continue; }
    for (const row of rows || []) {
      if (!row.id) continue;
      const updates = {};
      for (const [col, val] of Object.entries(row)) {
        if (typeof val !== 'string' || col === 'id') continue;
        STORAGE_URL_RE.lastIndex = 0;
        let m;
        let out = '';
        let last = 0;
        let hit = false;
        while ((m = STORAGE_URL_RE.exec(val))) {
          const u = normalizeUrl(m[1]);
          const info = objectInfoFromUrl(u);
          if (!info) continue;
          const newUrl = urlMap.get(`${info.bucket}|${info.name}`);
          if (!newUrl) continue;
          hit = true;
          out += val.slice(last, m.index) + newUrl + m[1].slice(u.length);
          last = m.index + m[1].length;
        }
        if (hit) { out += val.slice(last); updates[col] = out; }
      }
      if (Object.keys(updates).length) {
        try { await supabase.from(table).update(updates).eq('id', row.id); updated++; } catch {}
      }
    }
  }
  return updated;
}

async function cleanupUploads(res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const gitToken = process.env.GITHUB_TOKEN;
  const report = { discovered: 0, kept: 0, migrated: [], failed: [], deleted: [], remaining: 0 };
  const urlMap = new Map();
  const failedKeys = new Set();

  // 1) Storage URLs referenced anywhere in the DB (the "never delete" keep-set) …
  const allRefs = await scanReferencedUrls(supabase);
  const allSeen = new Set();
  for (const u of allRefs.keys()) {
    const info = objectInfoFromUrl(u);
    allSeen.add(`${info.bucket}|${info.name}`);
  }
  // … and only the subset referenced by Media Gallery + Resources, which get migrated to GitHub.
  const migRefs = await scanReferencedUrls(supabase, MIGRATE_TABLES);
  const jobs = [];
  const seen = new Set();
  for (const u of migRefs.keys()) {
    const info = objectInfoFromUrl(u);
    const key = `${info.bucket}|${info.name}`;
    if (!seen.has(key)) { seen.add(key); jobs.push({ bucket: info.bucket, name: info.name }); }
  }
  report.discovered = jobs.length;
  // Objects referenced only by non-migrate tables (logo, banners, sponsor/captain
  // photos, landing images, inventory…) intentionally stay in Supabase.
  report.kept = Math.max(0, allSeen.size - seen.size);

  // ── 2) Migrate the referenced objects to GitHub (best effort, in batches) ──
  if (jobs.length === 0) {
    // nothing referenced — fall through to sweeping orphaned/duplicate objects
  } else if (!gitToken) {
    report.failed.push({ error: 'GitHub storage not configured — set GITHUB_TOKEN in Vercel env' });
  } else {
    const limit = Math.min(jobs.length, MAX_MIGRATE);
    for (let i = 0; i < limit; i += CHUNK) {
      const chunk = jobs.slice(i, i + CHUNK);
      const gitFiles = [];
      const pending = [];
      for (const job of chunk) {
        try {
          const { data: blob, error } = await supabase.storage.from(job.bucket).download(job.name);
          if (error || !blob) throw new Error((error && error.message) || 'download failed');
          const buf = Buffer.from(await blob.arrayBuffer());
          const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
          const fileName = `${hash}.${fileExt(job.name)}`;
          gitFiles.push({ fileName, base64: buf.toString('base64') });
          pending.push({ ...job, fileName });
        } catch (e) {
          failedKeys.add(`${job.bucket}|${job.name}`);
          report.failed.push({ bucket: job.bucket, name: job.name, error: String((e && e.message) || e) });
        }
      }
      if (pending.length) {
        await commitFilesToRepo(gitToken, gitFiles);
        for (const p of pending) {
          const newUrl = `https://raw.githubusercontent.com/${REPO}/${ASSET_DIR}/${p.fileName}`;
          urlMap.set(`${p.bucket}|${p.name}`, newUrl);
          report.migrated.push({ bucket: p.bucket, name: p.name, fileName: p.fileName });
        }
      }
    }
    // Rewrite every DB reference to point at the new GitHub URLs (single pass).
    await updateReferences(supabase, urlMap);
  }
  report.remaining = report.migrated.length > 0 ? jobs.length - report.migrated.length : jobs.length;

  // ── 3) Re-scan to see what is genuinely still referenced (failures/kept) ──
  const afterRefs = await scanReferencedUrls(supabase);
  const keepKeys = new Set();
  for (const u of afterRefs.keys()) {
    const info = objectInfoFromUrl(u);
    if (info) keepKeys.add(`${info.bucket}|${info.name}`);
  }
  for (const k of failedKeys) keepKeys.add(k);

  // ── 4) Delete everything no longer referenced (migrated, duplicates, orphans) ──
  const deletePlan = [];
  for (const bucket of BUCKETS) {
    let page = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list('', { limit: 200, offset: page * 200 });
      if (error || !data || data.length === 0) break;
      for (const o of data) {
        const key = `${bucket}|${o.name}`;
        if (!keepKeys.has(key)) deletePlan.push({ bucket, name: o.name });
      }
      if (data.length < 200) break;
      page++;
    }
  }
  const deleted = [];
  for (let i = 0; i < deletePlan.length; i += 100) {
    const chunk = deletePlan.slice(i, i + 100);
    const byBucket = {};
    for (const o of chunk) (byBucket[o.bucket] = byBucket[o.bucket] || []).push(o.name);
    for (const b of Object.keys(byBucket)) {
      const { error } = await supabase.storage.from(b).remove(byBucket[b]);
      if (error) return res.status(500).json({ error: error.message });
    }
    deleted.push(...chunk.map(o => `${o.bucket}/${o.name}`));
  }
  report.deleted = deleted;

  res.status(200).json({ data: report });
}

// Read-only snapshot: how many media/docs objects remain referenced in Supabase + bucket object counts.
async function storageStatus(res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  const migRefs = await scanReferencedUrls(supabase, MIGRATE_TABLES);
  const seen = new Set();
  for (const u of migRefs.keys()) {
    const info = objectInfoFromUrl(u);
    if (info) seen.add(`${info.bucket}|${info.name}`);
  }
  const allRefs = await scanReferencedUrls(supabase);
  const allSeen = new Set();
  for (const u of allRefs.keys()) {
    const info = objectInfoFromUrl(u);
    if (info) allSeen.add(`${info.bucket}|${info.name}`);
  }
  const bucketObjects = {};
  for (const bucket of BUCKETS) {
    let count = 0;
    let page = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list('', { limit: 200, offset: page * 200 });
      if (error || !data || data.length === 0) break;
      count += data.length;
      if (data.length < 200) break;
      page++;
    }
    bucketObjects[bucket] = count;
  }
  res.status(200).json({
    data: {
      discovered: seen.size,
      remaining: seen.size,
      kept: Math.max(0, allSeen.size - seen.size),
      bucketObjects,
    },
  });
}

export default async function handler(req, res) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
  try {
    const token = getTokenFromRequest(req) || req.body?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: 'Login required' });

    const { action } = req.body || {};

    if (action === 'cleanup') {
      if (payload.role !== 'Admin') return res.status(403).json({ error: 'Admin role required for cleanup' });
      return await cleanupUploads(res);
    }

    if (action === 'status') {
      if (payload.role !== 'Admin') return res.status(403).json({ error: 'Admin role required' });
      return await storageStatus(res);
    }

    if (action !== 'upload') return res.status(400).json({ error: 'Invalid action' });

    if (!['Captain', 'Admin'].includes(payload.role)) {
      if (payload.role === 'Member') {
        const { data: mem } = await supabase.from('members').select('subteam').eq('id', payload.userId).maybeSingle();
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
      if (!fileName || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|gif|webp|svg|avif|ico|pdf|zip|rar|7z|tar|gz|txt|csv|json|md|html|mp4|webm|mov|docx?|xlsx?|pptx?|odt|ods|step|stp|stl|iges|igs|dxf|dwg|f3d|f2d|sldprt|sldasm|ai|psd)$/i.test(fileName)) {
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