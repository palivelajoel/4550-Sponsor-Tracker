// api/_gateway.js
// Thin client for the Cloudflare D1 gateway Worker. All DB access in the
// serverless API goes through here instead of the Supabase client.
//
// The gateway worker exposes parameterized JSON CRUD over Cloudflare D1 and is
// authenticated with a Bearer token (D1_GATEWAY_TOKEN) at D1_GATEWAY_URL.

const BOOL_COLUMNS = new Set([
  // hub_announcements
  "pinned",
  // hub_calendar
  "all_day",
  // articles
  "published",
  // competitions
  "attending",
]);

// Columns that are stored as JSON TEXT (jsonb / text[]) and must be parsed on read.
const JSON_COLUMNS = {
  hub_forms: ["questions"],
  hub_form_submissions: ["answers"],
  inventory_items: ["tags"],
};

function tryParse(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t) return v;
  if ((t[0] === "[" && t[t.length - 1] === "]") || (t[0] === "{" && t[t.length - 1] === "}")) {
    try { return JSON.parse(t); } catch { return v; }
  }
  return v;
}

// Normalize a raw D1 row to the shape the frontend expects: booleans back to
// true/false and JSON-text columns parsed to objects/arrays.
export function coerceRow(table, row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (BOOL_COLUMNS.has(k) && (v === 1 || v === 0)) { out[k] = v === 1; continue; }
    if (JSON_COLUMNS[table]?.includes(k)) { out[k] = tryParse(v); continue; }
    out[k] = v;
  }
  return out;
}


const BASE = process.env.D1_GATEWAY_URL;
const TOKEN = process.env.D1_GATEWAY_TOKEN;

if (!BASE) console.warn("[d1] D1_GATEWAY_URL is not set");
if (!TOKEN) console.warn("[d1] D1_GATEWAY_TOKEN is not set");

function normVal(col, v) {
  if (BOOL_COLUMNS.has(col)) {
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === "true") return 1;
    if (v === "false") return 0;
  }
  // Arrays/objects are stored as JSON text (Supabase jsonb).
  if (v !== null && typeof v === "object") {
    try { return JSON.stringify(v); } catch { return v; }
  }
  return v;
}

function normFilter(f) {
  if (!f || f.op === "eq" || f.op === "in" || f.op === "is" || f.op === "not.is") return f;
  const copy = { ...f };
  copy.value = normVal(f.col, f.value);
  return copy;
}

export async function d1(action, payload) {
  const url = (BASE || "").replace(/\/$/, "");
  const res = await fetch(`${url}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    let msg = `D1 ${action} failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── High-level helpers used by api/*.js ─────────────────────

// SELECT. filters: [{col, op, value}] (op: eq/neq/gt/gte/lt/lte/like/ilike/in/is/not.is)
// order: [{col, asc}], limit: number. Returns array of rows (coerced).
export async function d1Select(table, { filters = [], order = [], limit } = {}) {
  const j = await d1("select", { table, filters: filters.map(normFilter), order, limit });
  return (j.data || []).map(r => coerceRow(table, r));
}

// SELECT first row matching filters, or null.
export async function d1SelectOne(table, { filters = [], order = [] } = {}) {
  const rows = await d1Select(table, { filters, order, limit: 1 });
  return rows[0] ?? null;
}

// INSERT single row (object). Returns { id }.
export async function d1Insert(table, data) {
  const normalized = {};
  for (const k of Object.keys(data)) normalized[k] = normVal(k, data[k]);
  const j = await d1("insert", { table, data: normalized });
  if (j.error) throw new Error(j.error);
  return { id: j.id };
}

// INSERT many rows (array of objects). Returns { count }.
export async function d1InsertMany(table, rows) {
  const normalized = rows.map(r => {
    const o = {};
    for (const k of Object.keys(r || {})) o[k] = normVal(k, r[k]);
    return o;
  });
  const j = await d1("insertMany", { table, rows: normalized });
  if (j.error) throw new Error(j.error);
  return { count: j.count };
}

// UPDATE rows matching filters with data. Returns { changes }.
export async function d1Update(table, filters, data) {
  const normalized = {};
  for (const k of Object.keys(data)) normalized[k] = normVal(k, data[k]);
  const j = await d1("update", { table, filters: filters.map(normFilter), data: normalized });
  if (j.error) throw new Error(j.error);
  return { changes: j.changes };
}

// DELETE rows matching filters. Returns { changes }.
export async function d1Delete(table, filters) {
  const j = await d1("delete", { table, filters: filters.map(normFilter) });
  if (j.error) throw new Error(j.error);
  return { changes: j.changes };
}

// Find row by filters; update if exists, else insert. Returns inserted/updated row id.
export async function d1Upsert(table, filters, data) {
  const normalized = {};
  for (const k of Object.keys(data)) normalized[k] = normVal(k, data[k]);
  const j = await d1("upsert", { table, filters: filters.map(normFilter), data: normalized });
  if (j.error) throw new Error(j.error);
  return { id: j.id };
}
