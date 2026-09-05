// hubUtils.jsx
import { useState, useEffect, useRef } from "react";

// Read config from Vite env vars so keys are not checked into source.
export const TEAM_PASSWORD = import.meta.env.VITE_TEAM_PASSWORD;

export const ROLES = ["Member", "Captain", "Admin"];
export const SUBTEAMS = ["Build", "Programming", "Marketing & Outreach", "General"];
export const ROLE_COLORS = { Member: "#64748b", Captain: "#3b82f6", Admin: "#ef4444" };
export const SUBTEAM_COLORS = { Build: "#f59e0b", Programming: "#3b82f6", "Marketing & Outreach": "#22c55e", General: "#64748b" };

// ── Auth ─────────────────────────────────────────────────
export const isAuthed = () => localStorage.getItem("hub_authed") === "true";
export const getUsername = () => localStorage.getItem("hub_username") || "";
export const getRole = () => localStorage.getItem("hub_role") || "Member";
export const getSubteam = () => localStorage.getItem("hub_subteam") || "General";
export const isAdmin = () => getRole() === "Admin";
export const isCaptainOrAbove = () => ["Captain","Admin"].includes(getRole());
export const canEditHub = () => isCaptainOrAbove();
export const canEditInventory = () => isCaptainOrAbove() || getSubteam() === "Build";
export const getToken = () => localStorage.getItem("hub_token");

function decodeTokenPayload(token) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}
export const getTokenUserId = () => { const t = getToken(); return t ? decodeTokenPayload(t)?.userId : null; };

export function getVisibleQuestions(questions, answers) {
  const visible = new Map();
  function isVisible(q) {
    if (visible.has(q.id)) return visible.get(q.id);
    visible.set(q.id, false);
    const gate = q.show_if;
    if (!gate || !gate.questionId) { visible.set(q.id, true); return true; }
    const target = (questions || []).find(x => x.id === gate.questionId);
    if (!target) { visible.set(q.id, true); return true; }
    if (!isVisible(target)) { visible.set(q.id, false); return false; }
    const values = Array.isArray(gate.values) ? gate.values : [];
    const raw = answers ? answers[gate.questionId] : undefined;
    let matched = false;
    if (raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
      matched = values.includes("");
    } else if (Array.isArray(raw)) {
      matched = raw.some(i => values.includes((target.options || [])[Number(i)] ?? ""));
    } else {
      const text = target.type === "radio" ? ((target.options || [])[Number(raw)] ?? "") : String(raw);
      matched = values.includes(text);
    }
    if (gate.not) matched = !matched;
    visible.set(q.id, matched);
    return matched;
  }
  return (questions || []).filter(isVisible);
}

export async function hubProxy(table, action, payload) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch("/api/hub-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ table, action, payload, token }),
  });
  if (!res.ok) { let msg = await res.text().catch(() => ""); try { const j = JSON.parse(msg); if (j?.error) msg = j.error; } catch {} throw new Error(msg || `Proxy error ${res.status}`); }
  return res.json();
}

