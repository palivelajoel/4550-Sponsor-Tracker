/**
 * d1-gateway — Cloudflare Worker that exposes a thin JSON CRUD API over Cloudflare D1.
 *
 * This is the ONLY Cloudflare piece in the stack. Vercel serverless functions call
 * this worker over HTTPS; it holds the D1 binding and executes parameterized SQL.
 *
 * Security model:
 *  - Requests MUST send `Authorization: Bearer <API_TOKEN>` (secret set in the dashboard).
 *  - Only an explicit allowlist of tables is reachable.
 *  - All values are bound via D1's prepared-statement `bind(...)` — no string-concatenated SQL.
 *  - Endpoint roles/auth are enforced upstream (Vercel JWT layer), not here.
 */

const ALLOWED_TABLES = new Set([
  "members", "suggestions", "sponsors", "sponsor_notes", "captains", "site_config",
  "hub_tasks", "hub_calendar", "hub_announcements", "hub_media", "hub_resources",
  "hub_forms", "hub_form_submissions", "inventory_items", "inventory_transactions",
  "articles", "competitions",
]);

// Operators mapped to SQL. `value` is always bound as a parameter.
const FILTER_OPERATORS = {
  eq: "=",
  neq: "!=",
  ne: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "LIKE",
  in: "IN",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function isAuthorized(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  return env.API_TOKEN && token === env.API_TOKEN;
}

/**
 * Build a WHERE clause from an array of filters.
 * Each filter: { col, op, value } where op is one of FILTER_OPERATORS or "is"/"not.is".
 */
function buildWhere(filters) {
  if (!Array.isArray(filters) || filters.length === 0) return { sql: "", params: [] };
  const clauses = [];
  const params = [];
  for (const f of filters) {
    const col = f && typeof f.col === "string" ? f.col : null;
    const op = f && f.op;
    if (!col || !op) continue;
    if (op === "is") {
      if (f.value === null || f.value === "null") { clauses.push(`${col} IS NULL`); }
      else { clauses.push(`${col} IS ?`); params.push(f.value); }
    } else if (op === "not.is") {
      if (f.value === null || f.value === "null") { clauses.push(`${col} IS NOT NULL`); }
      else { clauses.push(`${col} IS NOT ?`); params.push(f.value); }
    } else if (FILTER_OPERATORS[op]) {
      const sqlOp = FILTER_OPERATORS[op];
      if (op === "in") {
        // value is an array
        const arr = Array.isArray(f.value) ? f.value : [f.value];
        if (arr.length === 0) { clauses.push("0 = 1"); continue; }
        const placeholders = arr.map(() => "?").join(",");
        clauses.push(`${col} IN (${placeholders})`);
        arr.forEach(v => params.push(v));
      } else {
        clauses.push(`${col} ${sqlOp} ?`);
        params.push(f.value);
      }
    }
  }
  return { sql: clauses.length ? "WHERE " + clauses.join(" AND ") : "", params };
}

function buildOrder(order) {
  if (!Array.isArray(order) || order.length === 0) return "";
  const parts = order.map(o => {
    const safeCol = o && typeof o.col === "string" ? o.col : null;
    if (!safeCol) return null;
    return `${safeCol} ${o.asc ? "ASC" : "DESC"}`;
  }).filter(Boolean);
  return parts.length ? "ORDER BY " + parts.join(", ") : "";
}

async function handleSelect(env, body) {
  const { table, filters, order, limit } = body;
  const where = buildWhere(filters);
  const ord = buildOrder(order);
  const lim = Number.isFinite(limit) && limit > 0 ? `LIMIT ${Math.floor(limit)}` : "";
  const sql = `SELECT * FROM "${table}" ${where.sql} ${ord} ${lim}`.replace(/\s+/g, " ").trim();
  const stmt = env.DB.prepare(sql);
  const { results } = await stmt.bind(...where.params).all();
  return json({ data: results });
}

async function handleInsert(env, body) {
  const { table, data } = body;
  if (!data || typeof data !== "object") return json({ error: "Missing data" }, 400);
  const cols = Object.keys(data);
  if (cols.length === 0) return json({ error: "No columns to insert" }, 400);
  const placeholders = cols.map(() => "?").join(",");
  const sql = `INSERT INTO "${table}" ("${cols.join('","')}") VALUES (${placeholders})`;
  const stmt = env.DB.prepare(sql).bind(...cols.map(c => data[c]));
  const { success, last_row_id, meta } = await stmt.run();
  return json({ success, id: last_row_id ?? null, meta: meta?.changes ?? null });
}

async function handleInsertMany(env, body) {
  const { table, rows } = body;
  if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Missing rows" }, 400);
  const cols = [...new Set(rows.flatMap(r => Object.keys(r || {})))];
  if (cols.length === 0) return json({ error: "No columns" }, 400);
  const tx = env.DB.batch(
    rows.map(r => {
      const placeholders = cols.map(() => "?").join(",");
      return env.DB.prepare(`INSERT INTO "${table}" ("${cols.join('","')}") VALUES (${placeholders})`)
        .bind(...cols.map(c => r[c] ?? null));
    })
  );
  const results = await tx;
  return json({ success: true, count: results.length });
}

async function handleUpdate(env, body) {
  const { table, filters, data } = body;
  if (!data || typeof data !== "object") return json({ error: "Missing data" }, 400);
  const cols = Object.keys(data);
  if (cols.length === 0) return json({ error: "No columns to update" }, 400);
  const where = buildWhere(filters);
  const setSql = cols.map(c => `"${c}" = ?`).join(", ");
  const sql = `UPDATE "${table}" SET ${setSql} ${where.sql}`.replace(/\s+/g, " ").trim();
  const params = [...cols.map(c => data[c]), ...where.params];
  const stmt = env.DB.prepare(sql).bind(...params);
  const { success, meta } = await stmt.run();
  return json({ success, changes: meta?.changes ?? 0 });
}

async function handleDelete(env, body) {
  const { table, filters } = body;
  const where = buildWhere(filters);
  const sql = `DELETE FROM "${table}" ${where.sql}`.replace(/\s+/g, " ").trim();
  const stmt = env.DB.prepare(sql).bind(...where.params);
  const { success, meta } = await stmt.run();
  return json({ success, changes: meta?.changes ?? 0 });
}

async function handleUpsert(env, body) {
  // Generic "find-or-create" on a unique column (e.g. site_config.key).
  const { table, filters, data } = body;
  if (!data || typeof data !== "object") return json({ error: "Missing data" }, 400);
  const where = buildWhere(filters);
  const existing = await env.DB.prepare(`SELECT * FROM "${table}" ${where.sql} LIMIT 1`.replace(/\s+/g, " ").trim()).bind(...where.params).first();
  if (existing) {
    return handleUpdate(env, { table, filters, data });
  }
  return handleInsert(env, { table, data });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
    }
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const { table, action } = body || {};
    if (!table || !ALLOWED_TABLES.has(table)) return json({ error: "Invalid or disallowed table" }, 403);
    if (!action) return json({ error: "Missing action" }, 400);

    switch (action) {
      case "select": return handleSelect(env, body);
      case "insert": return handleInsert(env, body);
      case "insertMany": return handleInsertMany(env, body);
      case "update": return handleUpdate(env, body);
      case "delete": return handleDelete(env, body);
      case "upsert": return handleUpsert(env, body);
      default: return json({ error: "Invalid action" }, 400);
    }
  },
};
