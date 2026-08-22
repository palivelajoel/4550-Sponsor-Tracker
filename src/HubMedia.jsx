import { useState, useEffect, useRef } from "react";
import { motion } from 'framer-motion'
import { FONTS, C, sbFetch, isAuthed, canEditHub, uploadFile, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, addBtnStyle, ghostBtn, dangerBtn, hubProxy } from "./hubUtils.jsx";
import HubBackground from "./HubBackground.jsx";

const CATEGORIES = ["All", "Competition", "Build Season", "Outreach", "Team", "Other"];

function CropTool({ file, onCrop, onCancel }) {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const [dragging, setDragging] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const dragStart = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = 480, maxH = 360;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxW) { h = h * maxW / w; w = maxW; }
      if (h > maxH) { w = w * maxH / h; h = maxH; }
      setImgSize({ w, h });
      setCrop({ x: 0, y: 0, w, h });
      setLoaded(true);
    };
    const url = URL.createObjectURL(file);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function getPos(e) {
    if (!containerRef.current) return { x: 0, y: 0 };
    const r = containerRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function handleDown(e) {
    const p = getPos(e);
    const c = crop;
    dragStart.current = { x: p.x - c.x, y: p.y - c.y, w: c.w, h: c.h, mx: p.x, my: p.y };
    if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) setDragging("move");
    else setDragging("new");
  }

  function handleMove(e) {
    if (!dragging) return;
    const p = getPos(e);
    if (dragging === "move") {
      const ds = dragStart.current;
      setCrop({
        x: Math.max(0, Math.min(p.x - ds.x, imgSize.w - ds.w)),
        y: Math.max(0, Math.min(p.y - ds.y, imgSize.h - ds.h)),
        w: ds.w, h: ds.h,
      });
    } else if (dragging === "new") {
      const ds = dragStart.current;
      const nx = Math.min(ds.mx, p.x), ny = Math.min(ds.my, p.y);
      setCrop({
        x: Math.max(0, nx), y: Math.max(0, ny),
        w: Math.max(20, Math.min(Math.abs(p.x - ds.mx), imgSize.w - nx)),
        h: Math.max(20, Math.min(Math.abs(p.y - ds.my), imgSize.h - ny)),
      });
    }
  }

  const containerStyle = {
    position: "relative", display: "inline-block", borderRadius: 6, overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)", cursor: dragging === "move" ? "grabbing" : "crosshair",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
      {loaded && (
        <div ref={containerRef} style={containerStyle}
          onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={() => { setDragging(null); dragStart.current = null; }}
          onMouseLeave={() => { setDragging(null); dragStart.current = null; }}>
          <img src={imgRef.current?.src} alt="crop" style={{ display: "block", maxWidth: "100%", maxHeight: 360 }} draggable={false} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${imgSize.w} ${imgSize.h}`} preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0 }}>
              <defs>
                <mask id="cropMask">
                  <rect x="0" y="0" width={imgSize.w} height={imgSize.h} fill="white" />
                  <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width={imgSize.w} height={imgSize.h} fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />
              <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="#ef4444" strokeWidth={2} />
            </svg>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => {
          if (!imgRef.current) return;
          const scale = imgRef.current.naturalWidth / imgSize.w;
          const c = document.createElement("canvas");
          c.width = crop.w * scale; c.height = crop.h * scale;
          const ctx = c.getContext("2d");
          ctx.drawImage(imgRef.current, crop.x * scale, crop.y * scale, c.width, c.height, 0, 0, c.width, c.height);
          c.toBlob(blob => { if (blob) onCrop(new File([blob], file.name, { type: "image/jpeg" })); }, "image/jpeg", 0.92);
        }} style={addBtnStyle}>Apply Crop</button>
        <button onClick={onCancel} style={dangerBtn}>Cancel</button>
      </div>
    </div>
  );
}

export default function HubMedia() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");
  const [folderFilter, setFolderFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Competition", description: "", year: new Date().getFullYear(), url: "", folder: "" });
  const [uploadMode, setUploadMode] = useState("file");
  const [file, setFile] = useState(null);
  const [toast, setToast] = useState("");
  const [cropFile, setCropFile] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Media · Team 4550";
    load();
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function load() {
    const r = await sbFetch("hub_media?select=*&order=created_at.desc");
    if (r) setItems(r);
  }

  async function submit() {
    if (!form.title) return showToast("Title required.");
    setUploading(true);
    let url = form.url;
    if (uploadMode === "file" && file) {
      url = await uploadFile(file, "team-media");
      if (!url) { showToast("Upload failed."); setUploading(false); return; }
    }
    if (!url) { showToast("Provide a file or URL."); setUploading(false); return; }

    const isVideo = url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo") || (file && file.type.startsWith("video"));
    try {
      await hubProxy("hub_media", "insert", { ...form, url, type: isVideo ? "video" : "image" });
      showToast("Added!");
    } catch (e) {
      showToast("Add failed: " + (e.message || e));
    }
    setAddModal(false);
    setFile(null);
    setForm({ title: "", category: "Competition", description: "", year: new Date().getFullYear(), url: "", folder: "" });
    setUploading(false);
    load();
  }

  async function deleteItem(id) {
    if (!confirm("Delete this item?")) return;
    try {
      await hubProxy("hub_media", "delete", { id });
      showToast("Deleted.");
    } catch (e) {
      showToast("Delete failed: " + (e.message || e));
    }
    setLightbox(null);
    load();
  }

  function getYoutubeId(url) {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return m ? m[1] : null;
  }

  function getThumbnail(item) {
    if (item.type === "video") {
      const ytId = getYoutubeId(item.url);
      if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
      return null;
    }
    return item.url;
  }

  const folders = [...new Set(items.map(i => i.folder || ""))].sort();

  const filtered = items.filter(i => {
    if (filter !== "All" && i.category !== filter) return false;
    if (folderFilter !== null && (i.folder || "") !== folderFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <HubBackground density={11000} opacity={0.28} />
      <style>{FONTS + `
        .media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
        @media(max-width:600px){ .media-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; } }
      `}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="📸 Media Gallery" />

      {/* Toolbar */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "rgba(13,17,23,0.8)" }}>
        {canEdit ? <button onClick={() => setAddModal(true)} style={addBtnStyle}>+ Add Media</button> : <div style={{ color: C.dim, fontSize: 12, fontFamily: "monospace", padding: "10px 0" }}>View only</div>}
        <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 180 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              background: filter === cat ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === cat ? "rgba(239,68,68,0.5)" : C.border}`,
              color: filter === cat ? C.red : C.muted,
              borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "monospace",
            }}>{cat}</button>
          ))}
        </div>
        {folders.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
            <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", padding: "5px 0", marginRight: 4 }}>Folders:</span>
            <button onClick={() => setFolderFilter(null)} style={{
              background: folderFilter === null ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${folderFilter === null ? "rgba(239,68,68,0.5)" : C.border}`,
              color: folderFilter === null ? C.red : C.muted,
              borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
            }}>All</button>
            <button onClick={() => setFolderFilter("")} style={{
              background: folderFilter === "" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${folderFilter === "" ? "rgba(239,68,68,0.5)" : C.border}`,
              color: folderFilter === "" ? C.red : C.muted,
              borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
            }}>Uncategorized</button>
            {folders.filter(f => f).map(f => (
              <button key={f} onClick={() => setFolderFilter(f)} style={{
                background: folderFilter === f ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${folderFilter === f ? "rgba(239,68,68,0.5)" : C.border}`,
                color: folderFilter === f ? C.red : C.muted,
                borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
              }}>{f}</button>
            ))}
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 12, color: C.dim, fontFamily: "monospace" }}>{filtered.length} items</div>
      </div>

      {/* Gallery */}
      <div style={{ padding: "20px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.dim, padding: "60px 0", fontFamily: "monospace" }}>
            No media yet. Click "Add Media" to upload photos or link videos.
          </div>
        )}
        <div className="media-grid">
          {filtered.map((item, i) => {
            const thumb = getThumbnail(item);
            return (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.04 }} whileHover={{ scale: 1.02, borderColor: "rgba(255,255,255,0.2)" }}
                onClick={() => setLightbox(item)} style={{ cursor: "pointer", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)" }}
              >
                <div style={{ width: "100%", aspectRatio: "16/10", background: "#0d1117", overflow: "hidden", position: "relative" }}>
                  {thumb ? (
                    <img src={thumb} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎬</div>
                  )}
                  {item.type === "video" && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                      <div style={{ width: 36, height: 36, background: "rgba(239,68,68,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>▶</div>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#aaa", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontFamily: "monospace" }}>{item.category}</div>
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginTop: 2, display: "flex", gap: 6 }}>
                    <span>{item.year}</span>
                    {item.folder && <span>· {item.folder}</span>}
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ ...overlayStyle, background: "rgba(0,0,0,0.92)" }} onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <div style={{ maxWidth: 860, width: "100%", padding: "0 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, fontWeight: 700, color: C.text }}>{lightbox.title}</div>
                <div style={{ fontSize: 12, color: C.dim, fontFamily: "monospace", marginTop: 2 }}>{lightbox.category} · {lightbox.year}{lightbox.folder ? ` · ${lightbox.folder}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {canEdit && <button onClick={() => deleteItem(lightbox.id)} style={dangerBtn}>Delete</button>}
                <button onClick={() => setLightbox(null)} style={ghostBtn}>✕ Close</button>
              </div>
            </div>
            {lightbox.type === "video" ? (
              (() => {
                const ytId = getYoutubeId(lightbox.url);
                return ytId ? (
                  <iframe style={{ width: "100%", aspectRatio: "16/9", border: "none", borderRadius: 8 }}
                    src={`https://www.youtube.com/embed/${ytId}`} allowFullScreen />
                ) : (
                  <video src={lightbox.url} controls style={{ width: "100%", borderRadius: 8 }} />
                );
              })()
            ) : (
              <img src={lightbox.url} alt={lightbox.title} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }} />
            )}
            {lightbox.description && <div style={{ marginTop: 12, color: C.muted, fontSize: 13, lineHeight: 1.6 }}>{lightbox.description}</div>}
          </div>
        </div>
      )}

      {/* Add modal */}
      {addModal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setAddModal(false); }}>
          <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 460 }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>Add Media</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Folder (optional)" value={form.folder} onChange={e => setForm({ ...form, folder: e.target.value })} list="media-folders" style={inputStyle} />
              <datalist id="media-folders">
                {folders.filter(f => f).map(f => <option key={f} value={f} />)}
              </datalist>
              <input type="number" placeholder="Year" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} style={inputStyle} />
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />

              {/* Upload mode toggle */}
              <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {["file", "url"].map(m => (
                  <button key={m} onClick={() => setUploadMode(m)} style={{ flex: 1, padding: "8px", background: uploadMode === m ? "rgba(239,68,68,0.2)" : "transparent", border: "none", color: uploadMode === m ? C.red : C.muted, cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                    {m === "file" ? "📁 Upload File" : "🔗 URL / YouTube"}
                  </button>
                ))}
              </div>

              {uploadMode === "file" ? (
                <div>
                  <button onClick={() => fileRef.current?.click()} style={{ ...ghostBtn, width: "100%", padding: "10px" }}>
                    {file ? `✓ ${file.name}` : "Choose image or video"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
                  {file && file.type.startsWith("image/") && (
                    <button onClick={() => setCropFile(file)} style={{ ...ghostBtn, width: "100%", padding: "8px", marginTop: 6, fontSize: 12, color: C.red, border: "1px solid rgba(239,68,68,0.3)" }}>
                      ✂️ Crop Image
                    </button>
                  )}
                </div>
              ) : (
                <input placeholder="https://youtube.com/watch?v=... or image URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={inputStyle} />
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={submit} disabled={uploading} style={{ ...addBtnStyle, flex: 1, opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading..." : "Add"}</button>
                <button onClick={() => setAddModal(false)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {cropFile && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setCropFile(null); }}>
          <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px", width: "100%", maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, letterSpacing: 2 }}>✂️ Crop Image</div>
            <CropTool file={cropFile} onCrop={cropped => { setFile(cropped); setCropFile(null); showToast("Image cropped!"); }} onCancel={() => setCropFile(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
