import { useEffect, useState } from "react";
import Starfield from "./Starfield.jsx";
import { sbFetch } from "./hubUtils.jsx";

export default function ArticleView() {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) { setLoading(false); return; }
    sbFetch(`articles?id=eq.${id}&select=*`).then(r => {
      if (r?.[0]) setArticle(r[0]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (article) document.title = `${article.title} · Team 4550`;
  }, [article]);

  if (loading) return null;
  if (!article) {
    return (
      <div style={{ minHeight: "100vh", background: "#080a0f", color: "#f1f5f9", fontFamily: "'Exo 2',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <Starfield density={9000} opacity={0.38} />
        <div style={{ fontSize: 14, color: "#64748b", fontFamily: "monospace", position: "relative", zIndex: 1 }}>Article not found.</div>
        <a href="/" style={{ color: "#ef4444", fontFamily: "monospace", fontSize: 12, position: "relative", zIndex: 1 }}>← Back to home</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080a0f", color: "#f1f5f9", fontFamily: "'Exo 2',sans-serif", position: "relative" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <Starfield density={9000} opacity={0.38} />
      </div>
      <style>{articleStyles}</style>

      <div className="article-page" style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "80px 24px 60px" }}>
        <a href="/" style={{ color: "#64748b", textDecoration: "none", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, marginBottom: 24, display: "inline-block" }}>← Back to Home</a>

        {article.image_url && (
          <div style={{ width: "100%", height: 320, borderRadius: 12, overflow: "hidden", marginBottom: 28, background: `url(${article.image_url}) center/cover` }} />
        )}

        <h1>{article.title}</h1>

        <div style={{ fontSize: 12, color: "#64748b", fontFamily: "'Share Tech Mono',monospace", marginBottom: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
          {article.author && <span>By {article.author}</span>}
          <span>{new Date(article.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>

        {article.excerpt && (
          <p style={{ fontSize: 16, color: "#94a3b8", lineHeight: 1.8, marginBottom: 32, fontStyle: "italic" }}>{article.excerpt}</p>
        )}

        <div className="paper-texture article-content" style={{ borderRadius: 8, padding: "32px 36px" }}>
          <div dangerouslySetInnerHTML={{ __html: article.content || "" }} />
        </div>
      </div>

      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 32px", textAlign: "center" }}>
        <div style={{ color: "#334155", fontSize: 11, fontFamily: "'Share Tech Mono', monospace" }}>
          &copy; {new Date().getFullYear()} FRC Team 4550 Something's Bruin &middot; <a href="/" style={{ color: "#64748b", textDecoration: "none" }}>Home</a>
        </div>
      </footer>
    </div>
  );
}

const articleStyles = `
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap');

.article-page h1 {
  font-family: 'Orbitron', sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: #ef4444;
  margin-bottom: 8px;
  letter-spacing: 1px;
  line-height: 1.3;
}

.paper-texture {
  position: relative;
  background: #1c1814;
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

.article-content {
  position: relative;
  z-index: 2;
  color: #e8e0d0 !important;
  font-family: 'Merriweather', 'Georgia', serif !important;
  font-size: 15px;
  line-height: 1.9;
}

.article-content p {
  margin-bottom: 16px;
  color: #d4cdc0;
}

.article-content h2 {
  font-family: 'Orbitron', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 32px;
  margin-bottom: 12px;
  letter-spacing: 0.5px;
}

.article-content h3 {
  font-family: 'Orbitron', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  margin-top: 24px;
  margin-bottom: 8px;
}

.article-content ul, .article-content ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

.article-content li {
  margin-bottom: 6px;
  color: #d4cdc0;
}

.article-content a {
  color: #fca5a5;
  text-decoration: underline;
}

.article-content a:hover {
  color: #ef4444;
}

.article-content blockquote {
  border-left: 3px solid rgba(239,68,68,0.4);
  padding-left: 16px;
  margin: 20px 0;
  color: #c0b8a8;
  font-style: italic;
}

.article-content img {
  max-width: 100%;
  border-radius: 8px;
  margin: 20px 0;
}

.article-content code {
  background: rgba(0,0,0,0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #fca5a5;
  font-family: 'Share Tech Mono', monospace;
}

.article-content pre {
  background: rgba(0,0,0,0.4);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.article-content pre code {
  background: none;
  padding: 0;
}
`;
