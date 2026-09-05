// Lightweight diagnostics endpoint for runtime verification.
// No secrets exposed: URL printed in full, token only last 4 chars.
// This version also REPRODUCES the /api/d1 failure path in-process so we can
// see the exact error api/d1.js hits while a direct fetch works.

import { d1Select } from './_gateway.js';

export default async function handler(req, res) {
  try {
    const env = {
      D1_GATEWAY_URL: !!process.env.D1_GATEWAY_URL,
      D1_GATEWAY_TOKEN: !!process.env.D1_GATEWAY_TOKEN,
      GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
      JWT_SECRET: !!process.env.JWT_SECRET,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      TBA_API_KEY: !!process.env.TBA_API_KEY,
    };

    const gatewayUrl = process.env.D1_GATEWAY_URL ? process.env.D1_GATEWAY_URL.replace(/\/+$/, "") : null;
    const gatewayToken = process.env.D1_GATEWAY_TOKEN || "";
    const tokenLast4 = gatewayToken.length >= 4 ? "…" + gatewayToken.slice(-4) : null;

    // 1) direct fetch (as normal rest client would)
    let directFetch = null;
    try {
      const r = await fetch(`${gatewayUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayToken}` },
        body: JSON.stringify({ action: "select", table: "site_config", filters: [], order: [], limit: 2 }),
      });
      directFetch = { status: r.status, body: (await r.text()).slice(0, 120) };
    } catch (e) { directFetch = { error: String((e && e.message) || e) }; }

    // 2) the exact body api/d1.js sends for GET /api/d1/site_config
    let exactBody = null;
    try {
      const r = await fetch(`${gatewayUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayToken}` },
        body: JSON.stringify({ action: "select", table: "site_config", filters: [], order: [], limit: null }),
      });
      exactBody = { status: r.status, body: (await r.text()).slice(0, 120) };
    } catch (e) { exactBody = { error: String((e && e.message) || e) }; }

    // 3) the REAL code path api/d1.js uses (d1Select from _gateway.js)
    let moduleSelect = null;
    try {
      const rows = await d1Select("site_config", {});
      moduleSelect = { ok: true, count: Array.isArray(rows) ? rows.length : -1 };
    } catch (e) {
      moduleSelect = { ok: false, error: String((e && e.message) || e), full: String(e) };
    }

    const runtime = { onVercel: !!process.env.VERCEL, nodeEnv: process.env.NODE_ENV || null };

    return res.status(200).json({ ok: true, env, gatewayUrl, tokenLast4, directFetch, exactBody, moduleSelect, runtime });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}