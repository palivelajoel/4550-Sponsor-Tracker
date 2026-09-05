/**
 * media-gateway — Cloudflare Worker + R2 for large media (videos up to ~4.5GB).
 *
 * Why not the existing Vercel/GitHub upload path: request-body limits
 * (~4.5MB on Vercel, 100MB on Cloudflare's free plan). Media Gallery videos
 * are typically ~500MB, so the browser uploads the file in CHUNK_SIZE parts as
 * RAW BYTES (no base64), and this worker assembles them into R2 via the
 * multipart-upload API. Every part request stays far under every platform
 * limit, nothing is buffered in memory, and there is no AWS SigV4 to manage.
 *
 * Auth:
 *   - GET/HEAD serve objects PUBLICLY so <video> playback and the ad board
 *     work cross-origin without CORS/credentials.
 *   - Every write (/start, /part, /complete, /abort) requires an
 *     Authorization: Bearer <site JWT> header. JWTs are verified with the
 *     JWT_SECRET worker secret, which must equal Vercel's JWT_SECRET env var.
 *
 * Deployment (one-time, needs Cloudflare + the JWT_SECRET value from Vercel):
 *   cd media-gateway
 *   npm i -D wrangler
 *   npx wrangler login
 *   npx wrangler r2 bucket create 4550-media
 *   npx wrangler secret put JWT_SECRET        # paste Vercel's JWT_SECRET value
 *   npx wrangler deploy
 */

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MiB per part — >5MiB R2 multipart minimum, <100MiB workers free-tier request cap
const MAX_TOTAL = 4.5 * 1024 * 1024 * 1024; // R2 multipart ceiling is 5GiB; keep a safe margin

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ---- JWT (HS256) verification --------------------------------------------

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlStr(s) {
  return dec.decode(b64urlBytes(s));
}

async function verifyJwt(token, secret) {
  try {
    if (!secret) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, b64urlBytes(sig), enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(b64urlStr(p));
    if (!payload.exp || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- Handlers -------------------------------------------------------------

function cleanName(name) {
  const n = String(name || "media")
    .replace(/\s+/g, "_")
    .replace(/[^\w.\-]+/g, "")
    .replace(/^\.+/, "")
    .slice(-80);
  return n || "media";
}

function randomHex(len) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function handleStart(request, env) {
  const body = await request.json().catch(() => null);
  const size = Number(body?.size);
  if (!(size > 0)) return json({ error: "size required" }, 400);
  if (size > MAX_TOTAL) return json({ error: "File too large (max 4.5GB)" }, 413);
  const key = `team-media/${Date.now()}-${randomHex(6)}-${cleanName(body.fileName)}`;
  const upload = env.MEDIA.createMultipartUpload(key);
  return json({
    key,
    uploadId: upload.uploadId,
    parts: Math.ceil(size / CHUNK_SIZE),
    chunkSize: CHUNK_SIZE,
  });
}

async function handlePart(request, url, env) {
  const key = url.searchParams.get("key");
  const uploadId = url.searchParams.get("uploadId");
  const partNumber = Number(url.searchParams.get("partNumber"));
  if (!key || !uploadId || !(partNumber >= 1)) {
    return json({ error: "key, uploadId, partNumber required" }, 400);
  }
  const len = Number(request.headers.get("content-length") || 0);
  if (len > CHUNK_SIZE + (1 << 20)) return json({ error: "Part too large" }, 413);
  const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
  const part = await upload.uploadPart(partNumber, request.body);
  return json({ partNumber, etag: part.etag });
}

async function handleComplete(request, env) {
  const body = await request.json().catch(() => null);
  if (!body?.key || !body?.uploadId || !Array.isArray(body.parts)) {
    return json({ error: "key, uploadId, parts required" }, 400);
  }
  const upload = env.MEDIA.resumeMultipartUpload(body.key, body.uploadId);
  await upload.complete(body.parts);
  const origin = new URL(request.url).origin;
  return json({ url: `${origin}/${body.key}` });
}

async function handleAbort(request, env) {
  const body = await request.json().catch(() => null);
  if (!body?.key || !body?.uploadId) return json({ error: "key, uploadId required" }, 400);
  const upload = env.MEDIA.resumeMultipartUpload(body.key, body.uploadId);
  await upload.abort();
  return json({ ok: true });
}

function parseRange(header, total) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!m) return null;
  let start, end;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (!(suffix > 0)) return null;
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (start >= total || end < start) return null;
  return { start, length: end - start + 1 };
}

async function serveObject(request, method, url, env) {
  const key = url.pathname.replace(/^\//, "");
  if (!key) {
    return json({ service: "media-gateway", ok: true, uploads: "/start /part /complete /abort", media: "/team-media/<key>" });
  }

  let opts = {};
  let contentRange = null;
  const rangeHeader = request.headers.get("Range");

  if (rangeHeader) {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response(method === "HEAD" ? null : "Not found", { status: 404, headers: CORS_HEADERS });
    const total = head.size;
    const r = parseRange(rangeHeader, total);
    if (!r) {
      return new Response(null, {
        status: 416,
        headers: { ...CORS_HEADERS, "Content-Range": `bytes */${total}` },
      });
    }
    opts.range = { offset: r.start, length: r.length };
    contentRange = `bytes ${r.start}-${r.start + r.length - 1}/${total}`;
  }

  const object = await env.MEDIA.get(key, opts);
  if (!object) return new Response(method === "HEAD" ? null : "Not found", { status: 404, headers: CORS_HEADERS });

  const headers = {
    ...CORS_HEADERS,
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (object.httpEtag) headers["ETag"] = object.httpEtag;

  if (contentRange && object.range) {
    headers["Content-Range"] = contentRange;
    return new Response(method === "HEAD" ? null : object.body, { status: 206, headers });
  }
  return new Response(method === "HEAD" ? null : object.body, { status: 200, headers });
}

// ---- Entrypoint -----------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

    if (method === "GET" || method === "HEAD") return serveObject(request, method, url, env);

    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const payload = await verifyJwt(auth.slice(7), env.JWT_SECRET);
    if (!payload) return json({ error: "Unauthorized" }, 401);

    try {
      if (method === "POST" && url.pathname === "/start") return handleStart(request, env);
      if (method === "PUT" && url.pathname === "/part") return handlePart(request, url, env);
      if (method === "POST" && url.pathname === "/complete") return handleComplete(request, env);
      if (method === "POST" && url.pathname === "/abort") return handleAbort(request, env);
      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: (e && e.message) || "Request failed" }, 500);
    }
  },
};