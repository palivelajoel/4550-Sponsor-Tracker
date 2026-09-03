import { useState, useEffect } from "react";
import Starfield from "./Starfield.jsx";

async function sbFetch(path) {
  const res = await fetch(`/api/d1/${path}`);
  if (!res.ok) return null;
  return res.json();
}

const SECTIONS = [
  { id: "competitions", label: "Competitions", icon: "🏆", categories: ["Competition"] },
  { id: "outreach", label: "Outreach", icon: "🤝", categories: ["Outreach"] },
  { id: "our-team", label: "Our Team", icon: "👥", categories: ["Team", "Build Season"] },
  { id: "other", label: "Other", icon: "📁", categories: ["Other"] },
];

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

export default function PublicMedia() {
  const [items, setItems] = useState([]);
  const [activeYear, setActiveYear] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    document.title = "Media Gallery · Team 4550";
    sbFetch("hub_media?select=*&order=created_at.desc").then(r => {
      if (r) setItems(r);
      setLoading(false);
    });
  }, []);

  const years = [...new Set(items.map(i => i.year).filter(Boolean))].sort((a, b) => b - a);
  const activeAlbum = activeYear || years[0] || null;

  const albumItems = items.filter(i => String(i.year) === String(activeAlbum));

  return (
    <div style={{ minHeight: "100vh", background: "#080a0f", color: "#f1f5f9", fontFamily: "'Exo 2', sans-serif" }}>
      <Starfield density={9000} opacity={0.28} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#080a0f;padding-top:env(safe-area-inset-top,0px);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0d1117;}::-webkit-scrollbar-thumb{background:#ef4444;border-radius:3px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        .gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;}
        @media(max-width:600px){.gallery-grid{grid-template-columns:repeat(2,1fr);gap:8px;}}
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: "env(safe-area-inset-top,0px)", zIndex: 100, background: "rgba(8,10,15,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 16px" : "14px 28px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 12, fontFamily: "monospace" }}>← Home</a>
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 13 : 16, color: "#ef4444", letterSpacing: 2 }}>MEDIA GALLERY</span>
          </div>
          <a href="/member-hub" style={{ border: "1px solid #ef4444", color: "#ef4444", padding: "6px 14px", borderRadius: 4, textDecoration: "none", fontSize: 11, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>MEMBERS</a>
        </div>
      </header>

      {/* Year album tabs */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 14px 0" : "24px 28px 0" }}>
        {loading ? null : years.length === 0 ? null : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 4 }}>
            {years.map((y, yi) => {
              const count = items.filter(i => String(i.year) === String(y)).length;
              const isActive = String(activeAlbum) === String(y);
              return (
                <button key={y} onClick={() => setActiveYear(y)} style={{
                  background: isActive ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
                  color: isActive ? "#ef4444" : "#94a3b8",
                  borderRadius: 12, padding: "10px 22px", cursor: "pointer",
                  fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: 1,
                  transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
                }}>
                  {y}
                  <span style={{ fontSize: 11, opacity: 0.7, fontFamily: "monospace", fontWeight: 400 }}>{count}</span>
                </button>
            );
            })}
          </div>
        )}
      </div>

      {/* Gallery grouped by category within the year */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "16px 14px 40px" : "24px 28px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "60px 0", fontFamily: "monospace", fontSize: 13 }}>Loading gallery...</div>
        ) : !activeAlbum || albumItems.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "60px 0", fontFamily: "monospace", fontSize: 13 }}>
            No media yet.
          </div>
        ) : (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            {SECTIONS.map(section => {
              const sectionItems = albumItems.filter(i => section.categories.includes(i.category));
              if (sectionItems.length === 0) return null;
              return (
                <div key={section.id} style={{ marginBottom: 32 }}>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{section.icon}</span> {section.label}
                    <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", fontWeight: 400 }}>{sectionItems.length}</span>
                  </div>
                  <div className="gallery-grid">
                    {sectionItems.map((item, gi) => {
                      const thumb = getThumbnail(item);
                      return (
                        <div key={item.id} onClick={() => setLightbox(item)} style={{
                          cursor: "pointer", borderRadius: 8, overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)",
                          transition: "transform 0.15s, border-color 0.15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                        >
                          <div style={{ width: "100%", aspectRatio: "16/10", background: "#0d1117", overflow: "hidden", position: "relative" }}>
                            {thumb ? (
                              <img src={thumb} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                            ) : (
                              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎬</div>
                            )}
                            {item.type === "video" && (
                              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                                <div style={{ width: 36, height: 36, background: "rgba(239,68,68,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff" }}>▶</div>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                            <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>{item.year}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 16, backdropFilter: "blur(8px)",
        }} onClick={e => { if (e.target === e.currentTarget) setLightbox(null); }}>
          <div style={{ maxWidth: 860, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{lightbox.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>{lightbox.category} · {lightbox.year}</div>
              </div>
              <button onClick={() => setLightbox(null)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>✕ Close</button>
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
            {lightbox.description && <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>{lightbox.description}</div>}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "24px 18px" : "32px 28px", textAlign: "center" }}>
        <a href="/" style={{ color: "#64748b", textDecoration: "none", fontSize: 12, fontFamily: "monospace" }}>← Back to Team 4550 Site</a>
      </footer>
    </div>
  );
}
