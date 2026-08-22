import { useState, useEffect } from "react";
import { sbFetch, hubProxy, isCaptainOrAbove } from "./hubUtils.jsx";
import HubBackground from "./HubBackground.jsx";

const C = {
  bg: "#080a0f", text: "#f1f5f9", border: "rgba(255,255,255,0.08)",
  dim: "#64748b", muted: "#94a3b8", red: "#ef4444", surface: "rgba(255,255,255,0.04)",
};

export default function HubArticles() {
  const [articles, setArticles] = useState([]);
  const [editId, setEditId] = useState(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const canEdit = isCaptainOrAbove();

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  async function load() {
    const r = await sbFetch("articles?select=*&order=created_at.desc");
    if (r) setArticles(r);
  }

  useEffect(() => { load(); }, []);

  function startEdit(a) {
    if (!a) {
      setEditId(null); setTitle(""); setExcerpt(""); setContent(""); setImageUrl(""); setPublished(false);
      return;
    }
    setEditId(a.id); setTitle(a.title); setExcerpt(a.excerpt || ""); setContent(a.content || ""); setImageUrl(a.image_url || ""); setPublished(a.published || false);
  }

  async function save() {
    if (!title.trim()) { setMsg("Title is required."); return; }
    setSaving(true); setMsg("");
    try {
      const payload = { title: title.trim(), excerpt: excerpt.trim(), content, image_url: imageUrl.trim(), published, author: localStorage.getItem("hub_username") };
      if (editId) {
        await hubProxy("articles", "update", { id: editId, updates: payload });
      } else {
        await hubProxy("articles", "insert", payload);
      }
      setMsg("Saved!");
      startEdit(null);
      load();
    } catch (e) { setMsg("Error: " + e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!window.confirm("Delete this article?")) return;
    try {
      await hubProxy("articles", "delete", { id });
      load();
    } catch (e) { setMsg("Error: " + e.message); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2',sans-serif", padding: isMobile ? "16px" : "24px 32px", position: "relative" }}>
      <HubBackground density={11000} opacity={0.28} />
      <style>{paperStyles}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: isMobile ? 17 : 22, fontWeight: 700, color: C.text }}>📝 Articles</div>
          <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", marginTop: 4 }}>Blog posts and outreach articles</div>
        </div>
        {canEdit && (
          <button onClick={() => startEdit(null)}
            style={{ background: C.red, border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>
            + NEW ARTICLE
          </button>
        )}
      </div>

      {msg && <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontSize: 13, fontFamily: "monospace", color: "#86efac" }}>{msg}</div>}

      {/* Editor */}
      <div style={{ display: editId !== undefined ? "block" : "none", marginBottom: 28 }}>
        <div style={{ marginBottom: 12 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Article title"
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", color: C.text, fontSize: 18, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, letterSpacing: 1 }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Cover image URL (optional)"
            style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, fontFamily: "monospace" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Short excerpt / summary (optional)"
            rows={2} style={{ width: "100%", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", color: C.text, fontSize: 13, fontFamily: "monospace", resize: "vertical" }} />
        </div>
        <div className="paper-texture" style={{ marginBottom: 12 }}>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your article here... (HTML supported)"
            rows={16} className="paper-textarea"
            style={{ width: "100%", border: "none", borderRadius: 8, padding: "24px 28px", color: "#e8e0d0", fontSize: 15, fontFamily: "'Merriweather','Georgia',serif", lineHeight: 1.9, resize: "vertical", minHeight: 320 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, fontFamily: "monospace", cursor: "pointer" }}>
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
            Published
          </label>
          <button onClick={save} disabled={saving}
            style={{ background: C.red, border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving..." : editId ? "UPDATE" : "PUBLISH"}
          </button>
          {editId && (
            <button onClick={() => startEdit(null)}
              style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 20px", color: C.muted, fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Article list */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {articles.map(a => (
          <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            {a.image_url && (
              <div style={{ width: "100%", height: 160, background: `url(${a.image_url}) center/cover`, borderBottom: `1px solid ${C.border}` }} />
            )}
            <div style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                {a.published ? (
                  <span style={{ fontSize: 10, background: "rgba(34,197,94,0.15)", color: "#86efac", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", fontWeight: 700 }}>PUBLISHED</span>
                ) : (
                  <span style={{ fontSize: 10, background: "rgba(245,158,11,0.15)", color: "#fcd34d", padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", fontWeight: 700 }}>DRAFT</span>
                )}
                <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: isMobile ? 13 : 14, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: 0.5 }}>{a.title}</div>
              {a.excerpt && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>{a.excerpt}</div>}
              {a.author && <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", marginBottom: 10 }}>By {a.author}</div>}
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(a)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 14px", color: C.muted, fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => remove(a.id)} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "6px 14px", color: C.red, fontFamily: "monospace", fontSize: 11, cursor: "pointer" }}>Delete</button>
                  {a.published && (
                    <a href={"/article?id=" + a.id} target="_blank" rel="noreferrer"
                      style={{ background: "transparent", border: `1px solid rgba(59,130,246,0.3)`, borderRadius: 6, padding: "6px 14px", color: "#93c5fd", fontFamily: "monospace", fontSize: 11, cursor: "pointer", textDecoration: "none" }}>
                      View
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {articles.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: C.dim, fontSize: 13, fontFamily: "monospace" }}>
            No articles yet. {canEdit ? "Click + NEW ARTICLE to create one." : ""}
          </div>
        )}
      </div>
    </div>
  );
}

const paperStyles = `
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');

.paper-texture {
  position: relative;
  background: #1c1814;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
}

.paper-texture::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
  pointer-events: none;
  z-index: 1;
}

.paper-textarea {
  position: relative;
  z-index: 2;
  background: transparent !important;
}
`;
