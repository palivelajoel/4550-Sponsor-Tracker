// Lightweight diagnostics endpoint for runtime env verification.
// Returns booleans plus a safe fingerprint of the gateway config so a stale
// D1_GATEWAY_URL / D1_GATEWAY_TOKEN can be spotted instantly. No secrets exposed:
// the URL is printed in full (it is an infrastructure URL, not a secret) and the
// token is truncated to its last 4 chars only.

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

    const gatewayUrl = process.env.D1_GATEWAY_URL || null;
    const gatewayToken = process.env.D1_GATEWAY_TOKEN || "";
    const tokenLast4 = gatewayToken.length >= 4 ? '…' + gatewayToken.slice(-4) : null;

    const runtime = {
      onVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV || null,
    };

    return res.status(200).json({ ok: true, env, gatewayUrl, tokenLast4, runtime });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}