// ── Data reads (Cloudflare D1 via Vercel /api/d1) ────────
// Read-only PostgREST-compatible endpoint. All reads route here; writes go through
// the authenticated /api/hub-proxy or /api/admin-proxy (JWT gated).
export async function sbFetch(path, opts = {}) {
  if (opts.method && opts.method !== "GET" && opts.method !== "OPTIONS") {
    throw new Error("sbFetch is read-only; use hubProxy/adminProxy for writes.");
  }
  const res = await fetch(`/api/d1/${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) { console.error("sbFetch", res.status, path); return null; }
  try { return await res.json(); } catch { return null; }
}

function fileExtension(name) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
  return m ? m[1].toLowerCase() : "bin";
}

async function fileBytes(file) {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  return new Uint8Array(await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  }));
}

function toBase64(bytes) {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

async function hashHex(bytes) {
  try {
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

// Images this big are auto-compressed client-side so the upload stays under the
// server's ~3MB body budget (base64 inflates ~33%, Vercel caps ~4.5MB).
const COMPRESS_THRESHOLD = 2.6 * 1024 * 1024;
const COMPRESS_TARGET = 2.8 * 1024 * 1024;

function isCompressibleImage(file) {
  const t = String(file?.type || "").toLowerCase();
  return /^image\/(png|jpe?g|webp|avif)$/.test(t);
}

function loadImageElement(bytes, mime) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime || "image/png" }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to decode image")); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), type, quality));
}

async function compressImageBytes(bytes, mime) {
  let img;
  try { img = await loadImageElement(bytes, mime); } catch { return null; }
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  if (!w || !h) return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let maxDim = 2400;
  let quality = 0.85;
  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToBlob(canvas, "image/webp", quality);
    if (blob && blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) return null;

    const out = new Uint8Array(await blob.arrayBuffer());
    if (out.length > 0 && out.length < COMPRESS_TARGET) {
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      return { bytes: out, ext, mime: blob.type };
    }
    maxDim = Math.max(1024, Math.floor(maxDim * 0.72));
    quality = Math.max(0.6, quality - 0.15);
  }
  return null;
}

export async function prepareFileForUpload(file) {
  let bytes = await fileBytes(file);
  let ext = fileExtension(file.name);
  let mimeType = file.type || "application/octet-stream";
  if (isCompressibleImage(file) && bytes.length > COMPRESS_THRESHOLD) {
    const c = await compressImageBytes(bytes, mimeType);
    if (c && c.bytes.length > 0 && c.bytes.length < bytes.length) {
      bytes = c.bytes;
      ext = c.ext;
      mimeType = c.mime;
    }
  }
  const hash = await hashHex(bytes);
  return {
    fileName: `${hash}.${ext}`,
    base64: toBase64(bytes),
    contentType: mimeType,
    mimeType,
    origName: file.name,
    bytes,
  };
}

/**
 * Upload a file (logos, banners, sponsor/captain photos, landing images,
 * inventory images, etc.) to the GitHub repo via /api/upload. Returns the raw
 * GitHub URL or null on failure.
 */
export async function uploadFile(file, _bucket) {
  const { fileName, base64, contentType } = await prepareFileForUpload(file);
  const token = localStorage.getItem("admin_token") || localStorage.getItem("hub_token");
  if (!token) { await keepLastUploadError("Upload failed: no auth token — please log in again."); return null; }
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "upload", files: [{ fileName, base64, contentType }] }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.data?.files?.[0]?.url) return j.data.files[0].url;
    const apiErr = j?.error || (j?.errors?.[0]?.error) || `HTTP ${res.status}`;
    await keepLastUploadError(`Upload failed: ${apiErr}`);
  } catch (e) {
    await keepLastUploadError(`Upload failed: ${(e && e.message) || e}`);
  }
  return null;
}

// Last real error from uploadFile, so callers can surface the actual reason.
let _lastUploadError = "";
async function keepLastUploadError(msg) { _lastUploadError = msg; }
export function getLastUploadError() { return _lastUploadError; }

/**
 * Upload "main media" (Media Gallery images/videos, Resources docs such as
 * PDFs/CAD files) to the GitHub repo via /api/upload.
 */
export async function uploadMediaFile(file, _bucket, opts) {
  if (needsLargeUpload(file)) return uploadLargeFile(file, opts);
  return uploadFile(file);
}

// ---- Large media (non-video) uploads via the media-gateway Cloudflare Worker ----
//
// Kept for large CAD/docs/assets that exceed the GitHub 3MB cap. Videos are
// now handled via YouTube (paste a youtube.com / youtu.be link — see
// getYoutubeId below) which is free and autoplays, so the gateway is not
// required for video. Change MEDIA_WORKER_BASE if the worker deploys elsewhere.
export const MEDIA_WORKER_BASE = "https://media-gateway.palivelajoel.workers.dev";
const MEDIA_CHUNK = 50 * 1024 * 1024; // must match the worker's CHUNK_SIZE

/** Files that can't ride the small GitHub path. Videos now go via YouTube
 *  (free, unlimited, autoplay) instead of R2, so only large non-image files
 *  fall back to the R2 media-gateway. Compressible images are handled by
 *  client-side compression onto GitHub (free, <2.8MB). */
export function needsLargeUpload(file) {
  const t = String(file?.type || "").toLowerCase();
  if (t.startsWith("video")) return false;
  return !isCompressibleImage(file) && (file?.size || 0) > COMPRESS_THRESHOLD;
}

function mediaWorkerBase() {
  try {
    const override = localStorage.getItem("media_worker_base");
    if (override) return String(override).replace(/\/$/, "");
  } catch {}
  return MEDIA_WORKER_BASE;
}

async function mediaJson(res) {
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  return j;
}

/**
 * Upload a large file (video/CAD/etc.) to R2 via the media-gateway worker in
 * MEDIA_CHUNK parts. Returns the worker URL for the stored object.
 * onProgress(bytesDone, totalBytes) fires after each part.
 */
export async function uploadLargeFile(file, { onProgress } = {}) {
  const token = getToken() || localStorage.getItem("admin_token");
  if (!token) {
    await keepLastUploadError("Upload failed: no auth token — please log in again.");
    throw new Error("Upload failed: no auth token — please log in again.");
  }
  const base = mediaWorkerBase();

  const started = await mediaJson(await fetch(`${base}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fileName: file.name, size: file.size }),
  }));
  const { key, uploadId, chunkSize } = started;
  const chunk = chunkSize || MEDIA_CHUNK;

  try {
    const parts = [];
    let offset = 0;
    let partNumber = 1;
    while (offset < file.size) {
      const blob = file.slice(offset, offset + chunk);
      const res = await fetch(
        `${base}/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
        { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: blob }
      );
      const j = await mediaJson(res);
      if (!j.etag) throw new Error(`Part ${partNumber} failed`);
      parts.push({ partNumber, etag: j.etag });
      offset += blob.size;
      partNumber++;
      onProgress && onProgress(offset, file.size);
    }

    const done = await mediaJson(await fetch(`${base}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, uploadId, parts }),
    }));
    return done.url;
  } catch (e) {
    try {
      await fetch(`${base}/abort`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key, uploadId }),
      });
    } catch {}
    await keepLastUploadError((e && e.message) || "Upload failed.");
    throw e;
  }
}

