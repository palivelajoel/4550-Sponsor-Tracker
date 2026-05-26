import { useState, useEffect, useRef } from "react";
import { FONTS, C, ROLE_COLORS, SUBTEAM_COLORS, TEAM_PASSWORD, sbFetch, isAdmin, isCaptainOrAbove, getRole, getUsername } from "./hubUtils.jsx";

import Starfield from "./Starfield.jsx";

// ── Animated particle canvas ──────────────────────────────
function Particles({ count = 40 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;
    const pts = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }));
    let raf;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239,68,68,0.5)"; ctx.fill();
        pts.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 100) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = `rgba(239,68,68,${0.12 * (1 - d / 100)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
        });
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    const ro = new ResizeObserver(() => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />;
}

// ── Password input with show/hide ─────────────────────────
function PwInput({ value, onChange, placeholder = "Password", style: s = {} }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder}
        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"12px 44px 12px 16px", color:"#fff", fontSize:14, fontFamily:"monospace", width:"100%", transition:"border-color 0.2s", WebkitAppearance:"none", ...s }}
        onFocus={e => e.target.style.borderColor = "rgba(239,68,68,0.5)"}
        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"} />
      <button type="button" onClick={() => setShow(v => !v)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:14, padding:4, lineHeight:1 }}>
        {show ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export default function Hub() {
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [logoUrl, setLogoUrl] = useState("/logo.jpg");
  const [memberName, setMemberName] = useState("");
  const [taskCount, setTaskCount] = useState(0);
  const [role, setRole] = useState("Member");
  const [subteam, setSubteam] = useState("General");
  const [loginLoading, setLoginLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const [tileOrder, setTileOrder] = useState([]);

  useEffect(() => {
    loadLogo();
    sbFetch("site_config?key=eq.hub_tile_order&select=value").then(r => {
      if (r?.[0]?.value) setTileOrder(r[0].value.split(",").map(s => s.trim()).filter(Boolean));
    });
    if (localStorage.getItem("hub_authed") === "true") {
      const r = localStorage.getItem("hub_role") || "Member";
      const st = localStorage.getItem("hub_subteam") || "General";
      setAuthed(true); setRole(r); setSubteam(st);
      setUsername(localStorage.getItem("hub_username") || "");
      loadStats();
    }
  }, []);

  async function loadLogo() {
    const r = await sbFetch("site_config?key=eq.logo_url&select=value");
    if (r?.[0]) setLogoUrl(r[0].value);
  }

  async function loadStats() {
    const u = localStorage.getItem("hub_username") || "";
    if (u) {
      const m = await sbFetch(`members?username=eq.${encodeURIComponent(u)}&select=full_name,subteam`);
      if (m?.[0]) {
        setMemberName(m[0].full_name || u);
        if (m[0].subteam) { setSubteam(m[0].subteam); localStorage.setItem("hub_subteam", m[0].subteam); }
      }
    }
    const t = await sbFetch("hub_tasks?status=neq.Done&select=id");
    if (t) setTaskCount(t.length);
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !pw.trim()) { setErr("Username (email) and password required."); return; }
    setLoginLoading(true);
    try {
      const res = await fetch("/api/hub-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: pw.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Login failed."); setLoginLoading(false); return; }
      localStorage.setItem("hub_token", data.token);
      localStorage.setItem("hub_authed", "true");
      localStorage.setItem("hub_username", data.user.username);
      localStorage.setItem("hub_role", data.user.role);
      localStorage.setItem("hub_subteam", data.user.subteam || "General");
      setAuthed(true);
      setRole(data.user.role);
      setSubteam(data.user.subteam || "General");
      setMemberName(data.user.full_name || data.user.username);
      setLoginLoading(false);
      setErr("");
      loadStats();
    } catch { setErr("Login failed. Server may be unavailable."); setLoginLoading(false); }
  }

  function logout() {
    ["hub_authed","hub_username","hub_role","hub_subteam","hub_token"].forEach(k => localStorage.removeItem(k));
    setAuthed(false); setMemberName(""); setRole("Member");
  }

  const currentRole = localStorage.getItem("hub_role") || "Member";
  const currentSubteam = localStorage.getItem("hub_subteam") || "General";
  const isAdminUser = currentRole === "Admin";
  const isCaptain = ["Captain","Admin"].includes(currentRole);

  const FEATURES = [
    { id:"projector", icon:"📡", label:"Meeting Projector", description:"Live rotating display — calendar, tasks & announcements. Fullscreen.", href:"/member-hub/projector", accent:"#ef4444", featured:true },
    { id:"calendar", icon:"📅", label:"Team Calendar", description:"Events, deadlines, and meetings.", href:"/member-hub/calendar", accent:"#3b82f6" },
    { id:"tasks", icon:"✅", label:"Task Board", description:"Kanban board. View, update, and complete your assigned tasks.", href:"/member-hub/tasks", accent:"#22c55e" },
    { id:"announcements", icon:"📣", label:"Announcements", description:"Team-wide updates from captains.", href:"/member-hub/announcements", accent:"#f59e0b" },
    { id:"competitions", icon:"🏆", label:"Competitions", description:"Match & pit scouting, venue maps, and AI analysis.", href:"/member-hub/scout-map", accent:"#a855f7" },
    { id:"media", icon:"📸", label:"Media Gallery", description:"Photos and videos from competitions and events.", href:"/member-hub/media", accent:"#ec4899" },
    { id:"resources", icon:"📁", label:"Resources", description:"CAD files, documents, and team guides.", href:"/member-hub/resources", accent:"#64748b" },
    { id:"inventory", icon:"📦", label:"Inventory", description:"Track parts, tools, and supplies with AI identification.", href:"/member-hub/inventory", accent:"#22d3ee" },
    { id:"sponsor-tracker", icon:"🤝", label:"Sponsor Tracker", description:"Manage sponsors, contact info, and outreach status.", href:"/dashboard", accent:"#0ea5e9" },
  ];

  // ── LOGIN ───────────────────────────────────────────────
  if (!authed) {
    return (
<div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Exo 2',sans-serif", position:"relative", overflow:"hidden", padding:16, zIndex:0 }}>
        <style>{FONTS}</style>
        <Starfield density={6000} opacity={0.55} />
        {/* Animated background */}
        <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
<Starfield density={6000} opacity={0.55} />
          {[{ s:500, t:"-20%", l:"-15%", c:"rgba(239,68,68,0.07)", d:"0s" }, { s:350, b:"-10%", r:"-10%", c:"rgba(59,130,246,0.05)", d:"1.5s" }, { s:250, t:"45%", r:"15%", c:"rgba(168,85,247,0.04)", d:"0.8s" }].map((o,i) => (
            <div key={i} style={{ position:"absolute", width:o.s, height:o.s, top:o.t, bottom:o.b, left:o.l, right:o.r, borderRadius:"50%", background:`radial-gradient(circle, ${o.c}, transparent)`, animation:`orbFloat ${6+i}s ease-in-out infinite`, animationDelay:o.d }} />
          ))}
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
          <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation:"scanline 4s linear infinite", top:"-4px" }} />
        </div>

        <div className="login-card" style={{ background:"rgba(13,17,23,0.92)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:20, padding: isMobile ? "36px 24px" : "48px 40px", textAlign:"center", width:"100%", maxWidth:400, position:"relative", backdropFilter:"blur(20px)" }}>
          <img src={logoUrl} alt="logo" style={{ width:76, height:76, borderRadius:"50%", objectFit:"cover", marginBottom:18, border:"2px solid rgba(239,68,68,0.5)", boxShadow:"0 0 30px rgba(239,68,68,0.3)", animation:"float 3s ease-in-out infinite" }} />
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?17:20, fontWeight:700, color:C.red, letterSpacing:3, marginBottom:4, animation:"glitch 8s ease-in-out infinite" }}>MEMBER HUB</div>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, color:C.dim, letterSpacing:2, marginBottom:6 }}>FRC TEAM 4550</div>
          <div style={{ fontSize:12, color:C.dim, fontFamily:"monospace", marginBottom:26 }}>Sign in with your team account</div>

          <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <input type="text" placeholder="Email" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username"
              style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"12px 16px", color:"#fff", fontSize:14, fontFamily:"monospace", width:"100%", WebkitAppearance:"none" }}
              onFocus={e => e.target.style.borderColor="rgba(239,68,68,0.5)"} onBlur={e => e.target.style.borderColor="rgba(255,255,255,0.12)"} />
            <PwInput value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" />
            {err && <div style={{ color:C.red, fontSize:12, fontFamily:"monospace", animation:"fadeUp 0.3s ease" }}>{err}</div>}
            <button type="submit" disabled={loginLoading} className="login-btn" style={{ background:C.red, border:"none", borderRadius:8, padding:13, color:"#fff", fontFamily:"'Orbitron',sans-serif", fontWeight:700, fontSize:13, letterSpacing:2, cursor:"pointer", opacity:loginLoading?0.7:1, transition:"all 0.2s", marginTop:4, animation:"glow 2.5s ease-in-out infinite" }}>
              {loginLoading ? "AUTHENTICATING..." : "ENTER HUB →"}
            </button>
          </form>
          <a href="/" style={{ display:"block", marginTop:22, color:C.dim, fontSize:12, fontFamily:"monospace", textDecoration:"none" }}>← Back to public site</a>
        </div>
      </div>
    );
  }

  // ── HUB DASHBOARD ───────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Exo 2',sans-serif", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <Starfield density={11000} opacity={0.32} />
        {[{ s:500, t:"-20%", l:"-15%", c:"rgba(239,68,68,0.07)", d:"0s" }, { s:350, b:"-10%", r:"-10%", c:"rgba(59,130,246,0.05)", d:"1.5s" }, { s:250, t:"45%", r:"15%", c:"rgba(168,85,247,0.04)", d:"0.8s" }].map((o,i) => (
          <div key={i} style={{ position:"absolute", width:o.s, height:o.s, top:o.t, bottom:o.b, left:o.l, right:o.r, borderRadius:"50%", background:`radial-gradient(circle, ${o.c}, transparent)`, animation:`orbFloat ${6+i}s ease-in-out infinite`, animationDelay:o.d }} />
        ))}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
        <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation:"scanline 4s linear infinite", top:"-4px" }} />
      </div>
      <style>{FONTS + `
        @keyframes orbFloat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
        @keyframes scanline{0%{top:-4px;}100%{top:100%;}}
        .feat-card{transition:transform 0.22s ease,border-color 0.22s ease,box-shadow 0.22s ease;}
        .feat-card:hover{transform:translateY(-4px)!important;}
        .feat-card:active{transform:scale(0.98)!important;}
        .feat-icon{transition:transform 0.2s ease;}
        .feat-card:hover .feat-icon{transform:scale(1.18)!important;}
      `}</style>

      {/* Header */}
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding: isMobile ? "12px 14px" : "14px 28px", borderBottom:`1px solid ${C.border}`, background:"rgba(8,10,15,0.88)", backdropFilter:"blur(16px)", position:"sticky", top:"env(safe-area-inset-top,0px)", zIndex:100, gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src={logoUrl} alt="logo" style={{ width:isMobile?30:36, height:isMobile?30:36, borderRadius:"50%", objectFit:"cover", border:"1px solid rgba(239,68,68,0.4)", flexShrink:0 }} />
          {!isMobile && (
            <div>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:700, fontSize:13, color:C.red, letterSpacing:2 }}>MEMBER HUB</div>
              <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace" }}>FRC Team 4550 · Something's Bruin</div>
            </div>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {memberName && !isMobile && <span style={{ fontSize:12, color:C.muted, fontFamily:"monospace" }}>👋 {memberName}</span>}
          {memberName && <span style={{ fontSize:10, background:`${ROLE_COLORS[currentRole]||"#64748b"}22`, color:ROLE_COLORS[currentRole]||"#64748b", border:`1px solid ${ROLE_COLORS[currentRole]||"#64748b"}44`, borderRadius:10, padding:"2px 9px", fontFamily:"monospace" }}>{currentRole}</span>}
          {isAdminUser && (
            <a href="/admin" style={{ fontSize:11, color:C.red, textDecoration:"none", fontFamily:"'Orbitron',sans-serif", border:"1px solid rgba(239,68,68,0.4)", borderRadius:6, padding:"5px 10px", letterSpacing:1, animation:"glow 3s ease-in-out infinite" }}>
              {isMobile ? "🔐" : "ADMIN PANEL"}
            </a>
          )}
          {!isMobile && <a href="/" style={{ fontSize:12, color:C.dim, textDecoration:"none", fontFamily:"monospace" }}>Site</a>}
          <button onClick={logout} style={{ background:"transparent", border:"1px solid rgba(239,68,68,0.3)", color:C.red, padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:12, fontFamily:"monospace" }}>
            {isMobile ? "↩" : "Log Out"}
          </button>
        </div>
      </header>

      <main style={{ maxWidth:1200, margin:"0 auto", padding: isMobile ? "20px 14px" : "36px 24px", position:"relative", zIndex:1 }}>
        {/* Welcome + stats */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?17:22, fontWeight:700, color:C.text }}>
              {memberName ? `Welcome back, ${memberName.split(" ")[0]}.` : "Welcome back."}
            </div>
            <div style={{ fontSize:11, color:C.dim, fontFamily:"monospace", marginTop:4 }}>
              {new Date().toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" })}
              {currentSubteam !== "General" && ` · ${currentSubteam}`}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {taskCount > 0 && (
              <div style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.3)", color:"#93c5fd", padding:"7px 14px", borderRadius:8, fontSize:12, fontFamily:"monospace" }}>
                📋 {taskCount} open
              </div>
            )}
          </div>
        </div>

        {/* Featured projector */}
        <a href="/member-hub/projector" style={{ textDecoration:"none", display:"block", marginBottom:20 }}>
          <div style={{ background:"linear-gradient(135deg,rgba(239,68,68,0.1),rgba(59,130,246,0.07))", border:"1px solid rgba(239,68,68,0.3)", borderRadius:14, padding: isMobile ? "18px 16px" : "22px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, cursor:"pointer", transition:"all 0.25s", animation:"borderPulse 3s ease-in-out infinite", flexWrap:"wrap" }}
            onMouseEnter={e => e.currentTarget.style.borderColor="rgba(239,68,68,0.7)"}
            onMouseLeave={e => e.currentTarget.style.borderColor="rgba(239,68,68,0.3)"}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ fontSize:isMobile?28:38, animation:"float 2.5s ease-in-out infinite" }}>📡</div>
              <div>
                <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?13:15, fontWeight:700, color:C.red, letterSpacing:2, marginBottom:3 }}>MEETING PROJECTOR</div>
                <div style={{ color:C.muted, fontSize:isMobile?12:13 }}>Live rotating display — calendar, tasks & announcements.</div>
              </div>
            </div>
            <div style={{ background:C.red, color:"#fff", padding:isMobile?"8px 16px":"10px 22px", borderRadius:6, fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, letterSpacing:2, flexShrink:0 }}>OPEN →</div>
          </div>
        </a>

        {/* Feature grid */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(260px,1fr))", gap:isMobile?10:16 }}>
          {FEATURES.filter(f => f.id !== "projector").sort((a, b) => {
            const ai = tileOrder.indexOf(a.id); const bi = tileOrder.indexOf(b.id);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          }).map((f, i) => (
            <FeatureCard key={f.id} feature={f} index={i} isMobile={isMobile} />
          ))}
        </div>
      </main>

      <div style={{ textAlign:"center", padding:"20px 14px 4px", color:"#1e293b", fontSize:11, fontFamily:"monospace", letterSpacing:2 }}>
        BUILT BY PALIVELA_JOEL · FRC TEAM 4550
      </div>
      <div style={{ textAlign:"center", padding:"0 14px 20px", display:"flex", gap:16, justifyContent:"center", flexWrap:"wrap", fontSize:11, fontFamily:"monospace", color:"#334155" }}>
        <a href="/privacy" style={{ color:"#334155", textDecoration:"none" }}>Privacy Policy</a>
        <a href="/terms" style={{ color:"#334155", textDecoration:"none" }}>Terms &amp; Conditions</a>
      </div>
    </div>
  );
}

function FeatureCard({ feature, index, isMobile }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="feat-card"
      onClick={() => { if (feature.href === "/dashboard") localStorage.setItem("sb_authed","true"); window.location.href = feature.href; }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? `${feature.accent}10` : C.surface, border:`1px solid ${hovered ? feature.accent+"88" : C.border}`, borderRadius:12, padding: isMobile ? "16px 12px" : "22px 20px", cursor:"pointer", boxShadow: hovered ? `0 0 28px ${feature.accent}22` : "none", animation:`fadeUp 0.4s ease both`, animationDelay:`${index * 0.04}s`, userSelect:"none" }}>
      <div className="feat-icon" style={{ fontSize:isMobile?22:28, marginBottom:isMobile?8:12 }}>{feature.icon}</div>
      <div style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:700, fontSize:isMobile?10:12, color:C.text, marginBottom:isMobile?4:7, letterSpacing:1 }}>{feature.label}</div>
      {!isMobile && <div style={{ fontSize:12, color:C.dim, lineHeight:1.6 }}>{feature.description}</div>}
      <div style={{ marginTop:isMobile?6:12, fontSize:11, fontFamily:"monospace", color:feature.accent, fontWeight:700, opacity:hovered?1:0.5, transition:"opacity 0.2s" }}>Open →</div>
    </div>
  );
}
