// Lightweight diagnostics endpoint to confirm presence of server runtime env vars
// Returns booleans only; does NOT expose secret values.

export default async function handler(req, res) {
  try {
    const env = {
      D1_GATEWAY_URL: !!process.env.D1_GATEWAY_URL,
      D1_GATEWAY_TOKEN: !!process.env.D1_GATEWAY_TOKEN,
      ADMIN_API_TOKEN: !!process.env.ADMIN_API_TOKEN,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      TBA_API_KEY: !!process.env.TBA_API_KEY,
      JWT_SECRET: !!process.env.JWT_SECRET,
    };

    // Include a quick build/runtime hint (vercel sets VERCEL env var)
    const runtime = {
      onVercel: !!process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV || null,
    };

    return res.status(200).json({ ok: true, env, runtime });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