/** Upload a raw blob (e.g. camera photos) as a named file. */
export async function uploadBlob(blob, name) {
  return uploadFile(new File([blob], name || "capture.jpg", { type: blob.type || "application/octet-stream" }));
}

/**
 * Displays a captain/leaders headshot from `photo_url` (a direct GitHub/media URL).
 */
export function CaptainPhoto({ photoUrl, name = "?", size = 80, style: extraStyle = {} }) {
  const merged = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    ...extraStyle,
  };

  const initial = ((name || "?").trim()[0] || "?").toUpperCase();

  if (!photoUrl)
    return (
      <div
        style={{
          ...merged,
          background: "rgba(239,68,68,0.12)",
          border: merged.border ?? "2px solid rgba(239,68,68,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: Math.max(size * 0.36, 14),
          color: "#ef4444",
          fontFamily: "'Orbitron',sans-serif",
        }}
      >
        {initial}
      </div>
    );

  return (
    <img
      src={photoUrl}
      alt={name || "Captain"}
      style={{
        ...merged,
        objectFit: "cover",
        display: "block",
        border: merged.border ?? "2px solid rgba(239,68,68,0.35)",
      }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

// ── CSS ──────────────────────────────────────────────────
export const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&family=Bebas+Neue&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;-webkit-tap-highlight-color:transparent;}
body{background:#080a0f;padding-top:env(safe-area-inset-top,0px);}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0d1117;}::-webkit-scrollbar-thumb{background:#ef4444;border-radius:3px;}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.4);}50%{box-shadow:0 0 32px rgba(239,68,68,0.9),0 0 60px rgba(239,68,68,0.3);}}
@keyframes borderPulse{0%,100%{border-color:rgba(239,68,68,0.25);}50%{border-color:rgba(239,68,68,0.75);}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);}}
@keyframes glitch{0%,90%,100%{text-shadow:none;}92%{text-shadow:-3px 0 #ef4444,3px 0 #3b82f6;}95%{text-shadow:3px 0 #ef4444,-3px 0 #3b82f6;}97%{text-shadow:none;}}
@keyframes scanline{0%{top:-4px;}100%{top:100%;}}
@keyframes radarSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
@keyframes countUp{from{opacity:0;transform:scale(0.7);}to{opacity:1;transform:scale(1);}}
@keyframes orb{0%,100%{transform:scale(1);}50%{transform:scale(1.2);}}
input,select,textarea{outline:none;}
button{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
@media(max-width:640px){
  .grid-2col{grid-template-columns:1fr!important;}
  .grid-3col{grid-template-columns:1fr!important;}
  .hide-sm{display:none!important;}
}
`;

export const C = {
  bg:"#080a0f", surface:"rgba(255,255,255,0.03)", border:"rgba(255,255,255,0.08)",
  red:"#ef4444", blue:"#3b82f6", green:"#22c55e", amber:"#f59e0b",
  purple:"#a855f7", pink:"#ec4899", text:"#f1f5f9", muted:"#94a3b8", dim:"#64748b",
};

export const toastStyle = { position:"fixed", bottom:20, right:16, background:"#22c55e", color:"#fff", padding:"11px 18px", borderRadius:8, fontFamily:"monospace", fontSize:13, zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,0.5)", animation:"fadeUp 0.3s ease", maxWidth:"calc(100vw - 32px)" };
export const inputStyle = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"11px 13px", color:"#fff", fontSize:14, fontFamily:"monospace", width:"100%", transition:"border-color 0.2s", WebkitAppearance:"none" };
export const selectStyle = { background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"11px 13px", color:"#fff", fontSize:14, fontFamily:"monospace", width:"100%", cursor:"pointer" };
export const overlayStyle = { position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:14, backdropFilter:"blur(8px)" };
export const modalStyle = { background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"24px 20px", width:"100%", maxWidth:480, maxHeight:"92vh", overflowY:"auto" };
export const addBtnStyle = { background:"#ef4444", border:"none", borderRadius:8, padding:"11px 18px", color:"#fff", cursor:"pointer", fontSize:14, fontFamily:"'Exo 2',sans-serif", fontWeight:600, whiteSpace:"nowrap", transition:"all 0.2s", touchAction:"manipulation" };
export const ghostBtn = { background:"transparent", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"9px 14px", color:"#94a3b8", cursor:"pointer", fontSize:13, fontFamily:"monospace", whiteSpace:"nowrap", touchAction:"manipulation" };
export const dangerBtn = { background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"9px 14px", color:"#ef4444", cursor:"pointer", fontSize:13, fontFamily:"monospace", whiteSpace:"nowrap", touchAction:"manipulation" };

export function HubHeader({ title }) {
  return (
    <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(8,10,15,0.97)", backdropFilter:"blur(14px)", position:"sticky", top:"env(safe-area-inset-top,0px)", zIndex:100, gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
        <a href="/member-hub" style={{ color:"#64748b", textDecoration:"none", fontSize:13, fontFamily:"monospace", flexShrink:0, padding:"6px 0" }}>← Hub</a>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700, color:"#f1f5f9", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
        <span style={{ fontSize:10, color:"#64748b", fontFamily:"monospace" }}>{getUsername()} · {getRole()}</span>
        <a href="/" style={{ fontSize:11, color:"#64748b", textDecoration:"none", fontFamily:"monospace" }}>Site</a>
      </div>
    </header>
  );
}

export function FormHeader({ title = "FORMS & SURVEYS", subtitle = "FRC Team 4550 · Something's Bruin", right }) {
  const [logoUrl, setLogoUrl] = useState("/logo.jpg");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth <= 640);

  useEffect(() => {
    sbFetch("site_config?key=eq.logo_url&select=value").then(r => {
      if (r && r[0] && r[0].value) setLogoUrl(r[0].value);
    }).catch(() => {});
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding: isMobile ? "12px 14px" : "14px 28px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(8,10,15,0.88)", backdropFilter:"blur(16px)", position:"sticky", top:"env(safe-area-inset-top,0px)", zIndex:100, gap:10, flexWrap:"wrap" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, minWidth:0 }}>
        <img src={logoUrl} alt="logo" style={{ width:isMobile?30:36, height:isMobile?30:36, borderRadius:"50%", objectFit:"cover", border:"1px solid rgba(239,68,68,0.4)", flexShrink:0 }} />
        {!isMobile && (
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:700, fontSize:13, color:C.red, letterSpacing:2 }}>{title}</div>
            <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace" }}>{subtitle}</div>
          </div>
        )}
      </div>
      {right ? <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>{right}</div> : null}
    </header>
  );
}
