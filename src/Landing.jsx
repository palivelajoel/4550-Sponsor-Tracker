import { useEffect, useRef, useState } from "react";
import Starfield from "./Starfield.jsx";
import { CaptainPhoto } from "./hubUtils.jsx";

// Distorted grid that warps on scroll (ref-based, no React re-renders)
function DistortedGrid() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ticking = false;
    const handler = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { const sy = window.scrollY; el.style.transform = `perspective(500px) rotateX(${Math.sin(sy * 0.003) * 2}deg) skewY(${sy * 0.001}deg)`; el.style.filter = `blur(${Math.min(sy * 0.015, 3)}px)`; el.style.opacity = Math.max(1 - sy * 0.0008, 0.3); ticking = false; }); }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return (
    <div ref={ref} style={{
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      backgroundImage: "linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)",
      backgroundSize: "44px 44px",
      transition: "transform 0.1s ease-out, filter 0.1s ease-out",
    }} />
  );
}

// Subtle bear / Bruin references scattered in the background
function BruinBg() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      <div style={{ position: "absolute", top: "18%", left: "2%", fontSize: 140, fontWeight: 900, color: "rgba(239,68,68,0.025)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(-12deg)", letterSpacing: 24, whiteSpace: "nowrap" }}>BRUIN</div>
      <div style={{ position: "absolute", bottom: "28%", right: "1%", fontSize: 100, fontWeight: 900, color: "rgba(59,130,246,0.025)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(8deg)", letterSpacing: 18, whiteSpace: "nowrap" }}>BEAR DOWN</div>
      <div style={{ position: "absolute", top: "55%", left: "55%", fontSize: 70, fontWeight: 900, color: "rgba(239,68,68,0.02)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(-6deg)", letterSpacing: 12, whiteSpace: "nowrap" }}>#BRUINNATION</div>
      <div style={{ position: "absolute", top: "5%", right: "12%", fontSize: 50, fontWeight: 900, color: "rgba(239,68,68,0.015)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(20deg)", letterSpacing: 8, whiteSpace: "nowrap" }}>GO BRUINS</div>
      <div style={{ position: "absolute", bottom: "50%", left: "35%", fontSize: 36, fontWeight: 900, color: "rgba(59,130,246,0.015)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(-2deg)", letterSpacing: 6, whiteSpace: "nowrap" }}>#BEARPRIDE</div>
      <span style={{ position: "absolute", top: "12%", left: "78%", fontSize: 32, opacity: 0.035 }}>🐻</span>
      <span style={{ position: "absolute", top: "70%", left: "8%", fontSize: 26, opacity: 0.03 }}>🐻</span>
      <span style={{ position: "absolute", top: "38%", left: "42%", fontSize: 20, opacity: 0.025 }}>🐻</span>
      <span style={{ position: "absolute", top: "4%", left: "28%", fontSize: 18, opacity: 0.02 }}>🐻</span>
      <span style={{ position: "absolute", bottom: "8%", left: "72%", fontSize: 28, opacity: 0.03 }}>🐻</span>
      <span style={{ position: "absolute", top: "82%", left: "45%", fontSize: 22, opacity: 0.02 }}>🐻</span>
      <svg style={{ position: "absolute", top: "25%", left: "70%", width: 40, height: 40, opacity: 0.025 }} viewBox="0 0 100 100">
        <path d="M50 15 C35 15 25 25 25 40 C25 55 35 65 50 80 C65 65 75 55 75 40 C75 25 65 15 50 15Z" fill="#ef4444" />
        <circle cx="38" cy="35" r="6" fill="#080a0f" /><circle cx="62" cy="35" r="6" fill="#080a0f" />
        <circle cx="50" cy="48" r="8" fill="#080a0f" />
      </svg>
      <svg style={{ position: "absolute", bottom: "15%", right: "20%", width: 32, height: 32, opacity: 0.02 }} viewBox="0 0 100 100">
        <path d="M50 15 C35 15 25 25 25 40 C25 55 35 65 50 80 C65 65 75 55 75 40 C75 25 65 15 50 15Z" fill="#3b82f6" />
        <circle cx="38" cy="35" r="6" fill="#080a0f" /><circle cx="62" cy="35" r="6" fill="#080a0f" />
        <circle cx="50" cy="48" r="8" fill="#080a0f" />
      </svg>
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function useDeviceSize() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

