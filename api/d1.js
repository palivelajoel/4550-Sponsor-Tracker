// api/d1.js
// PostgREST-compatible READ endpoint backed by Cloudflare D1 (via the gateway).
//
// The frontend `sbFetch`/`dbFetch` reads use the same query-string syntax it used
// against the D1-backed API (`/api/d1/members?select=*&order=created_at.asc&role=eq.Admin`).
// This handler translates those query strings into D1 select calls and returns rows
// with boolean columns coerced back to true/false (D1 stores them as 0/1).
//
// SECURITY: this endpoint is READ-ONLY (select). All writes must go through the
// authenticated /api/hub-proxy / /api/admin-proxy layer (JWT role gating), which is
// the RLS-equivalent boundary now that D1 has no per-row security.

import { d1Select, coerceRow } from './_gateway.js';

const READ_TABLES = new Set([
  "members", "suggestions", "sponsors", "sponsor_notes", "captains", "site_config",
  "hub_tasks", "hub_calendar", "hub_announcements", "hub_media", "hub_resources",
  "hub_forms", "hub_form_submissions", "inventory_items", "inventory_transactions",
  "articles", "competitions",
]);

function err(res, status, msg) {
  return res.status(status).json({ error: msg });
}

// Parse a query string like `?select=*&order=created_at.desc&role=eq.Admin&limit=5`
// into { filters, order, limit, embeds }. Returns null on unparseable param.
function parseQuery(searchParams) {
  const filters = [];
  let order = [];
  let limit = null;
  const embeds = new Map(); // colName -> { fields } for embedded resource joins

  for (const [key, raw] of searchParams.entries()) {
    if (key === "select") {
      // e.g. `*,item_id(id,name)` → item_id is an embedded join
      const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const m = /^(\w+)\(([^)]*)\)$/.exec(p);
        if (m) embeds.set(m[1], (m[2] || "").split(",").map(s => s.trim()).filter(Boolean));
      }
      continue;
    }
    if (key === "order") {
      order = raw.split(",").map(seg => {
        const [col, dir] = seg.trim().split(".");
        return { col, asc: dir === "asc" };
      }).filter(o => o.col);
      continue;
    }
    if (key === "limit") {
      limit = parseInt(raw, 10);
      if (Number.isNaN(limit)) limit = null;
      continue;
    }
    if (!raw) continue;

    // Filter keys come in forms: `role=eq.Admin`, `status=neq.Done`, `status=not.eq.Declined`,
    // `published=eq.true`, `due_date=is.null`, `¬=due_date.is.null` (not(is null)).
    // The `©`/`¬` key means "not of the value's operator": e.g. `¬=due_date.is.null` → due_date IS NOT NULL.
    let col = key;
    let negate = false;
    if (key === "¬" || key === "\u00ac" || key === "not") {
      // value form: `due_date.is.null` or `due_date=neq.x`
      negate = true;
      const vm = /^([\w]+)(?:\.(.*))?$/.exec(raw);
      if (!vm) continue;
      col = vm[1];
      const sub = vm[2] || "eq";
      const [op, ...rest] = sub.split(".");
      const val = rest.join(".");
      if (op === "is" && val === "null") {
        filters.push({ col, op: "not.is", value: null });
      } else if (FILTER_OP.has(op)) {
        filters.push({ col, op: negateOp(op), value: coerce(val) });
      }
      continue;
    }

    // `col=OP.value`
    const dot = raw.indexOf(".");
    if (dot === -1) { filters.push({ col, op: "eq", value: coerce(raw) }); continue; }
    const op = raw.slice(0, dot);
    let val = raw.slice(dot + 1);

    if (op === "not") {
      // `status=not.eq.Declined` → status != Declined ; `status=not.is.null` → status IS NOT NULL
      const [realOp, ...parts] = val.split(".");
      val = parts.join(".");
      if (realOp === "is" && val === "null") filters.push({ col, op: "not.is", value: null });
      else if (FILTER_OP.has(realOp)) filters.push({ col, op: negateOp(realOp), value: coerce(val) });
      continue;
    }

    if (op === "is") {
      filters.push({ col, op: "is", value: val === "null" ? null : coerce(val) });
      continue;
    }
    if (FILTER_OP.has(op)) {
      filters.push({ col, op, value: coerce(val) });
      continue;
    }
    // unknown op → treat whole raw as eq value
    filters.push({ col, op: "eq", value: coerce(raw) });
  }

  return { filters, order, limit, embeds };
}

const FILTER_OP = new Set(["eq", "neq", "ne", "gt", "gte", "lt", "lte", "like", "ilike", "in"]);
const NOT_OPS = { eq: "neq", neq: "eq", ne: "eq", gt: "lte", gte: "lt", lt: "gte", lte: "gt" };
function negateOp(op) { return NOT_OPS[op] || op; }

function coerce(v) {
  if (v === "null" || v === "NULL") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (v !== "" && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

async function handleJoin(table, filters, order, limit) {
  // inventory_transactions -> item_id(id,name)
  const items = await d1Select("inventory_items", { limit: 100000 });
  const itemMap = new Map(items.map(i => [i.id, i]));
  const rows = await d1Select(table, { filters, order, limit });
  return rows.map(r => ({
    ...coerceRow(table, r),
    item_id: r.item_id != null ? { id: r.item_id, name: itemMap.get(r.item_id)?.["name"] ?? null } : null,
  }));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return err(res, 405, "Method not allowed");

  const pathname = (req.url.split("?")[0] || "").replace(/^\/api\/d1\//, "").replace(/^\/api\/d1$/, "").split("/")[0];
  const table = decodeURIComponent(pathname || "");
  if (!table || !READ_TABLES.has(table)) return err(res, 400, "Invalid table");

  const query = new URLSearchParams(req.url.split("?")[1] || "");
  const { filters, order, limit, embeds } = parseQuery(query);

  try {
    let rows;
    if (table === "inventory_transactions" && embeds.has("item_id")) {
      rows = await handleJoin(table, filters, order, limit);
    } else {
      rows = await d1Select(table, { filters, order, limit });
      rows = rows.map(r => coerceRow(table, r));
    }
    return res.status(200).json(rows);
  } catch (e) {
    console.error("[d1] select error", e);
    return err(res, 500, String(e && e.message ? e.message : e));
  }
}
