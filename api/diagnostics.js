// Lightweight diagnostics endpoint for runtime env verification.
// Returns booleans plus a safe fingerprint of the gateway config so a stale
// D1_GATEWAY_URL / D1_GATEWAY_TOKEN can be spotted instantly, plus a live
// gateway probe so we can see EXACTLY what the gateway returns to Vercel.
// No secrets exposed: URL printed in full (infrastructure URL, not a secret)
// and the token truncated to its last 4 chars only.

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

    let gatewayProbe = null;
    if (gatewayUrl) {
      try {
        const probeRes = await fetch(`${gatewayUrl}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayToken}` },
          body: JSON.stringify({ action: "select", table: "site_config", filters: [], order: [], limit: 2 }),
        });
        const text = await probeRes.text();
        gatewayProbe = {
          status: probeRes.status,
          bodySnippet: (text || "").slice(0, 160),
        };
      } catch (e) {
        gatewayProbe = { error: String((e && e.message) || e) };
      }
    }

    const runtime = { onVercel: !!process.env.VERCEL, nodeEnv: process.env.NODE_ENV || null };

    return res.status(200).json({ ok: true, env, gatewayUrl, tokenLast4, gatewayProbe, runtime });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}