function useScrollY(disabled) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (disabled) return;
    const fn = () => setY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [disabled]);
  return y;
}

function ParticleCanvas({ isMobile }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const ptCount = Math.min(Math.floor((W * H) / (isMobile ? 30000 : 20000)), 120);
    const pts = Array.from({ length: ptCount }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
    }));
    let frameSkip = 0;
    function draw() {
      frameSkip = (frameSkip + 1) % 2;
      if (frameSkip === 0) { animRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", onResize); };
  }, [isMobile]);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.6 }} />;
}

function SponsorBar({ sponsors = [], isMobile }) {
  const shown = sponsors.filter(s => s.company);
  if (shown.length === 0) return null;
  const items = shown.map(s => ({ company: s.company, logo_url: s.logo_url }));
  const duped = [...items, ...items, ...items];
  const speed = Math.max(20, items.length * 3);
  return (
    <div style={{ width: "100%", overflow: "hidden", background: "rgba(8,10,15,0.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "80px 0", position: "relative" }}>
      <style>{`@keyframes sponsorCardMarquee{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-33.333%,0,0)}}`}</style>
      <div style={{ display: "flex", gap: 16, willChange: "transform", animation: `sponsorCardMarquee ${speed}s linear infinite`, width: "max-content" }}
        onMouseEnter={e => { e.currentTarget.style.transition = "opacity 0.3s ease"; e.currentTarget.style.opacity = "0.5"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
        {duped.map((s, i) => (
          <div key={i} style={{ width: isMobile ? 140 : 180, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "18px 12px" : "24px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: isMobile ? 100 : 120 }}>
            {s.logo_url ? (
              <img src={s.logo_url} alt="" style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, objectFit: "contain", borderRadius: 6, background: "rgba(255,255,255,0.05)" }}
                onError={e => { e.target.style.display = "none"; }} />
            ) : (
              <div style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius: 6, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#475569" }}>🏢</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FadeSection({ children, style }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(24px)", transition: "opacity 0.65s ease, transform 0.65s ease", ...style }}>
      {children}
    </div>
  );
}

export default function Landing() {
  const isMobile = useDeviceSize();
  const [config, setConfig] = useState({});
  const [captains, setCaptains] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [logoUrl, setLogoUrl] = useState("/logo.jpg");
  const [menuOpen, setMenuOpen] = useState(false);
  const heroParallaxRef = useRef(null);

  useEffect(() => {
    document.title = "Team 4550 Something's Bruin";
    sbFetch("site_config?select=key,value").then(rows => {
      if (!rows) return;
      const obj = {};
      rows.forEach(r => { obj[r.key] = r.value; });
      setConfig(obj);
    if (obj.logo_url) setLogoUrl(obj.logo_url);
    });
    sbFetch("captains?select=*&order=sort_order.asc").then(r => { if (r) setCaptains(r); });
    sbFetch("sponsors?select=company,logo_url,tier,email&order=company.asc&status=not.eq.Declined").then(r => { if (r) setSponsors(r); });
  }, []);

  // Hero parallax via ref (no React re-renders)
  useEffect(() => {
    if (isMobile) return;
    const el = heroParallaxRef.current;
    if (!el) return;
    let ticking = false;
    const handler = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { el.style.transform = `translateY(${window.scrollY * 0.15}px)`; ticking = false; }); }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [isMobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener("scroll", handler, { once: true, passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [menuOpen]);

  const email = config.team_email || "team4550frc@gmail.com";
  const ig = config.instagram || "https://www.instagram.com/cherrycreek.robotics";

  const yt = config.youtube || "https://www.youtube.com/channel/UC4_P1A5xYb7A7rCdEXdKzBQ";
  const donate = config.donate_url || "https://www.vancoevents.com/us/events/landing/46671";

  const navItems = ["About", "Team", "Sub-Teams", "Outreach", "Media Gallery", "Sponsors", "Contact"];

  const SUB_TEAMS = [
    {
      name: "Build",
      icon: "🔧",
      description: "The mechanical backbone of the team. Build designs, fabricates, and assembles our competition robot from raw materials. Members learn CAD, machining, welding, and hands-on mechanical engineering — all in a six-week build season sprint.",
      color: "#f59e0b",
    },
    {
      name: "Programming",
      icon: "💻",
      description: "The brain of the robot. Programming develops all software that controls autonomous routines, driver controls, sensor integration, and computer vision. Members work in Java with WPILib and contribute to real-time embedded systems.",
      color: "#3b82f6",
    },
    {
      name: "Marketing & Outreach",
      icon: "📢",
      description: "The voice of the team. Marketing & Outreach handles sponsor outreach, social media, community events, STEM education programs, and team branding. Members build real-world skills in communications, graphic design, and community leadership.",
      color: "#22c55e",
    },
  ];

  return (
    <div style={{ background: "transparent", color: "#f1f5f9", fontFamily: "'Exo 2', sans-serif", overflowX: "hidden", overflow:"hidden", position: "relative", minHeight: "100vh" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <Starfield density={9000} opacity={0.38} />
        {[{ s:500, t:"-20%", l:"-15%", c:"rgba(239,68,68,0.07)", d:"0s" }, { s:350, b:"-10%", r:"-10%", c:"rgba(59,130,246,0.05)", d:"1.5s" }, { s:250, t:"45%", r:"15%", c:"rgba(168,85,247,0.04)", d:"0.8s" }].map((o,i) => (
          <div key={i} style={{ position:"absolute", width:o.s, height:o.s, top:o.t, bottom:o.b, left:o.l, right:o.r, borderRadius:"50%", background:`radial-gradient(circle, ${o.c}, transparent)`, animation:`orbFloat ${6+i}s ease-in-out infinite`, animationDelay:o.d }} />
        ))}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
        <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation:"scanline 4s linear infinite", top:"-4px" }} />
      </div>
      <BruinBg />
      {/* Distorted grid that warps on scroll */}
        <DistortedGrid />
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&family=Bebas+Neue&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;-webkit-tap-highlight-color:transparent;}
        body{background:#080a0f;padding-top:env(safe-area-inset-top,0px);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0d1117;}::-webkit-scrollbar-thumb{background:#ef4444;border-radius:3px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes menuSlide{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes orbFloat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
        @keyframes scanline{0%{top:-4px;}100%{top:100%;}}

        a{-webkit-tap-highlight-color:transparent;}
        /* Make sections semi-transparent to show the grid */
        section,footer,nav{position:relative;z-index:1;background:rgba(8,10,15,0.85);backdrop-filter:blur(10px);}
        .sec{padding:80px 24px;max-width:1100px;margin:0 auto;position:relative;z-index:1;}
        .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;}
        .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .subteams-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .outreach-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .captains-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:22px;}
        .media-row{display:flex;gap:20px;flex-wrap:wrap;}
        .media-card{flex:1 1 200px;}
        .contact-row{display:flex;gap:28px;justify-content:center;flex-wrap:wrap;margin-top:24px;}
        .footer-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:20px;}
        .footer-links{display:flex;gap:18px;flex-wrap:wrap;}
        .tier-row{display:flex;gap:12px;justify-content:center;margin-bottom:28px;flex-wrap:wrap;}
        @media(max-width:767px){
          .sec{padding:56px 18px;}
          .about-grid{grid-template-columns:1fr;gap:28px;}
          .subteams-grid{grid-template-columns:1fr;gap:14px;}
          .outreach-grid{grid-template-columns:1fr;gap:14px;}
          .captains-grid{grid-template-columns:1fr 1fr;gap:12px;}
          .media-row{flex-direction:column;gap:12px;}
          .contact-row{flex-direction:column;align-items:center;gap:14px;}
          .footer-top{flex-direction:column;align-items:flex-start;}
          .footer-links{gap:12px;}
          .tier-row{gap:8px;}
        }
        @media(max-width:480px){
          .captains-grid{grid-template-columns:1fr;}
          .stats-grid{gap:8px;}
        }
        @keyframes glitch{0%,90%,100%{text-shadow:none;}92%{text-shadow:-3px 0 #ef4444,3px 0 #3b82f6;}95%{text-shadow:3px 0 #ef4444,-3px 0 #3b82f6;}97%{text-shadow:none;}}
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: "env(safe-area-inset-top,0px)", left: 0, right: 0, zIndex: 1000, background: "rgba(8,10,15,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 18px" : "14px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img src={logoUrl} alt="logo" style={{ width: isMobile ? 30 : 34, height: isMobile ? 30 : 34, borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "#ef4444", letterSpacing: isMobile ? 1 : 2 }}>
              {isMobile ? "4550" : "SOMETHING'S BRUIN"}
            </span>
          </div>
          {!isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              {navItems.map(l => <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13, fontFamily: "'Share Tech Mono', monospace" }}>{l}</a>)}
              <a href="/member-hub" style={{ border: "1px solid #ef4444", color: "#ef4444", padding: "7px 16px", borderRadius: 4, textDecoration: "none", fontSize: 12, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>FOR MEMBERS ›</a>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href="/member-hub" style={{ border: "1px solid #ef4444", color: "#ef4444", padding: "6px 12px", borderRadius: 4, textDecoration: "none", fontSize: 10, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>MEMBERS</a>
              <button onClick={() => setMenuOpen(o => !o)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5 }} aria-label="Menu">
                <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "#ef4444" : "#94a3b8", transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
                <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "transparent" : "#94a3b8", transition: "all 0.2s" }} />
                <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "#ef4444" : "#94a3b8", transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
              </button>
            </div>
          )}
        </div>
        {isMobile && menuOpen && (
          <div style={{ background: "rgba(13,17,23,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 0 12px", animation: "menuSlide 0.2s ease" }}>
            {navItems.map(l => <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "13px 20px", color: "#94a3b8", textDecoration: "none", fontSize: 14, fontFamily: "'Share Tech Mono', monospace", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{l}</a>)}
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,rgba(8,10,15,1) 0%,rgba(13,17,23,0.85) 100%)", paddingTop: isMobile ? 130 : 70, position: "relative", overflow: "hidden" }}>
        <ParticleCanvas isMobile={isMobile} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize: isMobile ? "40px 40px" : "60px 60px", pointerEvents: "none" }} />
        
          <div ref={heroParallaxRef} style={{ textAlign: "center", zIndex: 1, padding: isMobile ? "0 20px" : "0 24px", transform: isMobile ? "none" : "none" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: isMobile ? 9 : 11, color: "#64748b", letterSpacing: isMobile ? 2 : 3, marginBottom: 20 }}>FRC ROBOTICS · CHERRY CREEK HIGH SCHOOL · GREENWOOD VILLAGE, CO</div>
            <img src={logoUrl} alt="Team Logo" style={{ width: isMobile ? 88 : 110, height: isMobile ? 88 : 110, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(239,68,68,0.4)", boxShadow: "0 0 40px rgba(239,68,68,0.2)", marginBottom: isMobile ? 20 : 28, animation: "fadeUp 0.8s ease both" }} />
            <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 900, fontSize: isMobile ? "clamp(22px,8vw,40px)" : "clamp(32px,6vw,72px)", letterSpacing: isMobile ? 2 : 4, color: "#f1f5f9",         animation: "fadeUp 0.8s ease 0.15s both, glitch 10s ease-in-out infinite" }}>SOMETHING'S BRUIN</h1>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? "clamp(16px,5vw,24px)" : "clamp(18px,3vw,32px)", color: "#ef4444", letterSpacing: isMobile ? 6 : 8, marginTop: 6,         animation: "fadeUp 0.8s ease 0.25s both, glitch 12s ease-in-out infinite 2s" }}>FRC TEAM 4550</div>
            <div style={{ width: 50, height: 2, background: "linear-gradient(90deg,transparent,#ef4444,transparent)", margin: isMobile ? "18px auto" : "24px auto", animation: "fadeUp 0.8s ease 0.35s both" }} />
            <p style={{ color: "#94a3b8", fontSize: isMobile ? 14 : 16, maxWidth: 420, margin: "0 auto", marginBottom: isMobile ? 28 : 36, lineHeight: 1.7, minHeight: isMobile ? 44 : 28, padding: "0 8px" }}>
              Engineering excellence. Community impact. Championship mindset.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animation: "fadeUp 0.8s ease 0.5s both" }}>
              <a href="#about" style={{ background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>LEARN MORE</a>
              <a href={donate} target="_blank" rel="noreferrer" style={{ background: "transparent", color: "#ef4444", textDecoration: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 6, border: "1px solid #ef4444", fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>SUPPORT US</a>
            </div>
          </div>
        
      </section>

      {/* ABOUT */}
      <section id="about"><div className="sec">
        
          <FadeSection>
            <Eyebrow>// WHO WE ARE</Eyebrow>
            <SectionTitle>About the Team</SectionTitle>
            <div className="about-grid">
              <div>
                <p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: 15 }}>FRC Team 4550 "Something's Bruin" has been competing since 2012, representing Cherry Creek High School in FIRST Robotics Competition. Our team of 40–50 student engineers, programmers, and designers builds competition-ready robots each season — from scratch, in six weeks.</p>
                <p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: 15, marginTop: 14 }}>We've competed at the 2016 World Championship and continue to push the boundaries of what student-built robots can achieve. Beyond the robot, we're deeply committed to STEM outreach and community impact across the Denver metro area.</p>
              </div>
              <div className="stats-grid">
                {[{ num: "12+", label: "Years Competing" }, { num: "40–50", label: "Members" }, { num: "2016", label: "World Championship" }, { num: "3", label: "Sub-Teams" }].map((s, i) => (
                  <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "18px 14px" : "24px 20px", textAlign: "center" }}>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#ef4444" }}>{s.num}</div>
                    <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeSection>
        
      </div></section>

      {/* OUR TEAM */}
      {captains.length > 0 && (
        <section id="team" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
          
            <FadeSection>
              <Eyebrow>// LEADERSHIP</Eyebrow>
              <SectionTitle>Our Team</SectionTitle>
              <div className="captains-grid">
                {captains.map((c, i) => (
                  <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: isMobile ? "20px 14px" : "26px 20px", textAlign: "center" }}>
                    <CaptainPhoto photoUrl={c.photo_url} name={c.name} size={isMobile ? 70 : 88} style={{ display: "block", margin: "0 auto 12px", borderWidth: 2, borderStyle: "solid", borderColor: "rgba(239,68,68,0.4)" }} />
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ef4444", letterSpacing: 2, marginBottom: c.bio ? 8 : 0 }}>{c.position}</div>
                    {c.bio && <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>{c.bio}</p>}
                  </div>
                ))}
              </div>
            </FadeSection>
          
        </div></section>
      )}

      {/* SUB-TEAMS */}
      <section id="sub-teams"><div className="sec">
        
          <FadeSection>
            <Eyebrow>// HOW WE BUILD</Eyebrow>
            <SectionTitle>Sub-Teams</SectionTitle>
            <div className="subteams-grid">
              {SUB_TEAMS.map((st, i) => (
                <div key={st.name} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.08)`, borderTop: `3px solid ${st.color}`, borderRadius: 10, padding: isMobile ? "22px 18px" : "28px 24px" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{st.icon}</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 12, letterSpacing: 1 }}>{st.name}</div>
                  <p style={{ color: "#94a3b8", lineHeight: 1.75, fontSize: 14 }}>{st.description}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        
      </div></section>

      {/* OUTREACH */}
      <section id="outreach" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
        
          <FadeSection>
            <Eyebrow>// COMMUNITY</Eyebrow>
            <SectionTitle>Community Outreach</SectionTitle>
            <div className="outreach-grid">
              {[
                { icon: "🤖", title: "Team Mentoring", desc: "We mentor younger FRC and FLL teams throughout the Denver metro area, sharing technical knowledge and competition experience." },
                { icon: "🏫", title: "School Outreach", desc: "Visiting local elementary and middle schools to inspire the next generation of engineers through hands-on robotics demos." },
                { icon: "🌍", title: "Community Events", desc: "Participating in local STEM fairs, library events, and community festivals to promote robotics and engineering education." },
              ].map((o, i) => (
                <div key={o.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "22px 18px" : "28px 24px" }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{o.icon}</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>{o.title}</div>
                  <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: 14 }}>{o.desc}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        
      </div></section>

      {/* MEDIA */}
      <section id="media-gallery"><div className="sec">
        
          <FadeSection>
            <Eyebrow>// GALLERY</Eyebrow>
            <SectionTitle>Media Gallery</SectionTitle>
            <p style={{ color: "#94a3b8", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.8, fontSize: 15, textAlign: "center" }}>Browse photos and videos from competitions, outreach events, build season, and team activities.</p>
            <div style={{ textAlign: "center" }}>
              <a href="/media" style={{ display: "inline-block", background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 28px" : "14px 36px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>EXPLORE GALLERY →</a>
            </div>
          </FadeSection>
        
      </div></section>

      {/* SOCIAL MEDIA */}
      <section id="media" style={{ background: "rgba(8,10,15,0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}><div className="sec">
        
          <FadeSection>
            <Eyebrow>// FOLLOW ALONG</Eyebrow>
            <SectionTitle>Social Media</SectionTitle>
            <div className="media-row">
              {[
                { href: ig, icon: "📸", title: "Instagram", handle: "@cherrycreek.robotics", border: "rgba(59,130,246,0.3)" },
                { href: yt, icon: "▶️", title: "YouTube", handle: "Team 4550 Something's Bruin", border: "rgba(239,68,68,0.3)" },
              ].map((m, i) => (
                <a key={m.title} href={m.href} target="_blank" rel="noreferrer" className="media-card" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.border}`, borderRadius: 10, padding: isMobile ? "24px 18px" : "32px 24px", textDecoration: "none", textAlign: "center", display: "block" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{m.title}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#64748b" }}>{m.handle}</div>
                </a>
              ))}
            </div>
          </FadeSection>
        
      </div></section>

      {config.sponsor_bar_enabled !== "false" && (() => { try { const items = JSON.parse(config.sponsor_ribbon_items || "[]"); return <SponsorBar sponsors={items} isMobile={isMobile} />; } catch { return null; } })()}

      {/* SPONSORS */}
      <section id="sponsors" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
        
          <FadeSection>
            <div style={{ textAlign: "center" }}>
              <Eyebrow>// PARTNER WITH US</Eyebrow>
              <SectionTitle>Become a Sponsor</SectionTitle>
              <p style={{ color: "#94a3b8", maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.8, fontSize: 15 }}>Sponsoring FRC Team 4550 connects your organization with motivated young engineers and demonstrates your commitment to STEM education. Multiple sponsorship tiers are available with recognition at competitions, on our robot, and across our platforms.</p>
              <div className="tier-row">
                {[{ name: "Bronze", color: "#b45309" }, { name: "Silver", color: "#94a3b8" }, { name: "Gold", color: "#eab308" }, { name: "Platinum", color: "#818cf8" }].map((t, i) => (
                  <div key={t.name} style={{ border: `1px solid ${t.color}`, borderRadius: 20, padding: isMobile ? "5px 14px" : "6px 20px", fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 700, letterSpacing: 2, color: t.color }}>{t.name}</div>
                ))}
              </div>
              <a href={`mailto:${email}`} style={{ display: "inline-block", background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>CONTACT US TO SPONSOR</a>
            </div>
          </FadeSection>
        
      </div></section>

      {/* DONATE */}
      <section style={{ background: "rgba(239,68,68,0.05)", borderTop: "1px solid rgba(239,68,68,0.2)" }}><div className="sec">
        
          <FadeSection>
            <div style={{ textAlign: "center" }}>
              <Eyebrow>// SUPPORT THE TEAM</Eyebrow>
              <SectionTitle>Make a Donation</SectionTitle>
              <p style={{ color: "#94a3b8", maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.8, fontSize: 15 }}>Every donation goes directly toward robot parts, competition fees, and team travel. Help us compete at the highest level.</p>
              <a href={donate} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 28px" : "14px 32px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>DONATE NOW</a>
            </div>
          </FadeSection>
        
      </div></section>

      {/* CONTACT */}
      <section id="contact"><div className="sec">
        
          <FadeSection>
            <div style={{ textAlign: "center" }}>
              <Eyebrow>// GET IN TOUCH</Eyebrow>
              <SectionTitle>Contact</SectionTitle>
              <div className="contact-row">
                {[{ href: `mailto:${email}`, icon: "✉️", label: email }, { href: ig, icon: "📸", label: "@cherrycreek.robotics" }].map((c, i) => (
                  <a key={c.label} href={c.href} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", textDecoration: "none", fontSize: isMobile ? 13 : 15, fontFamily: "'Share Tech Mono', monospace", padding: isMobile ? "12px 20px" : 0, background: isMobile ? "rgba(255,255,255,0.04)" : "transparent", borderRadius: isMobile ? 8 : 0, border: isMobile ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>{c.label}
                  </a>
                ))}
              </div>
            </div>
          </FadeSection>
        
      </div></section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "32px 18px 20px" : "40px 32px 24px" }}>
        <div className="footer-top">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoUrl} alt="logo" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
            <div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#ef4444", animation: "glitch 20s ease-in-out infinite 3s" }}>SOMETHING'S BRUIN</div>
              <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Share Tech Mono', monospace" }}>FRC Team 4550 · Cherry Creek High School</div>
            </div>
          </div>
          <div className="footer-links">
            {navItems.map(l => <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} style={{ color: "#64748b", textDecoration: "none", fontSize: 12, fontFamily: "'Share Tech Mono', monospace" }}>{l}</a>)}
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#334155", fontSize: 11, fontFamily: "'Share Tech Mono', monospace", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 18 }}>
          <a href="/privacy" style={{ color: "#475569", textDecoration: "none" }}>Privacy Policy</a>
          <span style={{ color: "#334155" }}> &middot; </span>
          <a href="/terms" style={{ color: "#475569", textDecoration: "none" }}>Terms &amp; Conditions</a>
          <div style={{ marginTop: 10 }}>
            &copy; {new Date().getFullYear()} FRC Team 4550 Something's Bruin &middot; Built by Palivela_Joel
          </div>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children }) {
  return <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ef4444", letterSpacing: 3, marginBottom: 10, animation: "glitch 15s ease-in-out infinite" }}>{children}</div>;
}
function SectionTitle({ children }) {
  return <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: "clamp(20px,4vw,36px)", color: "#f1f5f9", marginBottom: 36, animation: "glitch 18s ease-in-out infinite 1s" }}>{children}</h2>;
}
