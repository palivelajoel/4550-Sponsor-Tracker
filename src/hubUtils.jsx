// hubUtils.jsx
import { useState, useEffect, useRef } from "react";

// Read Supabase config from Vite env vars so keys are not checked into source.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
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

// ── Supabase ─────────────────────────────────────────────
export async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...opts.headers },
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

export async function prepareFileForUpload(file) {
  const bytes = await fileBytes(file);
  const hash = await hashHex(bytes);
  return {
    fileName: `${hash}.${fileExtension(file.name)}`,
    base64: toBase64(bytes),
    contentType: file.type || "application/octet-stream",
    mimeType: file.type || "application/octet-stream",
    origName: file.name,
    bytes,
  };
}

/**
 * Upload "main media" (gallery images, resource files) to the GitHub repo
 * via /api/upload, falling back to Supabase storage if that fails.
 */
export async function uploadMediaFile(file, fallbackBucket) {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("hub_token");
  if (token) {
    try {
      const { fileName, base64, contentType } = await prepareFileForUpload(file);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "upload", files: [{ fileName, base64, contentType }] }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.data?.files?.[0]?.url) return j.data.files[0].url;
    } catch {}
  }
  return uploadFile(file, fallbackBucket);
}

export async function uploadFile(file, bucket = "team-assets") {
  const { fileName: safeFileName, bytes, base64, contentType } = await prepareFileForUpload(file);
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${safeFileName}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type, "x-upsert": "true" },
      body: new Blob([bytes], { type: file.type }),
    });
    if (res.ok) return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${safeFileName}`;
  } catch {}
  try {
    const token = localStorage.getItem("admin_token") || localStorage.getItem("hub_token");
    if (!token) return null;
    const endpoint = localStorage.getItem("admin_token") ? "/api/admin-proxy" : "/api/hub-proxy";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "upload", payload: { bucket, fileName: safeFileName, base64, contentType } }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.data?.url) return null;
    return j.data.url;
  } catch { return null; }
}

/** Public URL helpers for captain headshots (`team-assets` bucket only). */

const CAPTAIN_BUCKET = "team-assets";

function safeDecode(seg) {
  try { return decodeURIComponent(seg); } catch { return seg; }
}

/** Object path inside bucket (may include slashes), no leading slash; null if unmappable */
export function captainStorageKeyFromStoredValue(stored) {
  if (!stored || typeof stored !== "string") return null;
  const raw = stored.trim();
  if (!raw) return null;

  let pathLike = raw.split(/[?#]/)[0];
  try {
    if (/^https?:\/\//i.test(raw)) pathLike = new URL(raw).pathname;
  } catch {
    return null;
  }

  const tryAfter = (s, needle) => {
    const i = s.indexOf(needle);
    if (i === -1) return null;
    return safeDecode(s.slice(i + needle.length).replace(/^\/+/, ""));
  };

  let key =
    tryAfter(pathLike, `/object/public/${CAPTAIN_BUCKET}/`) ||
    tryAfter(pathLike, `/storage/v1/object/public/${CAPTAIN_BUCKET}/`) ||
    tryAfter(pathLike, `/object/sign/${CAPTAIN_BUCKET}/`) ||
    tryAfter(pathLike, `/object/${CAPTAIN_BUCKET}/`) ||
    tryAfter(pathLike, `/${CAPTAIN_BUCKET}/`);
  if (key) return key.replace(/^\/*/, "");

  pathLike = pathLike.replace(/^\/+/, "");
  const segments = pathLike.split("/").filter(Boolean);
  const bi = segments.lastIndexOf(CAPTAIN_BUCKET);
  if (bi >= 0 && bi < segments.length - 1) return segments.slice(bi + 1).map(safeDecode).join("/");

  if (/^[a-zA-Z0-9._\- /]+\.(jpe?g|png|gif|webp)$/i.test(pathLike)) return pathLike;
  const last = segments[segments.length - 1];
  return last ? safeDecode(last) : null;
}

/** Encode each path segment (spaces etc.) once for the canonical public URL Supabase expects. */
function escapedStoragePath(key) {
  return key
    .split("/")
    .filter(Boolean)
    .map(seg => encodeURIComponent(safeDecode(seg)))
    .join("/");
}

/** Distinct URLs to try loading (stored URL plus canonical `public/` URLs for current project). */
function captainAvatarUrlCandidates(storageKey, originalTrimmed) {
  const uniq = [];
  const add = u => {
    if (u && typeof u === "string" && !uniq.includes(u)) uniq.push(u);
  };

  if (/^https?:\/\//i.test(originalTrimmed)) add(originalTrimmed);

  if (!SUPABASE_URL || !storageKey) return uniq;

  const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${CAPTAIN_BUCKET}`;
  add(`${base}/${escapedStoragePath(storageKey)}`);
  add(`${base}/${storageKey}`);
  return uniq;
}

function loadImageViaTag(url) {
  return new Promise(resolve => {
    const img = new Image();
    const done = ok => {
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.decoding = "async";
    img.src = url;
  });
}

/**
 * Displays a captain/leaders headshot from `photo_url`: any full URL, legacy host, or object key under `team-assets`.
 */
export function CaptainPhoto({ photoUrl, name = "?", size = 80, style: extraStyle = {} }) {
  const [status, setStatus] = useState("idle");
  const [src, setSrc] = useState(null);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const revokeBlob = () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    revokeBlob();
    setSrc(null);

    const trimmed = typeof photoUrl === "string" ? photoUrl.trim() : "";
    if (!trimmed || !SUPABASE_URL) {
      setStatus("error");
      return () => {
        cancelled = true;
        revokeBlob();
      };
    }

    setStatus("loading");

    const key = captainStorageKeyFromStoredValue(trimmed);
    const candidates = captainAvatarUrlCandidates(key, trimmed);
    const authHeaders =
      SUPABASE_KEY && SUPABASE_URL
        ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        : null;

    (async () => {
      for (const url of candidates) {
        if (cancelled) return;
        try {
          if (await loadImageViaTag(url)) {
            revokeBlob();
            if (cancelled) return;
            setSrc(url);
            setStatus("ok");
            return;
          }
        } catch { /* next */ }
      }

      if (authHeaders && candidates.length > 0) {
        for (const url of candidates) {
          if (cancelled) return;
          try {
            const r = await fetch(url, { headers: authHeaders });
            if (!r.ok) continue;
            const blob = await r.blob();
            if (!blob.size || cancelled) continue;
            revokeBlob();
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRef.current = blobUrl;
            setSrc(blobUrl);
            setStatus("ok");
            return;
          } catch { /* next */ }
        }
      }

      if (!cancelled) setStatus("error");
    })();

    return () => {
      cancelled = true;
      revokeBlob();
    };
  }, [photoUrl]);

  const merged = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    ...extraStyle,
  };

  const initial = ((name || "?").trim()[0] || "?").toUpperCase();

  if (status === "error")
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

  if (status !== "ok" || !src)
    return (
      <div
        aria-hidden
        style={{
          ...merged,
          background: "rgba(255,255,255,0.06)",
          border: merged.border ?? "2px solid rgba(255,255,255,0.08)",
        }}
      />
    );

  return (
    <img
      src={src}
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
      onError={() => setStatus("error")}
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
