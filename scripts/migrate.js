// scripts/migrate.js
// One-time data migration: Supabase (PostgREST) -> Cloudflare D1 (via the d1-gateway Worker).
// Mirrors the real Supabase schema into D1. Ids (UUIDs) are preserved as TEXT PKs.
// Read credentials from env (never hardcoded / never committed):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, D1_GATEWAY_URL, D1_GATEWAY_TOKEN
//
// Usage:  node scripts/migrate.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const D1_URL = (process.env.D1_GATEWAY_URL || '').replace(/\/+$/, '');
const D1_TOKEN = process.env.D1_GATEWAY_TOKEN;

if (!SUPABASE_URL || !SERVICE_KEY || !D1_URL || !D1_TOKEN) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, D1_GATEWAY_URL, D1_GATEWAY_TOKEN');
  process.exit(1);
}

// Columns stored as JSON (jsonb / text[]) in Supabase -> stringified for D1 TEXT.
const JSON_COLUMNS = new Set([
  'questions',     // hub_forms
  'answers',       // hub_form_submissions
  'tags',          // inventory_items
  'schematic_data',// competitions
]);

// All boolean columns in the schema -> stored as INTEGER 0/1.
const BOOL_TABLES = {
  hub_announcements: ['pinned'],
  hub_calendar: ['all_day'],
  articles: ['published'],
  competitions: ['attending'],
  scouting_matches: ['auto_climb', 'defense', 'defended', 'died'],
  scouting_pits: ['can_score_auto_climb', 'can_score_fuel_near', 'can_score_fuel_far'],
};

const TABLES = [
  'members', 'suggestions', 'sponsors', 'sponsor_notes', 'captains', 'site_config',
  'hub_tasks', 'hub_calendar', 'hub_announcements', 'hub_media', 'hub_resources',
  'hub_forms', 'hub_form_submissions', 'inventory_items', 'inventory_transactions',
  'articles', 'competitions', 'scouting_matches', 'scouting_pits', 'scouting_picklist',
];

// Normalize a value for D1 storage.
function normalize(table, key, value) {
  if (value === null || value === undefined) return null;
  if (BOOL_TABLES[table] && BOOL_TABLES[table].includes(key)) {
    if (value === true || value === 1 || value === 'true') return 1;
    if (value === false || value === 0 || value === 'false') return 0;
    return value;
  }
  if (JSON_COLUMNS.has(key) && typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return value;
}

async function d1(action, payload) {
  const res = await fetch(`${D1_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${D1_TOKEN}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`D1 ${action}: ${res.status} ${j.error || ''}`);
  return j;
}

async function fetchAll(table) {
  const rows = [];
  const page = 1000;
  let start = 0;
  for (let i = 0; i < 200; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${start}-${start + page - 1}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase GET ${table}: ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < page) break;
    start += page;
  }
  return rows;
}

(async () => {
  const summary = [];
  for (const table of TABLES) {
    let rows;
    try {
      rows = await fetchAll(table);
    } catch (e) {
      summary.push(`${table}: SKIP (${e.message})`);
      continue;
    }
    if (!rows.length) { summary.push(`${table}: 0 rows (skipped)`); continue; }

    const normalized = rows.map(r => {
      const out = {};
      for (const [k, v] of Object.entries(r)) out[k] = normalize(table, k, v);
      return out;
    });

    // InsertMany ignores existing ids? No - we want exact rows. D1 insertMany inserts as-is.
    // For site_config, upsert on key would be safer, but plain insertMany is fine (empty tables).
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < normalized.length; i += BATCH) {
      const chunk = normalized.slice(i, i + BATCH);
      await d1('insertMany', { table, rows: chunk });
      inserted += chunk.length;
    }
    summary.push(`${table}: ${inserted} rows`);
  }
  console.log('\n=== MIGRATION SUMMARY ===');
  summary.forEach(s => console.log(s));
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
