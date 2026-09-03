import { useState, useEffect, useRef } from "react";
import Starfield from "./Starfield.jsx";
import QRCode from "qrcode";

import { CaptainPhoto, sbFetch, uploadFile } from './hubUtils.jsx';

const ROLES = ["Member", "Captain", "Admin"];
const SUBTEAMS = ["Build", "Programming", "Marketing & Outreach", "General"];

async function adminProxy(table, action, payload) {
  let token = localStorage.getItem("admin_token");
  if (!token) {
    throw new Error("Missing admin auth session. Sign in with your username and password.");
  }
  // Client-side expiry check so we don't silently fail
  try {
    const parsed = JSON.parse(atob(token.split('.')[1]));
    if (parsed.exp * 1000 < Date.now()) {
      localStorage.removeItem("admin_authed");
      localStorage.removeItem("admin_token");
      throw new Error("Session expired. Please sign in again.");
    }
  } catch (e) {
    if (e.message === "Session expired. Please sign in again.") throw e;
  }
  const res = await fetch("/api/admin-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ table, action, payload }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    let msg = txt || `Proxy error ${res.status}`;
    try {
      const j = JSON.parse(txt);
      if (j?.error) msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
    } catch { /* plain text body */ }
    if (res.status === 401) {
      localStorage.removeItem("admin_authed");
      localStorage.removeItem("admin_token");
    }
    throw new Error(msg);
  }
  return res.json();
}

const ROLE_COLORS = { Member: "#64748b", Captain: "#3b82f6", Admin: "#ef4444" };
const SUBTEAM_COLORS = { Build: "#f59e0b", Programming: "#3b82f6", "Marketing & Outreach": "#22c55e", General: "#64748b" };

const NAV = [
  { id: "overview", label: "📊 Overview" },
  { id: "accounts", label: "👥 Accounts" },
  { id: "hub-tasks", label: "📋 Hub Tasks" },
  { id: "hub-calendar", label: "📅 Hub Calendar" },
  { id: "sponsors-assign", label: "🤝 Sponsors" },
  { id: "captains", label: "🏆 Leadership" },
  { id: "suggestions", label: "💡 Suggestions" },
  { id: "site", label: "⚙️ Site Config" },
  { id: "tools", label: "⛏️ Other Tools" },
];

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [page, setPage] = useState("overview");
  const [members, setMembers] = useState([]);
  const [tasks, setTaskList] = useState([]);
  const [hubCalendar, setHubCalendar] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [captains, setCaptains] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [config, setConfig] = useState({});
  const [logoUrl, setLogoUrl] = useState("/logo.jpg");
  const [toast, setToast] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);
  const [forms, setForms] = useState([]);
  const [formSubmissions, setFormSubmissions] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [media, setMedia] = useState([]);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("admin_authed") === "true") {
      const token = localStorage.getItem("admin_token");
      if (token) {
        try {
          const parsed = JSON.parse(atob(token.split('.')[1]));
          if (parsed.exp * 1000 < Date.now()) {
            localStorage.removeItem("admin_authed");
            localStorage.removeItem("admin_token");
            return;
          }
        } catch { /* ignore parse errors */ }
      }
      setAuthed(true); loadAll();
    }
  }, []);

  function showToast(msg, color = "#22c55e") { setToast({ msg, color }); setTimeout(() => setToast(""), 3000); }

  async function loadAll() {
    const [m, t, cals, sg, sp, cap, comp, cfg, fm, fs, an, inv, md] = await Promise.all([
      sbFetch("members?select=*&order=created_at.asc"),
      sbFetch("hub_tasks?select=*&order=created_at.desc"),
      sbFetch("hub_calendar?select=*&order=date.asc"),
      sbFetch("suggestions?select=*&order=submitted_at.desc"),
      sbFetch("sponsors?select=*&order=company.asc"),
      sbFetch("captains?select=*&order=sort_order.asc"),
      sbFetch("competitions?select=*&order=start_date.asc"),
      sbFetch("site_config?select=key,value"),
      sbFetch("hub_forms?select=*&order=created_at.desc"),
      sbFetch("hub_form_submissions?select=*&order=created_at.desc"),
      sbFetch("hub_announcements?select=*&order=created_at.desc"),
      sbFetch("inventory_items?select=*&order=created_at.desc"),
      sbFetch("hub_media?select=*&order=created_at.desc"),
    ]);
    if (m) setMembers(m);
    if (t) setTaskList(t);
    if (cals) setHubCalendar(cals);
    if (sg) setSuggestions(sg);
    if (sp) setSponsors(sp);
    if (cap) setCaptains(cap);
    if (comp) setCompetitions(comp);
    if (fm) setForms(fm);
    if (fs) setFormSubmissions(fs);
    if (an) setAnnouncements(an);
    if (inv) setInventory(inv);
    if (md) setMedia(md);
    if (cfg) {
      const obj = {};
      cfg.forEach(r => { obj[r.key] = r.value; });
      setConfig(obj);
      if (obj.logo_url) setLogoUrl(obj.logo_url);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    try {
      const r = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password: pw }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.error || 'Login failed.'); return; }
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_authed", "true");
      setAuthed(true); loadAll();
    } catch (err) { setErr('Login failed.'); }
  }

  async function handleLogout() {
    localStorage.removeItem("admin_authed"); localStorage.removeItem("admin_token"); setAuthed(false);
  }

  if (!authed) {
    return (
      <div style={S.loginBg}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Exo+2:wght@400;600&display=swap');
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}body{background:#080a0f;}
          @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
          @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
        `}</style>
        <div style={S.loginCard}>
          <div style={S.loginTitle}>ADMIN PANEL</div>
          <div style={S.loginSub}>FRC Team 4550 · Something's Bruin</div>
          <form onSubmit={handleLogin} style={S.loginForm}>
            <input type="text" placeholder="Username" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} style={S.loginInput} />
            <input type="password" placeholder="Password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }}
              style={S.loginInput} autoFocus />
            {err && <div style={S.loginErr}>{err}</div>}
            <button type="submit" style={S.loginBtn}>ENTER →</button>
          </form>
          <a href="/" style={S.loginBack}>← Back to site</a>
        </div>
      </div>
    );
  }

  const overdue = tasks.filter(t => t.due_date && t.status !== "Done" && new Date(t.due_date) < new Date()).length;

  return (
    <div className="admin-layout" style={{ ...S.layout, overflow:"hidden" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <Starfield density={8000} opacity={0.45} />
        {[{ s:500, t:"-20%", l:"-15%", c:"rgba(239,68,68,0.07)", d:"0s" }, { s:350, b:"-10%", r:"-10%", c:"rgba(59,130,246,0.05)", d:"1.5s" }, { s:250, t:"45%", r:"15%", c:"rgba(168,85,247,0.04)", d:"0.8s" }].map((o,i) => (
          <div key={i} style={{ position:"absolute", width:o.s, height:o.s, top:o.t, bottom:o.b, left:o.l, right:o.r, borderRadius:"50%", background:`radial-gradient(circle, ${o.c}, transparent)`, animation:`orbFloat ${6+i}s ease-in-out infinite`, animationDelay:o.d }} />
        ))}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
        <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation:"scanline 4s linear infinite", top:"-4px" }} />
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600;700&family=Share+Tech+Mono&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}body{background:#080a0f;color:#f1f5f9;font-family:'Exo 2',sans-serif;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
        @keyframes orbFloat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
        @keyframes scanline{0%{top:-4px;}100%{top:100%;}}
        input,select,textarea{outline:none;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#ef4444;border-radius:3px;}
        @media(max-width:760px){
          .admin-layout{display:block!important;}
          .admin-sidebar{position:fixed!important;width:240px!important;height:calc(100vh - 48px - env(safe-area-inset-top, 0px))!important;top:calc(48px + env(safe-area-inset-top, 0px))!important;left:0!important;border-right:1px solid rgba(255,255,255,0.06)!important;z-index:80!important;overflow-y:auto!important;background:#0a0e18!important;}
          .admin-nav{display:flex!important;flex-direction:column!important;padding:8px 0!important;gap:2px!important;}
          .admin-nav button{width:100%!important;border-left:3px solid transparent!important;border-bottom:0!important;border-radius:0!important;text-align:left!important;padding:12px 16px!important;min-width:0!important;}
          .admin-main{padding:calc(60px + env(safe-area-inset-top, 0px)) 10px 18px!important;margin-left:0!important;}
          .admin-card{padding:16px!important;}
          .admin-table-wrap{overflow-x:auto!important;}
          .admin-table-wrap table{font-size:12px!important;min-width:500px!important;}
        }
        @media(max-width:420px){
          .login-card{padding:28px 18px!important;}
        }
      `}</style>

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.color || "#22c55e", color: "#fff", padding: "12px 20px", borderRadius: 8, fontFamily: "monospace", fontSize: 13, zIndex: 9999, animation: "fadeUp 0.3s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>{toast.msg}</div>}

      {/* Mobile top bar + hamburger */}
      {isMobile && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, minHeight: 48, paddingTop: "env(safe-area-inset-top, 0px)", display: "flex", alignItems: "flex-end", padding: "0 12px 8px", gap: 10, background: "#0a0e18", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 60, boxSizing: "content-box" }}>
          <button onClick={() => setShowMobileNav(v => !v)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 22, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>☰</button>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#ef4444", letterSpacing: 2, lineHeight: 1 }}>ADMIN</div>
          <div style={{ flex: 1 }} />
          <button onClick={handleLogout} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "monospace", lineHeight: 1 }}>Log Out</button>
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && showMobileNav && (
        <div onClick={() => setShowMobileNav(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70 }} />
      )}
      <aside className="admin-sidebar" style={{
        ...S.sidebar,
        ...(isMobile ? {
          position: "fixed",
          top: "calc(48px + env(safe-area-inset-top, 0px))", left: 0, bottom: 0,
          width: 240,
          transform: showMobileNav ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          zIndex: 80,
          height: "calc(100vh - 48px - env(safe-area-inset-top, 0px))",
        } : {}),
      }}>
        {!isMobile && (
          <div style={S.sidebarBrand}>
            <img src={logoUrl} alt="logo" style={S.sidebarLogo} />
            <div>
              <div style={S.sidebarTitle}>ADMIN</div>
              <div style={S.sidebarSub}>Team 4550</div>
            </div>
          </div>
        )}
        <nav className="admin-nav" style={S.sidebarNav}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setPage(n.id); if (isMobile) setShowMobileNav(false); }} style={{ ...S.navItem, background: page === n.id ? "rgba(239,68,68,0.15)" : "transparent", color: page === n.id ? "#ef4444" : "#94a3b8", borderLeft: page === n.id ? "3px solid #ef4444" : "3px solid transparent" }}>
              {n.label}
              {n.id === "suggestions" && suggestions.length > 0 && <span style={S.badge}>{suggestions.length}</span>}
            </button>
          ))}
        </nav>
        {!isMobile && <button onClick={handleLogout} style={S.logoutBtn}>Log Out</button>}
      </aside>

      <main className="admin-main" style={{ ...S.main, ...(isMobile ? { marginLeft: 0, padding: "calc(60px + env(safe-area-inset-top, 0px)) 10px 18px" } : {}) }}>
        {page === "overview" && <Overview members={members} tasks={tasks} suggestions={suggestions} sponsors={sponsors} events={hubCalendar} overdue={overdue} competitions={competitions} captains={captains} forms={forms} formSubmissions={formSubmissions} announcements={announcements} inventory={inventory} media={media} isMobile={isMobile} />}
        {page === "accounts" && <Accounts members={members} reload={loadAll} showToast={showToast} adminProxy={adminProxy} isMobile={isMobile} />}
        {page === "hub-tasks" && <Tasks tasks={tasks} members={members} reload={loadAll} showToast={showToast} isMobile={isMobile} />}
        {page === "hub-calendar" && <HubCalendarAdmin events={hubCalendar} reload={loadAll} showToast={showToast} isMobile={isMobile} />}
        {page === "sponsors-assign" && <SponsorAssign sponsors={sponsors} members={members} reload={loadAll} showToast={showToast} isMobile={isMobile} />}
        {page === "captains" && <CaptainsAdmin captains={captains} reload={loadAll} showToast={showToast} isMobile={isMobile} />}
        {page === "suggestions" && <Suggestions suggestions={suggestions} reload={loadAll} showToast={showToast} />}
        {page === "site" && <SiteConfig config={config} logoUrl={logoUrl} setLogoUrl={setLogoUrl} reload={loadAll} showToast={showToast} isMobile={isMobile} />}
        {page === "tools" && <QRGenerator reload={loadAll} showToast={showToast} vals={config} isMobile={isMobile} />}
      </main>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────
function Overview({ members, tasks, suggestions, sponsors, events, overdue, competitions, captains, forms, formSubmissions, announcements, inventory, media, isMobile }) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const openTasks = tasks.filter(t => t.status !== "Done");
  const doneTasks = tasks.filter(t => t.status === "Done");
  const taskCompletion = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;
  const weekAhead = new Date(today); weekAhead.setDate(weekAhead.getDate() + 7);
  const upcomingEvents = events.filter(e => e?.date && new Date(e.date) >= today && new Date(e.date) <= weekAhead).length;
  const nextEvents = events.filter(e => e?.date && e.date >= todayStr).slice(0, 5);
  const dueTasks = openTasks.filter(t => t.due_date).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 5);
  const nextComp = competitions.filter(c => c.attending && c.start_date >= todayStr).sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)))[0];
  const attendingComps = competitions.filter(c => c.attending).length;
  const lowStock = inventory.filter(i => i.low_stock).length;
  const totalSubmissions = formSubmissions.length;
  const pendingAnnouncements = announcements.filter(a => !a.pinned).length;
  const membersBySubteam = {};
  members.forEach(m => { const st = m.subteam || "General"; membersBySubteam[st] = (membersBySubteam[st] || 0) + 1; });
  const taskPriority = { high: openTasks.filter(t => t.priority === "High").length, medium: openTasks.filter(t => t.priority === "Medium").length, low: openTasks.filter(t => t.priority === "Low").length };

  const stats = [
    { label: "Members", val: members.length, color: "#3b82f6" },
    { label: "Open Tasks", val: openTasks.length, color: "#f59e0b" },
    { label: "Overdue", val: overdue, color: "#ef4444" },
    { label: "Events (7d)", val: upcomingEvents, color: "#22c55e" },
    { label: "Suggestions", val: suggestions.length, color: "#a855f7" },
    { label: "Sponsors", val: sponsors.length, color: "#64748b" },
    { label: "Attending Comps", val: attendingComps, color: "#eab308" },
    { label: "Captains", val: captains.length, color: "#06b6d4" },
    { label: "Forms", val: forms.length, color: "#22d3ee" },
    { label: "Form Responses", val: totalSubmissions, color: "#14b8a6" },
    { label: "Announcements", val: announcements.length, color: "#f97316" },
    { label: "Media Items", val: media.length, color: "#ec4899" },
    { label: "Low Stock", val: lowStock, color: lowStock > 0 ? "#ef4444" : "#22c55e" },
    { label: "Completion", val: `${taskCompletion}%`, color: taskCompletion >= 70 ? "#22c55e" : taskCompletion >= 40 ? "#f59e0b" : "#ef4444" },
  ];

  const cardStyle = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "14px 12px" : "18px 20px" };
  const cardTitle = { fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.5, marginBottom: 12 };

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Overview</h1>

      {/* Stat cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: isMobile ? 8 : 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...S.statCard, borderColor: s.color, minWidth: isMobile ? 80 : 120, padding: isMobile ? "10px 8px" : "16px", flex: isMobile ? "0 1 calc(33.33% - 8px)" : "0 1 auto" }}>
            <div style={{ ...S.statNum, color: s.color, fontSize: isMobile ? 16 : 22 }}>{s.val}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {overdue > 0 && <div style={{ ...S.alertBanner, marginTop: 14 }}>⚠️ {overdue} overdue task{overdue !== 1 ? "s" : ""}</div>}
      {lowStock > 0 && <div style={{ ...S.alertBanner, marginTop: 8, borderColor: "#f97316", background: "rgba(249,115,22,0.08)", color: "#fb923c" }}>📦 {lowStock} low-stock item{lowStock !== 1 ? "s" : ""} in inventory</div>}

      {/* Detail cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginTop: 20 }}>

        {/* Next Competition */}
        <div style={cardStyle}>
          <div style={cardTitle}>🏆 NEXT COMPETITION</div>
          {nextComp ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{nextComp.name || nextComp.event_code || "TBD"}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{nextComp.start_date} — {nextComp.location || "TBD"}</div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>No upcoming competitions</div>
          )}
        </div>

        {/* Task Breakdown */}
        <div style={cardStyle}>
          <div style={cardTitle}>✅ TASK BREAKDOWN</div>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            <div><span style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{openTasks.length}</span> <span style={{ fontSize: 11, color: "#94a3b8" }}>open</span></div>
            <div><span style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>{doneTasks.length}</span> <span style={{ fontSize: 11, color: "#94a3b8" }}>done</span></div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, fontFamily: "monospace" }}>
            <span style={{ color: "#ef4444" }}>🔴 High: {taskPriority.high}</span>
            <span style={{ color: "#f59e0b" }}>🟡 Med: {taskPriority.medium}</span>
            <span style={{ color: "#22c55e" }}>🟢 Low: {taskPriority.low}</span>
          </div>
        </div>

        {/* Upcoming Events */}
        <div style={cardStyle}>
          <div style={cardTitle}>📅 UPCOMING EVENTS</div>
          {nextEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {nextEvents.map(e => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{e.title || e.name || "Event"}</span>
                  <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>{e.date}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>No upcoming events</div>
          )}
        </div>

        {/* Tasks Due Soon */}
        <div style={cardStyle}>
          <div style={cardTitle}>⏰ DUE SOON</div>
          {dueTasks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {dueTasks.map(t => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>{t.title}</span>
                  <span style={{ color: t.due_date < todayStr ? "#ef4444" : "#64748b", fontFamily: "monospace", fontSize: 11, flexShrink: 0 }}>{t.due_date}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>No due dates set</div>
          )}
        </div>

        {/* Members by Subteam */}
        <div style={cardStyle}>
          <div style={cardTitle}>👥 MEMBERS BY SUBTEAM</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(membersBySubteam).sort((a, b) => b[1] - a[1]).map(([team, count]) => (
              <div key={team} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>
                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{count}</span> <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11 }}>{team}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginTop: 20 }}>
        <a href="/" target="_blank" style={{ flex: 1, padding: '14px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontFamily: "'Exo 2', sans-serif", textAlign: 'center' }}>Public Site ↗</a>
        <a href="/member-hub" target="_blank" style={{ flex: 1, padding: '14px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontFamily: "'Exo 2', sans-serif", textAlign: 'center' }}>Member Hub ↗</a>
      </div>
    </div>
  );
}

// ── ACCOUNTS ──────────────────────────────────────────────
function Accounts({ members, reload, showToast, adminProxy, isMobile }) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingMemberId, setSavingMemberId] = useState(null);
  const [pwError, setPwError] = useState("");
  const [createForm, setCreateForm] = useState({ username: "", full_name: "", password: "", confirmPassword: "", role: "Member", subteam: "General" });

  async function createMember() {
    if (!createForm.username.trim() || !createForm.password) { showToast("Username and password required.", "#ef4444"); return; }
    if (createForm.password !== createForm.confirmPassword) { showToast("Passwords do not match.", "#ef4444"); return; }
    try {
      await adminProxy('members', 'insert', {
        username: createForm.username.trim(),
        full_name: createForm.full_name.trim() || createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
        subteam: createForm.subteam,
      });
      setCreateForm({ username: "", full_name: "", password: "", confirmPassword: "", role: "Member", subteam: "General" });
      reload();
      showToast("✅ Account created.");
    } catch (e) { showToast("Create failed: " + (e.message || e), "#ef4444"); }
  }

  async function updateMember(id) {
    const payload = { full_name: editData.full_name, role: editData.role, subteam: editData.subteam };
    if (editData.password) payload.password = editData.password;
    await adminProxy('members', 'update_member', { id, updates: payload });
    setEditId(null); setEditData({}); reload(); showToast("✅ Member updated.");
  }

  async function deleteMember(id) {
    if (!confirm("Delete this member?")) return;
    await adminProxy('members', 'delete', { id });
    reload(); showToast("🗑️ Member deleted.", "#ef4444");
  }

  async function patchMemberQuick(id, updates) {
    setSavingMemberId(id);
    try {
      await adminProxy("members", "update_member", { id, updates });
      await reload();
      showToast("✅ Member updated.");
    } catch (e) {
      showToast(String(e.message || e), "#ef4444");
      await reload();
    } finally {
      setSavingMemberId(null);
    }
  }

  const bySubteam = {};
  SUBTEAMS.forEach(s => { bySubteam[s] = members.filter(m => (m.subteam || "General") === s); });

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Account Management</h1>

      {/* Create Account */}
      <div style={S.card}>
        <div style={S.cardTitle}>Create Account</div>
        <div style={S.formCol}>
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <input placeholder="Username *" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} style={S.input} />
            <input placeholder="Full Name" value={createForm.full_name} onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })} style={S.input} />
          </div>
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <input type="password" placeholder="Password *" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} style={S.input} />
            <input type="password" placeholder="Confirm Password *" value={createForm.confirmPassword} onChange={e => setCreateForm({ ...createForm, confirmPassword: e.target.value })} style={S.input} />
            <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={S.select}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <select value={createForm.subteam} onChange={e => setCreateForm({ ...createForm, subteam: e.target.value })} style={S.select}>
              {SUBTEAMS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={createMember} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>Create</button>
          </div>
        </div>
      </div>

      {/* By subteam */}
      {SUBTEAMS.map(st => {
        const sub = bySubteam[st];
        if (!sub.length) return null;
        return (
          <div key={st} style={S.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: SUBTEAM_COLORS[st] }} />
              <div style={{ ...S.cardTitle, marginBottom: 0 }}>{st} <span style={{ color: "#64748b", fontSize: 11 }}>({sub.length})</span></div>
            </div>
            {sub.map(m => (
              <div key={m.id} style={{ ...S.memberRow, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
                {editId === m.id ? (
                  <div style={{ ...S.formCol, flex: 1 }}>
                    <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
                      <input placeholder="Full Name" value={editData.full_name || ""} onChange={e => setEditData({ ...editData, full_name: e.target.value })} style={S.input} />
                      <input type="password" placeholder="New password (leave blank to keep)" value={editData.password || ""} onChange={e => setEditData({ ...editData, password: e.target.value })} style={{ ...S.input, maxWidth: isMobile ? '100%' : 200 }} />
                      <select value={editData.role || m.role} onChange={e => setEditData({ ...editData, role: e.target.value })} style={S.select}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                      <select value={editData.subteam || m.subteam || "General"} onChange={e => setEditData({ ...editData, subteam: e.target.value })} style={S.select}>
                        {SUBTEAMS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
                      <button onClick={() => updateMember(m.id)} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>Save</button>
                      <button onClick={() => { setEditId(null); setPwError(""); }} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ ...S.memberInfo, flexWrap: "wrap", gap: 10, flex: 1 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${ROLE_COLORS[m.role] || "#64748b"}22`, border: `1px solid ${ROLE_COLORS[m.role] || "#64748b"}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: ROLE_COLORS[m.role] || "#64748b", flexShrink: 0 }}>{(m.full_name || m.username)[0]}</div>
                      <div style={{ minWidth: 0 }}>
                        <span style={S.memberName}>{m.full_name || m.username}</span>
                        <span style={S.memberUser}> @{m.username}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 8, marginLeft: isMobile ? 0 : "auto", width: isMobile ? '100%' : undefined }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", fontFamily: "monospace", width: isMobile ? '100%' : undefined }}>
                          Role
                          <select
                            value={m.role || "Member"}
                            disabled={savingMemberId === m.id}
                            onChange={e => patchMemberQuick(m.id, { role: e.target.value })}
                            style={{ ...S.select, minWidth: isMobile ? 0 : 110, maxWidth: isMobile ? '100%' : 140, fontSize: 12, padding: "6px 8px", opacity: savingMemberId === m.id ? 0.6 : 1, flex: isMobile ? 1 : undefined }}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", fontFamily: "monospace", width: isMobile ? '100%' : undefined }}>
                          Sub-team
                          <select
                            value={m.subteam || "General"}
                            disabled={savingMemberId === m.id}
                            onChange={e => patchMemberQuick(m.id, { subteam: e.target.value })}
                            style={{ ...S.select, minWidth: isMobile ? 0 : 130, maxWidth: isMobile ? '100%' : 220, fontSize: 12, padding: "6px 8px", opacity: savingMemberId === m.id ? 0.6 : 1, flex: isMobile ? 1 : undefined }}
                          >
                            {SUBTEAMS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div style={{ ...S.memberActions, justifyContent: isMobile ? 'flex-end' : undefined }}>
                      <button onClick={() => { setEditId(m.id); setEditData({ full_name: m.full_name, role: m.role, subteam: m.subteam || "General", password: "" }); setPwError(""); }} style={S.btnGhost}>Edit</button>
                      <button onClick={() => deleteMember(m.id)} style={S.btnDanger}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── TASKS ─────────────────────────────────────────────────
function Tasks({ tasks, members, reload, showToast, isMobile }) {
  const [form, setForm] = useState({ title: "", description: "", assigned_to: "", assigned_name: "", due_date: "", priority: "Medium", status: "To Do", subteam: "General" });

  async function createTask() {
    if (!form.title) return;
    const member = members.find(m => m.id === form.assigned_to);
    await adminProxy('hub_tasks', 'insert', { ...form, assigned_name: member ? member.full_name || member.username : "" });
    setForm({ title: "", description: "", assigned_to: "", assigned_name: "", due_date: "", priority: "Medium", status: "To Do", subteam: "General" });
    reload(); showToast("✅ Task created.");
  }

  async function updateStatus(id, status) {
    await adminProxy('hub_tasks', 'update', { id, updates: { status } });
    reload();
  }

  async function deleteTask(id) {
    await adminProxy('hub_tasks', 'delete', { id });
    reload(); showToast("🗑️ Task deleted.", "#ef4444");
  }

  const groups = { "To Do": [], "In Progress": [], Done: [] };
  tasks.forEach(t => { if (groups[t.status]) groups[t.status].push(t); });
  const pColor = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444" };
  const isOverdue = t => t.due_date && t.status !== "Done" && new Date(t.due_date) < new Date();

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Hub Task Management</h1>
      <div style={S.card}>
        <div style={S.cardTitle}>Create Task</div>
        <div style={S.formCol}>
          <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} />
          <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={S.input} />
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <select value={form.subteam} onChange={e => setForm({ ...form, subteam: e.target.value })} style={S.select}>
              {SUBTEAMS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={S.select}>
              <option value="">Unassigned</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.username} ({m.subteam || "General"})</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={S.input} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={S.select}>
              {["Low", "Medium", "High"].map(p => <option key={p}>{p}</option>)}
            </select>
            <button onClick={createTask} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>Create</button>
          </div>
        </div>
      </div>
      <div style={{ ...S.taskColumns, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)' }}>
        {Object.entries(groups).map(([status, list]) => (
          <div key={status} style={S.taskCol}>
            <div style={S.taskColHeader}>{status} <span style={S.taskCount}>{list.length}</span></div>
            {list.map(t => (
              <div key={t.id} style={{ ...S.taskCard, borderLeft: `3px solid ${pColor[t.priority] || "#64748b"}`, background: isOverdue(t) ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)" }}>
                <div style={S.taskTitle}>{t.title}</div>
                {t.description && <div style={S.taskDesc}>{t.description}</div>}
                {t.subteam && t.subteam !== "General" && <div style={{ fontSize: 10, color: SUBTEAM_COLORS[t.subteam], marginBottom: 4, fontFamily: "monospace" }}>{t.subteam}</div>}
                <div style={S.taskMeta}>
                  {t.assigned_name && <span>👤 {t.assigned_name}</span>}
                  {t.due_date && <span style={{ color: isOverdue(t) ? "#ef4444" : "#64748b" }}>📅 {t.due_date}</span>}
                </div>
                <div style={S.taskActions}>
                  <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} style={{ ...S.select, fontSize: 11, padding: "4px 8px" }}>
                    {["To Do", "In Progress", "Done"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => deleteTask(t.id)} style={S.btnDanger}>✕</button>
            </div>
            </div>
          ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HUB CALENDAR ──────────────────────────────────────────
function HubCalendarAdmin({ events, reload, showToast, isMobile }) {
  const [form, setForm] = useState({ title: "", type: "event", date: "", end_date: "", time: "", description: "", all_day: true });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const EVENT_TYPES = [{ value: "event", label: "Event" }, { value: "deadline", label: "Deadline" }, { value: "meeting", label: "Meeting" }, { value: "competition", label: "Competition" }, { value: "other", label: "Other" }];

  async function saveEvent() {
    if (!form.title || !form.date) return showToast("Title and date required.", "#ef4444");
    setSaving(true);
    if (editingId) {
      await adminProxy('hub_calendar', 'update', { id: editingId, updates: form });
      showToast("✅ Event updated.");
    } else {
      await adminProxy('hub_calendar', 'insert', form);
      showToast("✅ Event created.");
    }
    setSaving(false); setEditingId(null);
    setForm({ title: "", type: "event", date: "", end_date: "", time: "", description: "", all_day: true });
    reload();
  }

  async function deleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    await adminProxy('hub_calendar', 'delete', { id });
    showToast("🗑️ Deleted.", "#ef4444"); reload();
  }

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Hub Calendar</h1>
      <div style={S.card}>
        <div style={S.cardTitle}>{editingId ? "Edit Event" : "Add Event"}</div>
        <div style={S.formCol}>
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={S.input} />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={S.select}>
              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={S.input} />
            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={S.input} />
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={S.input} />
          </div>
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...S.input, minHeight: 80, resize: "vertical" }} />
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <label style={{ color: "#94a3b8", fontSize: 13, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} /> All day
            </label>
            <button onClick={saveEvent} disabled={saving} style={S.btnPrimary}>{saving ? "Saving..." : editingId ? "Save" : "Add Event"}</button>
            {editingId && <button onClick={() => { setEditingId(null); setForm({ title: "", type: "event", date: "", end_date: "", time: "", description: "", all_day: true }); }} style={S.btnGhost}>Cancel</button>}
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>All Events</div>
        {events.map(ev => (
          <div key={ev.id} style={{ marginBottom: 12, padding: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontFamily: "'Orbitron', sans-serif", color: "#f1f5f9", fontWeight: 700 }}>{ev.title}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>{ev.type?.toUpperCase()} · {ev.date}{ev.time ? ` · ${ev.time}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setEditingId(ev.id); setForm({ title: ev.title || "", type: ev.type || "event", date: ev.date || "", end_date: ev.end_date || "", time: ev.time || "", description: ev.description || "", all_day: ev.all_day !== false }); }} style={S.btnGhost}>Edit</button>
                <button onClick={() => deleteEvent(ev.id)} style={S.btnDanger}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && <div style={{ color: "#64748b", fontSize: 14 }}>No events yet.</div>}
      </div>
    </div>
  );
}

// ── SPONSOR ASSIGNMENT ────────────────────────────────────
function SponsorAssign({ sponsors, members, reload, showToast, isMobile }) {
  const [assignments, setAssignments] = useState({});
  const [filter, setFilter] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState({});
  const logoRefs = useRef({});

  useEffect(() => {
    const init = {};
    sponsors.forEach(s => { init[s.id] = s.assigned_member_id || ""; });
    setAssignments(init);
  }, [sponsors]);

  async function saveAssignment(sponsorId, memberId) {
    const member = members.find(m => m.id === memberId);
    await adminProxy('sponsors', 'update', { id: sponsorId, updates: { assigned_member_id: memberId || null, assigned_member_name: member ? member.full_name || member.username : null } });
    reload();
  }

  async function uploadSponsorLogo(sponsorId, file) {
    if (!file) return;
    setLogoUploading(u => ({ ...u, [sponsorId]: true }));
    try {
      const url = await uploadFile(file, 'team-assets');
      if (url) {
        await adminProxy('sponsors', 'update', { id: sponsorId, updates: { logo_url: url } });
        showToast("✅ Logo uploaded.");
        reload();
      } else {
        showToast("Upload failed.", "#ef4444");
      }
    } catch (e) {
      showToast("Logo upload failed: " + (e.message || e), "#ef4444");
    } finally {
      setLogoUploading(u => ({ ...u, [sponsorId]: false }));
    }
  }

  async function saveLogoUrl(sponsorId, url) {
    try {
      await adminProxy('sponsors', 'update', { id: sponsorId, updates: { logo_url: url } });
      showToast("✅ Logo saved.");
      reload();
    } catch (e) {
      showToast("Logo save failed: " + (e.message || e), "#ef4444");
    }
  }

  async function autoAssign() {
    if (!members.length) return;
    setAutoLoading(true);
    const unassigned = sponsors.filter(s => !s.assigned_member_id);
      for (let i = 0; i < unassigned.length; i++) {
        const member = members[i % members.length];
        await adminProxy('sponsors', 'update', { id: unassigned[i].id, updates: { assigned_member_id: member.id, assigned_member_name: member.full_name || member.username } });
      }
    reload(); setAutoLoading(false);
    showToast(`✅ Auto-assigned ${unassigned.length} sponsors.`);
  }

  const filtered = sponsors.filter(s => s.company.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Sponsors</h1>
      <div style={S.card}>
        <div style={{ ...S.statRow, gap: isMobile ? 8 : 14 }}>
          {[{ label: "Total", val: sponsors.length, color: "#3b82f6" }, { label: "Assigned", val: sponsors.filter(s => s.assigned_member_id).length, color: "#22c55e" }, { label: "Unassigned", val: sponsors.filter(s => !s.assigned_member_id).length, color: "#f59e0b" }].map(s => (
            <div key={s.label} style={{ ...S.statCard, minWidth: isMobile ? 90 : 140, padding: isMobile ? "12px 8px" : "20px", flex: isMobile ? "0 1 calc(33.33% - 8px)" : undefined }}>
              <div style={{ ...S.statNum, color: s.color, fontSize: isMobile ? 18 : 24 }}>{s.val}</div>
              <div style={S.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={autoAssign} disabled={autoLoading} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>{autoLoading ? "Assigning..." : "⚡ Auto-Assign Evenly"}</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 10, marginBottom: 14 }}>
          <div style={S.cardTitle}>Sponsor Management</div>
          <input placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} style={{ ...S.input, maxWidth: isMobile ? '100%' : 220, marginBottom: 0 }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ ...S.table, fontSize: isMobile ? 12 : undefined }}>
            <thead><tr>
              <th style={S.th}>Logo</th><th style={S.th}>Company</th><th style={S.th}>Status</th><th style={S.th}>Assigned To</th><th style={S.th}>Save</th>
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ ...S.td, verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.company} style={{ width: 32, height: 32, borderRadius: 6, objectFit: "contain", background: "rgba(255,255,255,0.05)" }}
                          onError={e => { e.target.style.display = "none" }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 6, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#475569" }}>—</div>
                      )}
                      <input type="file" accept="image/*" style={{ display: "none" }} ref={el => { if (el) logoRefs.current[s.id + "-file"] = el; }} onChange={e => { if (e.target.files[0]) uploadSponsorLogo(s.id, e.target.files[0]); }} />
                      <button onClick={() => { const el = logoRefs.current[s.id + "-file"]; if (el) el.click(); }} disabled={logoUploading[s.id]} style={{ ...S.btnGhost, fontSize: 10, padding: "3px 8px" }}>{logoUploading[s.id] ? "..." : "📸"}</button>
                    </div>
                  </td>
                  <td style={S.td}>{s.company}</td>
                  <td style={S.td}><span style={{ ...S.roleBadge, background: "rgba(255,255,255,0.05)", color: "#64748b" }}>{s.status || "Not Contacted"}</span></td>
                  <td style={S.td}>
                    <select value={assignments[s.id] || ""} onChange={e => setAssignments({ ...assignments, [s.id]: e.target.value })} style={{ ...S.select, fontSize: 12 }}>
                      <option value="">Unassigned</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.username}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>
                    <button onClick={() => { saveAssignment(s.id, assignments[s.id]); showToast(`✅ Saved: ${s.company}`); }} style={{ ...S.btnGhost, fontSize: 11, padding: "4px 10px" }}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── CAPTAINS ADMIN ────────────────────────────────────────
function CaptainsAdmin({ captains, reload, showToast, isMobile }) {
  const [form, setForm] = useState({ name: "", position: "", bio: "", sort_order: 0 });
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const fileRef = useRef(null);
  const editFileRef = useRef(null);

  async function createCaptain() {
    if (!form.name || !form.position) return;
    setUploading(true);
    try {
      let photo_url = "";
      if (photoFile) photo_url = (await uploadFile(photoFile)) || "";
      await adminProxy("captains", "insert", { ...form, photo_url });
      setForm({ name: "", position: "", bio: "", sort_order: 0 });
      setPhotoFile(null);
      reload();
      showToast("✅ Person added.");
    } catch (e) {
      showToast(String(e.message || e), "#ef4444");
    } finally {
      setUploading(false);
    }
  }

  async function updateCaptain(id) {
    setUploading(true);
    try {
      const update = { ...editData };
      if (editPhotoFile) {
        const url = await uploadFile(editPhotoFile);
        if (url) update.photo_url = url;
      }
      await adminProxy("captains", "update", { id, updates: update });
      setEditId(null);
      setEditPhotoFile(null);
      reload();
      showToast("✅ Updated.");
    } catch (e) {
      showToast(String(e.message || e), "#ef4444");
    } finally {
      setUploading(false);
    }
  }

  async function deleteCaptain(id) {
    if (!confirm("Remove?")) return;
    await adminProxy('captains', 'delete', { id });
    reload(); showToast("🗑️ Removed.", "#ef4444");
  }

  async function handleDrop(e, targetId) {
    e.preventDefault();
    const sourceId = draggingId;
    if (!sourceId || sourceId === targetId) return;
    const ordered = [...captains].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const si = ordered.findIndex(c => c.id === sourceId);
    const ti = ordered.findIndex(c => c.id === targetId);
    if (si < 0 || ti < 0) return;
    const [moved] = ordered.splice(si, 1);
    ordered.splice(ti, 0, moved);
    try {
      await Promise.all(
        ordered.map((c, i) =>
          adminProxy("captains", "update", { id: c.id, updates: { sort_order: i } })
        )
      );
      showToast("✅ Order saved.");
    } catch (err) {
      showToast(String(err.message || err), "#ef4444");
    } finally {
      setDraggingId(null);
      setDragOverId(null);
      reload();
    }
  }

  const sortedCaptains = [...captains].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Leadership</h1>
      <div style={S.card}>
        <div style={S.cardTitle}>Add Person</div>
        <div style={S.formCol}>
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <input placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.input} />
            <input placeholder="Position *" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} style={S.input} />
            <input placeholder="Order" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} style={{ ...S.input, maxWidth: isMobile ? '100%' : 100 }} />
          </div>
          <textarea placeholder="Bio (optional)" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} style={{ ...S.input, minHeight: 60, resize: "vertical" }} />
          <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
            <button onClick={() => fileRef.current?.click()} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>{photoFile ? `📸 ${photoFile.name}` : "Upload Photo"}</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => setPhotoFile(e.target.files[0])} />
            <button onClick={createCaptain} disabled={uploading} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined, opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading..." : "Add Person"}</button>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Current Leadership — Drag to reorder</div>
        {sortedCaptains.map(c => (
          <div key={c.id} draggable onDragStart={() => setDraggingId(c.id)} onDragOver={e => { e.preventDefault(); setDragOverId(c.id); }} onDrop={e => handleDrop(e, c.id)} onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
            style={{ ...S.memberRow, opacity: draggingId === c.id ? 0.4 : 1, background: dragOverId === c.id && draggingId !== c.id ? "rgba(239,68,68,0.06)" : "transparent", border: dragOverId === c.id && draggingId !== c.id ? "1px dashed rgba(239,68,68,0.4)" : "1px solid transparent", cursor: "grab" }}>
            {editId === c.id ? (
              <div style={{ ...S.formCol, flex: 1 }}>
                <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
                  <input value={editData.name || ""} onChange={e => setEditData({ ...editData, name: e.target.value })} style={S.input} placeholder="Name" />
                  <input value={editData.position || ""} onChange={e => setEditData({ ...editData, position: e.target.value })} style={S.input} placeholder="Position" />
                </div>
                <textarea value={editData.bio || ""} onChange={e => setEditData({ ...editData, bio: e.target.value })} style={{ ...S.input, minHeight: 50, resize: "vertical" }} placeholder="Bio" />
                <div style={{ ...S.formRow, flexDirection: isMobile ? 'column' : 'row' }}>
                  <button onClick={() => editFileRef.current?.click()} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>{editPhotoFile ? `📸 ${editPhotoFile.name}` : "Change Photo"}</button>
                  <input ref={editFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => setEditPhotoFile(e.target.files[0])} />
                  <button onClick={() => updateCaptain(c.id)} disabled={uploading} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>Save</button>
                  <button onClick={() => setEditId(null)} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <span style={{ color: "#475569", fontSize: 18, cursor: "grab" }}>⠿</span>
                  <CaptainPhoto photoUrl={c.photo_url} name={c.name} size={48} />
                  <div>
                    <div style={S.memberName}>{c.name}</div>
                    <div style={{ fontSize: 12, color: "#ef4444", fontFamily: "monospace" }}>{c.position}</div>
                    {c.bio && <div style={{ fontSize: 11, color: "#64748b", maxWidth: 360 }}>{c.bio}</div>}
                  </div>
                </div>
                <div style={S.memberActions}>
                  <button onClick={() => { setEditId(c.id); setEditData({ name: c.name, position: c.position, bio: c.bio, sort_order: c.sort_order }); }} style={S.btnGhost}>Edit</button>
                  <button onClick={() => deleteCaptain(c.id)} style={S.btnDanger}>Remove</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SUGGESTIONS ───────────────────────────────────────────
function Suggestions({ suggestions, reload, showToast }) {
  async function del(id) {
    await adminProxy('suggestions', 'delete', { id });
    reload(); showToast("🗑️ Deleted.", "#ef4444");
  }
  return (
    <div>
      <h1 style={S.pageTitle}>Suggestions ({suggestions.length})</h1>
      {suggestions.length === 0 && <div style={{ color: "#64748b" }}>No suggestions yet.</div>}
      {suggestions.map(s => (
        <div key={s.id} style={{ ...S.card, marginBottom: 12 }}>
          <div style={{ color: "#f1f5f9", marginBottom: 8, lineHeight: 1.6 }}>{s.message}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>{new Date(s.submitted_at).toLocaleString()}</div>
            <button onClick={() => del(s.id)} style={S.btnDanger}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const PRIVACY_FALLBACK = `...
        <h1>Privacy Policy</h1>
        <p class="updated">Last Updated: May 26, 2026</p>
        <p>FRC Team 4550 "Something's Bruin" ("we," "our," or "us") operates the website at <a href="https://frc4550.org">frc4550.org</a> (the "Site"). This Privacy Policy explains how we collect, use, disclose, and protect your information when you visit our Site or use our services.</p>
        <h2>1. Information We Collect</h2>
        <h3>Information You Provide to Us</h3>
        <ul>
          <li><strong>Member Hub Accounts:</strong> When team members register for the Member Hub, we collect your name, username, and any information you provide in your profile.</li>
          <li><strong>Suggestions &amp; Feedback:</strong> If you submit a suggestion or feedback through our Site, we collect the content of your submission.</li>
          <li><strong>Contact Forms:</strong> If you email us or use a contact form, we collect your email address and the contents of your message.</li>
          <li><strong>Sponsor Information:</strong> Sponsor contact information (company name, email, phone) is stored in our secure database for outreach purposes.</li>
        </ul>
        <h3>Information Collected Automatically</h3>
        <ul>
          <li><strong>Log Data:</strong> Our servers automatically record certain information when you visit the Site, including your IP address, browser type, operating system, referring URLs, and pages visited.</li>
          <li><strong>Cookies:</strong> We use essential cookies for authentication (login sessions). We do not use tracking cookies or third-party advertising cookies.</li>
          <li><strong>Service Providers:</strong> We use Vercel (hosting) and Cloudflare (database via D1), which may process data as described in their respective privacy policies.</li>
        </ul>
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect for the following purposes:</p>
        <ul>
          <li>To operate and maintain the Member Hub and team management tools</li>
          <li>To manage sponsor relationships and outreach</li>
          <li>To communicate with team members, parents, and sponsors</li>
          <li>To improve our website and team operations</li>
          <li>To comply with legal obligations</li>
        </ul>
        <h2>3. Data Inventory</h2>
        <p>The following table details every data point collected by our Site and services:</p>
        <div style="overflow-x:auto;margin-bottom:16px">
          <table style="width:100%;border-collapse:collapse;font-size:12px;color:#cbd5e1;font-family:'Share Tech Mono',monospace">
            <thead>
              <tr style="background:rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.1)">
                <th style="padding:10px 12px;text-align:left;color:#f1f5f9">Data Point</th>
                <th style="padding:10px 12px;text-align:left;color:#f1f5f9">Purpose</th>
                <th style="padding:10px 12px;text-align:left;color:#f1f5f9">Storage</th>
                <th style="padding:10px 12px;text-align:left;color:#f1f5f9">Retention</th>
                <th style="padding:10px 12px;text-align:left;color:#f1f5f9">Shared With</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:8px 12px">Name / Username</td><td style="padding:8px 12px">Member Hub identification</td><td style="padding:8px 12px">Cloudflare D1</td><td style="padding:8px 12px">Until deactivation</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02)"><td style="padding:8px 12px">Email address</td><td style="padding:8px 12px">Communication, login</td><td style="padding:8px 12px">Cloudflare D1</td><td style="padding:8px 12px">Until deactivation</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:8px 12px">Phone number</td><td style="padding:8px 12px">Sponsor outreach</td><td style="padding:8px 12px">Cloudflare D1</td><td style="padding:8px 12px">Until requested deletion</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02)"><td style="padding:8px 12px">Task assignments</td><td style="padding:8px 12px">Team coordination</td><td style="padding:8px 12px">Cloudflare D1</td><td style="padding:8px 12px">Until deleted by user</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:8px 12px">Calendar events</td><td style="padding:8px 12px">Team scheduling</td><td style="padding:8px 12px">Cloudflare D1</td><td style="padding:8px 12px">Until deleted by user</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02)"><td style="padding:8px 12px">Media uploads</td><td style="padding:8px 12px">Team gallery</td><td style="padding:8px 12px">GitHub</td><td style="padding:8px 12px">Until deleted by user</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:8px 12px">Suggestions / Feedback</td><td style="padding:8px 12px">Team improvement</td><td style="padding:8px 12px">Cloudflare D1</td><td style="padding:8px 12px">Indefinite (anonymized)</td><td style="padding:8px 12px">Never sold</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02)"><td style="padding:8px 12px">IP address</td><td style="padding:8px 12px">Analytics, security</td><td style="padding:8px 12px">Vercel logs</td><td style="padding:8px 12px">30 days</td><td style="padding:8px 12px">Vercel (processor)</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05)"><td style="padding:8px 12px">Login sessions</td><td style="padding:8px 12px">Authentication</td><td style="padding:8px 12px">LocalStorage</td><td style="padding:8px 12px">Until logout</td><td style="padding:8px 12px">Never</td></tr>
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(255,255,255,0.02)"><td style="padding:8px 12px">Camera / Photos</td><td style="padding:8px 12px">Inventory AI identification</td><td style="padding:8px 12px">GitHub</td><td style="padding:8px 12px">Until deleted by user</td><td style="padding:8px 12px">None (AI in-memory only)</td></tr>
            </tbody>
          </table>
        </div>
        <h2>4. Legal Basis for Processing (GDPR)</h2>
        <p>While we are based in the United States, if you are accessing our Site from the European Economic Area (EEA), our legal basis for collecting and using your information depends on the specific data concerned and the context in which we collect it. We typically process your information on the following grounds:</p>
        <ul>
          <li><strong>Consent:</strong> Where you have given us explicit permission.</li>
          <li><strong>Legitimate Interests:</strong> For operating our robotics team and website.</li>
          <li><strong>Legal Obligation:</strong> Where required by applicable law.</li>
        </ul>
        <h2>5. Data Sharing and Disclosure</h2>
        <p>We do not sell your personal information to third parties. We may share your information in the following circumstances:</p>
        <ul>
          <li><strong>Service Providers:</strong> With Vercel (hosting), Cloudflare (database via D1), and other service providers who help us operate the Site.</li>
          <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental regulation.</li>
          <li><strong>Protection of Rights:</strong> To protect the rights, property, or safety of our team, our members, or others.</li>
          <li><strong>School District:</strong> Cherry Creek School District may have access to certain information as part of oversight of the team as a school-affiliated organization.</li>
        </ul>
        <h2>6. Data Security</h2>
        <p>We implement appropriate technical and organizational security measures to protect your information, including encryption in transit (HTTPS), secure authentication for the Member Hub, and restricted database access. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>
        <h2>7. Data Retention</h2>
        <p>We retain your information for as long as necessary to fulfill the purposes described in this Privacy Policy, or as required by applicable law. Member Hub accounts may be deactivated upon request. Completed tasks older than 24 hours are automatically deleted.</p>
        <h2>8. Your Rights</h2>
        <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
        <ul>
          <li><strong>Access:</strong> Request a copy of the information we hold about you.</li>
          <li><strong>Correction:</strong> Request that we correct inaccurate or incomplete information.</li>
          <li><strong>Deletion:</strong> Request that we delete your information, subject to certain exceptions.</li>
          <li><strong>Portability:</strong> Request a copy of your information in a machine-readable format.</li>
          <li><strong>Opt-Out:</strong> Opt out of future communications at any time.</li>
        </ul>
        <p>To exercise any of these rights, please contact us at <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>.</p>
        <h2>9. California Privacy Rights (CCPA)</h2>
        <p>If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with additional rights regarding your personal information:</p>
        <ul>
          <li>You have the right to know what personal information we collect, use, disclose, and sell.</li>
          <li>We do not sell your personal information.</li>
          <li>You have the right to request deletion of your personal information.</li>
          <li>You have the right to non-discrimination for exercising your CCPA rights.</li>
        </ul>
        <p>To make a CCPA request, please contact us at <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>.</p>
        <h2>10. Children Privacy (COPPA)</h2>
        <p>Our Site is intended for general audiences. The Member Hub is restricted to team members and authorized personnel. We do not knowingly collect personal information from children under 13 without parental consent. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete such information. If you believe a child under 13 has provided us with personal information, please contact us immediately.</p>
        <h2>11. Third-Party Links</h2>
        <p>Our Site may contain links to third-party websites, including YouTube, Instagram, and donation platforms. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information.</p>
        <h2>12. Changes to This Privacy Policy</h2>
        <p>We may update this Privacy Policy from time to time. We will notify users of material changes by posting the updated policy on this page with a new "Last Updated" date. Continued use of the Site after changes constitutes acceptance of the updated policy.</p>
        <h2>13. Contact Us</h2>
        <p>If you have questions, concerns, or requests regarding this Privacy Policy, please contact us at:</p>
        <p>
          FRC Team 4550 "Something's Bruin"<br />
          Cherry Creek High School<br />
          9300 E Union Ave<br />
          Greenwood Village, CO 80111<br />
          Email: <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>
        </p>`;

const TERMS_FALLBACK = `...
        <h1>Terms &amp; Conditions</h1>
        <p class="updated">Last Updated: May 26, 2026</p>
        <p>Welcome to FRC Team 4550 "Something's Bruin." By accessing or using our website at <a href="https://frc4550.org">frc4550.org</a> (the "Site"), you agree to be bound by these Terms &amp; Conditions ("Terms"). If you do not agree with any part of these Terms, you must not use the Site.</p>
        <h2>1. Acceptance of Terms</h2>
        <p>By using the Site, you affirm that you are at least 13 years of age, or if you are under 13, that you have obtained parental consent to use the Site. The Member Hub is restricted to current team members, alumni, mentors, and authorized school personnel.</p>
        <h2>2. Description of Services</h2>
        <p>FRC Team 4550 provides the following services through the Site:</p>
        <ul>
          <li><strong>Public Website:</strong> Information about the team, its history, sponsors, media gallery, and contact information.</li>
              <li><strong>Member Hub:</strong> A password-protected portal for team members to manage tasks, calendar events, announcements, media, resources, and inventory.</li>
          <li><strong>Sponsor Tracker:</strong> A password-protected tool for managing sponsor relationships and outreach.</li>
          <li><strong>Public Media Gallery:</strong> A publicly accessible gallery of team photos and videos.</li>
        </ul>
        <h2>3. User Accounts &amp; Responsibilities</h2>
        <p>Access to the Member Hub and Sponsor Tracker requires authorization. By using these services:</p>
        <ul>
          <li>You are responsible for maintaining the confidentiality of any login credentials.</li>
          <li>You are responsible for all activity that occurs under your account.</li>
          <li>You agree to notify us immediately of any unauthorized use of your account.</li>
          <li>You agree not to share access credentials with unauthorized individuals.</li>
          <li>We reserve the right to revoke access at any time for any reason, including violation of these Terms or team policies.</li>
        </ul>
        <h2>4. Acceptable Use</h2>
        <p>You agree not to use the Site for any unlawful purpose or in violation of these Terms. Prohibited activities include:</p>
        <ul>
          <li>Attempting to access restricted areas without authorization</li>
          <li>Uploading malicious code, viruses, or harmful content</li>
          <li>Interfering with the operation of the Site or servers</li>
          <li>Harassing, threatening, or abusing other users</li>
          <li>Posting inappropriate, offensive, or discriminatory content</li>
          <li>Using the Site to violate any applicable laws or regulations</li>
          <li>Scraping, crawling, or mining the Site without permission</li>
        </ul>
        <h2>5. User-Generated Content</h2>
        <p>Users of the Member Hub may post content such as task descriptions, announcements, comments, and uploaded media. By posting content:</p>
        <ul>
          <li>You retain ownership of your content but grant us a non-exclusive, royalty-free license to store, display, and use it for team purposes.</li>
          <li>You represent that your content does not violate any third-party rights or applicable laws.</li>
          <li>We reserve the right to moderate, edit, or remove any content at our discretion.</li>
        </ul>
        <h2>6. Intellectual Property</h2>
        <p>The Team 4550 name, logos, branding, and website design are the intellectual property of FRC Team 4550 and Cherry Creek School District. Unauthorized use is prohibited. The content on this Site, including text, graphics, photos, and videos, is protected by copyright and other intellectual property laws unless otherwise noted.</p>
        <h2>7. Donations &amp; Payments</h2>
        <p>Donations made through our Site are processed by third-party payment processors (Vanco Events). We do not store or process credit card information directly. All donations are subject to the terms and privacy policies of the payment processor. Donations are generally non-refundable, except as required by law.</p>
        <h2>8. Third-Party Services</h2>
        <p>Our Site integrates with third-party services including:</p>
        <ul>
          <li>Cloudflare D1 (database), GitHub (file storage)</li>
          <li>Vercel (hosting)</li>
          <li>YouTube (video embedding)</li>
          <li>Instagram (social media linking)</li>
          <li>Google Calendar / iCal (calendar subscriptions)</li>
          <li>Discord (announcement notifications)</li>
          <li>Groq AI (CSV data parsing)</li>
        </ul>
        <p>We are not responsible for the content, privacy practices, or terms of these third-party services. Your use of these services is subject to their respective terms and policies.</p>
        <h2>9. Limitation of Liability</h2>
        <p>To the fullest extent permitted by applicable law, FRC Team 4550, its members, mentors, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the Site. This includes, but is not limited to, damages for loss of data, loss of profits, or service interruption.</p>
        <h2>10. Disclaimer of Warranties</h2>
        <p>The Site is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. We do not warrant that the Site will be uninterrupted, error-free, secure, or free from viruses or other harmful components. We reserve the right to modify, suspend, or discontinue any part of the Site at any time without notice.</p>
        <h2>11. Indemnification</h2>
        <p>You agree to indemnify, defend, and hold harmless FRC Team 4550, its members, mentors, and affiliates from any claims, liabilities, damages, losses, or expenses arising out of your use of the Site, your violation of these Terms, or your violation of any rights of a third party.</p>
        <h2>12. Termination</h2>
        <p>We reserve the right to terminate or suspend your access to the Site, including Member Hub access, at any time without prior notice for violation of these Terms, team policies, or for any other reason. Upon termination, your right to use the Site immediately ceases.</p>
        <h2>13. Governing Law</h2>
        <p>These Terms shall be governed by and construed in accordance with the laws of the State of Colorado, without regard to its conflict of law provisions. Any legal action arising out of these Terms shall be brought in the courts of Arapahoe County, Colorado.</p>
        <h2>14. Changes to Terms</h2>
        <p>We reserve the right to update or modify these Terms at any time. Changes will be effective immediately upon posting. Your continued use of the Site after any changes constitutes acceptance of the new Terms. We encourage you to review these Terms periodically.</p>
        <h2>15. Contact Information</h2>
        <p>For questions or concerns regarding these Terms, please contact us at:</p>
        <p>
          FRC Team 4550 "Something's Bruin"<br />
          Cherry Creek High School<br />
          9300 E Union Ave<br />
          Greenwood Village, CO 80111<br />
          Email: <a href="mailto:team4550frc@gmail.com">team4550frc@gmail.com</a>
        </p>`;

const HUB_TILES = [
  { id:"projector", icon:"📡", label:"Meeting Projector" },
  { id:"calendar", icon:"📅", label:"Team Calendar" },
  { id:"tasks", icon:"✅", label:"Task Board" },
  { id:"announcements", icon:"📣", label:"Announcements" },
  { id:"media", icon:"📸", label:"Media Gallery" },
  { id:"resources", icon:"📁", label:"Resources" },
  { id:"inventory", icon:"📦", label:"Inventory" },
  { id:"sponsor-tracker", icon:"🤝", label:"Sponsor Tracker" },
  { id:"forms", icon:"📋", label:"Forms" },
  { id:"articles", icon:"📝", label:"Articles" },
];

const SITE_SECTIONS = [
  { id: "banners", icon: "🖼️", label: "Banners & Posters" },
  { id: "about", icon: "ℹ️", label: "About Section" },
  { id: "team", icon: "👥", label: "Our Team" },
  { id: "subteams", icon: "🔧", label: "Sub-Teams" },
  { id: "flip", icon: "📖", label: "Flipped Story Section" },
  { id: "outreach", icon: "🌍", label: "Community Outreach" },
  { id: "media", icon: "🖼️", label: "Media Gallery" },
  { id: "articles", icon: "📝", label: "Team Articles" },
  { id: "social", icon: "📸", label: "Social Media" },
  { id: "sponsors", icon: "🤝", label: "Sponsors + Ribbon" },
  { id: "donate", icon: "💸", label: "Make a Donation" },
  { id: "contact", icon: "✉️", label: "Contact" },
];

// ── BANNER ROW (admin preview with crop-cut tiles) ──────
function BannerRow({ url, isMobile, onRemove }) {
  const [dims, setDims] = useState(null);
  const thumbW = isMobile ? 90 : 120;
  const ratio = dims && dims.w && dims.h ? dims.w / dims.h : 0;
  const needsCrop = ratio > 0 && ratio < 2;
  const cutH = needsCrop ? dims.h - dims.w / 2 : 0;
  const scale = dims && dims.w ? thumbW / dims.w : 0;
  const tileH = f => Math.max(6, Math.round(f / scale));
  const vtile = (pos) => ({
    width: thumbW,
    height: tileH(cutH / 2),
    backgroundImage: `url(${url})`,
    backgroundSize: `${thumbW}px ${Math.round(dims.h / scale)}px`,
    backgroundPosition: `0 ${pos}`,
    backgroundRepeat: 'no-repeat',
    overflow: 'hidden',
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", flexWrap: 'wrap' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: thumbW, height: needsCrop ? thumbW / 2 : undefined, borderRadius: 6, overflow: "hidden", background: "rgba(255,255,255,0.05)", flexShrink: 0, position: "relative" }}>
          <img src={url} alt="" onLoad={e => setDims({ w: e.target.naturalWidth, h: e.target.naturalHeight })} style={{ width: "100%", height: needsCrop ? "100%" : "auto", objectFit: needsCrop ? "cover" : "contain", display: "block" }} />
        </div>
        {needsCrop && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 10, color: "#f87171", fontFamily: "monospace" }}>cut off:</div>
            <div style={{ ...vtile('0%'), borderRadius: 4, border: "1px solid rgba(248,113,113,0.4)" }} />
            <div style={{ ...vtile('100%'), borderRadius: 4, border: "1px solid rgba(248,113,113,0.4)" }} />
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{url}</span>
      {onRemove && <button onClick={onRemove} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>&times;</button>}
    </div>
  );
}

function LogoThumb({ url, alt, size = 44 }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: 6, background: "rgba(255,255,255,0.08)", color: "#cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(14, size * 0.45), flexShrink: 0, fontWeight: "bold" }}>
        {(alt || "?").charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      onError={() => setErr(true)}
      style={{ width: size, height: size, borderRadius: 6, objectFit: "contain", background: "rgba(255,255,255,0.05)", flexShrink: 0 }}
    />
  );
}

// ── LANDING BANNERS / POSTERS MANAGER (module scope: state survives re-renders) ──
function BannerManager({ vals, setVals, saveKey, showToast, isMobile }) {
  const [banners, setBanners] = useState(() => {
    try { return JSON.parse(vals.landing_banners || "[]"); } catch { return []; }
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    try { setBanners(JSON.parse(vals.landing_banners || "[]")); } catch { setBanners([]); }
  }, [vals.landing_banners]);

  async function handleFiles(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      try {
        const url = await uploadFile(file, 'team-assets');
        if (url) uploaded.push(url);
      } catch {}
    }
    if (uploaded.length) {
      const updated = [...banners, ...uploaded];
      setBanners(updated);
      setVals(v => ({ ...v, landing_banners: JSON.stringify(updated) }));
      showToast(`✅ Uploaded ${uploaded.length} banner${uploaded.length > 1 ? "s" : ""}.`);
    } else {
      showToast("Upload failed.", "#ef4444");
    }
    setUploading(false);
    e.target.value = "";
  }

  function removeBanner(idx) {
    const updated = banners.filter((_, i) => i !== idx);
    setBanners(updated);
    setVals(v => ({ ...v, landing_banners: JSON.stringify(updated) }));
  }

  return (
    <div style={{ ...S.card, marginTop: 16 }}>
      <div style={S.cardTitle}>Landing Banners / Posters</div>
      <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 10, marginBottom: 12, alignItems: isMobile ? 'stretch' : 'center' }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#e2e8f0", flexShrink: 0 }}>
          <input type="checkbox" checked={vals.landing_banners_enabled !== "false"} onChange={e => setVals({ ...vals, landing_banners_enabled: e.target.checked ? "true" : "false" })} style={{ width: 16, height: 16, cursor: "pointer" }} />
          Show on homepage
        </label>
        <button onClick={() => saveKey("landing_banners_enabled")} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>Save Toggle</button>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 10 }}>Upload one or more banner/poster images (optimal size: 1200px × 400px):</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => fileRef.current?.click()} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>{uploading ? "Uploading..." : "Upload Banner Images"}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
        {uploading && <span style={{ fontSize: 12, color: "#a78bfa", fontFamily: "monospace" }}>Uploading...</span>}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 10 }}>Current banners:</div>
      {banners.length === 0 && <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace", marginBottom: 10 }}>No banners yet.</div>}
      {banners.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {banners.map((url, i) => (
            <BannerRow key={i} url={url} isMobile={isMobile} onRemove={() => removeBanner(i)} />
          ))}
          <button onClick={async () => { try { await saveKey("landing_banners", JSON.stringify(banners)); } catch (e) { showToast("Save failed: " + (e.message || e), "#ef4444"); } }} style={{ ...S.btnGhost, alignSelf: 'flex-start' }}>Save Banners</button>
        </div>
      )}
    </div>
  );
}

// ── SPONSOR RIBBON MANAGER (module scope: state survives re-renders) ──────────
function SponsorRibbonManager({ vals, setVals, saveKey, showToast, isMobile }) {
  const [ribbonItems, setRibbonItems] = useState(() => {
    try { return JSON.parse(vals.sponsor_ribbon_items || "[]"); } catch { return []; }
  });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [pendingItems, setPendingItems] = useState(() => {
    try { const raw = JSON.parse(sessionStorage.getItem("ribbon_pending") || "[]"); return Array.isArray(raw) ? raw : []; } catch { return []; }
  });
  const fileRef = useRef(null);
  const reviewRef = useRef(null);
  const reviewWasEmpty = useRef(true);

  useEffect(() => {
    try { setRibbonItems(JSON.parse(vals.sponsor_ribbon_items || "[]")); } catch { setRibbonItems([]); }
  }, [vals.sponsor_ribbon_items]);

  useEffect(() => {
    try { sessionStorage.setItem("ribbon_pending", JSON.stringify(pendingItems)); } catch {}
  }, [pendingItems]);

  useEffect(() => {
    if (pendingItems.length > 0 && reviewWasEmpty.current) {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    reviewWasEmpty.current = pendingItems.length === 0;
  }, [pendingItems]);

  async function handleFile(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    const added = [];
    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      try {
        const url = await uploadFile(file, 'team-assets');
        if (!url) { showToast(`"${file.name}" upload failed.`, "#ef4444"); continue; }
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        let name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
        try {
          const r = await fetch("/api/extract-brands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
          });
          if (r.ok) {
            const data = await r.json();
            if (data.brands?.[0]) name = data.brands[0];
          }
        } catch {}
        added.push({ company: name, logo_url: url });
        setProgress({ done: idx + 1, total: files.length });
      } catch { showToast(`"${file.name}" failed to process.`, "#ef4444"); }
    }
    setUploading(false);
    setProgress(null);
    if (added.length > 0) {
      setPendingItems(p => [...p, ...added]);
      showToast(`Added ${added.length} logo${added.length !== 1 ? "s" : ""} — review below.`);
    }
    e.target.value = "";
  }

  function updatePending(idx, patch) {
    setPendingItems(items => items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removePending(idx) {
    setPendingItems(items => items.filter((_, i) => i !== idx));
  }

  function confirmAdd() {
    if (pendingItems.length === 0) return;
    const existing = new Set((ribbonItems || []).map(r => r.logo_url).filter(Boolean));
    const fresh = [];
    const seen = new Set();
    let skipped = 0;
    pendingItems.forEach(p => {
      if (existing.has(p.logo_url) || seen.has(p.logo_url)) { skipped++; return; }
      seen.add(p.logo_url);
      fresh.push(p);
    });
    setPendingItems([]);
    if (fresh.length === 0) { showToast(`No new sponsors — all ${skipped} are duplicates already in the ribbon.`, "#f59e0b"); return; }
    const updated = [...(ribbonItems || []), ...fresh];
    setRibbonItems(updated);
    setVals(v => ({ ...v, sponsor_ribbon_items: JSON.stringify(updated) }));
    showToast(skipped > 0 ? `Added ${fresh.length}, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""} — don't forget Save Ribbon.` : `Added ${fresh.length} — don't forget Save Ribbon.`);
  }

  function removeItem(idx) {
    const updated = ribbonItems.filter((_, i) => i !== idx);
    setRibbonItems(updated);
    setVals(v => ({ ...v, sponsor_ribbon_items: JSON.stringify(updated) }));
  }

  return (
    <div style={{ ...S.card, marginTop: 16 }}>
      <div style={S.cardTitle}>Sponsor Ribbon</div>
      <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 10, marginBottom: 12, alignItems: isMobile ? 'stretch' : 'center' }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#e2e8f0", flexShrink: 0 }}>
          <input type="checkbox" checked={vals.sponsor_bar_enabled !== "false"} onChange={e => setVals({ ...vals, sponsor_bar_enabled: e.target.checked ? "true" : "false" })} style={{ width: 16, height: 16, cursor: "pointer" }} />
          Show on homepage
        </label>
        <button onClick={() => saveKey("sponsor_bar_enabled")} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>Save Toggle</button>
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 10 }}>Upload one or more sponsor logo images — AI will detect the company names automatically:</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => fileRef.current?.click()} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>{uploading ? "Uploading..." : "Upload Logo Images"}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFile} />
        {uploading && progress && <span style={{ fontSize: 12, color: "#a78bfa", fontFamily: "monospace" }}>Processing {progress.done} of {progress.total}...</span>}
      </div>
      {pendingItems.length > 0 && (
        <div ref={reviewRef} style={{ padding: "12px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#22c55e", fontFamily: "monospace", marginBottom: 8 }}>✓ {pendingItems.length} logo{pendingItems.length !== 1 ? "s" : ""} pending — review each below, then click "Add to Ribbon":</div>
          {pendingItems.map((p, pi) => (
            <div key={pi} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: pi < pendingItems.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <LogoThumb url={p.logo_url} alt={p.company} size={48} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <input
                  value={p.company}
                  onChange={e => updatePending(pi, { company: e.target.value })}
                  placeholder="Company name"
                  style={{ ...S.input, width: "100%", marginBottom: 6 }}
                />
                <input
                  value={p.website || ""}
                  onChange={e => updatePending(pi, { website: e.target.value })}
                  placeholder="Website URL (e.g. https://company.com)"
                  style={{ ...S.input, width: "100%", marginBottom: 6, minWidth: 0 }}
                />
              </div>
              <button onClick={() => removePending(pi)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 2 }} title="Remove">&times;</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={confirmAdd} style={S.btnPrimary}>Add {pendingItems.length} to Ribbon</button>
            <button onClick={() => setPendingItems([])} style={S.btnGhost}>Clear</button>
          </div>
        </div>
      )}
      <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 10 }}>Current ribbon sponsors:</div>
      {ribbonItems.length === 0 && <div style={{ fontSize: 12, color: "#475569", fontFamily: "monospace", marginBottom: 10 }}>No sponsors in ribbon yet.</div>}
      {ribbonItems.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {ribbonItems.map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {item.logo_url ? <LogoThumb url={item.logo_url} alt={item.company} size={36} /> : <span style={{ fontSize: 18 }}>🏢</span>}
                <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{item.company}</span>
                <button onClick={() => removeItem(i)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }} title="Remove">&times;</button>
              </div>
              <input
                value={item.website || ""}
                onChange={e => {
                  const updated = ribbonItems.map((r, ri) => ri === i ? { ...r, website: e.target.value } : r);
                  setRibbonItems(updated);
                  setVals(v => ({ ...v, sponsor_ribbon_items: JSON.stringify(updated) }));
                }}
                placeholder="Website URL (e.g. https://company.com)"
                style={{ ...S.input, width: "100%", marginBottom: 0, minWidth: 0 }}
              />
            </div>
          ))}
          <button onClick={async () => { try { await saveKey("sponsor_ribbon_items", JSON.stringify(ribbonItems)); } catch (e) { showToast("Save failed: " + (e.message || e), "#ef4444"); } }} style={{ ...S.btnGhost, alignSelf: 'flex-start' }}>Save Ribbon</button>
        </div>
      )}
    </div>
  );
}

// ── SITE CONFIG ───────────────────────────────────────────
function SiteConfig({ config, logoUrl, setLogoUrl, reload, showToast, isMobile }) {
  const [vals, setVals] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [tileOrder, setTileOrder] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [tileSaving, setTileSaving] = useState(false);
  const [hiddenTiles, setHiddenTiles] = useState([]);
  const [hiddenSaving, setHiddenSaving] = useState(false);
  const [pendingImgUploads, setPendingImgUploads] = useState({});
  const [uploadingImg, setUploadingImg] = useState(null);
  const imgFileRefs = useRef({});
  const adFileRefs = useRef({});
  const [pendingAdUploads, setPendingAdUploads] = useState({});
  const [uploadingAd, setUploadingAd] = useState(null);
  const [aboutMetrics, setAboutMetrics] = useState(() => {
    try {
      const arr = JSON.parse(vals.about_metrics || "[]");
      return Array.isArray(arr) && arr.length ? arr : [{ num: "12+", label: "Years Competing" }, { num: "40–50", label: "Members" }, { num: "2016", label: "World Championship" }, { num: "3", label: "Sub-Teams" }];
    } catch {
      return [{ num: "12+", label: "Years Competing" }, { num: "40–50", label: "Members" }, { num: "2016", label: "World Championship" }, { num: "3", label: "Sub-Teams" }];
    }
  });
  useEffect(() => {
    try {
      const arr = JSON.parse(vals.about_metrics || "[]");
      if (Array.isArray(arr) && arr.length) setAboutMetrics(arr);
    } catch {}
  }, [vals.about_metrics]);
  const [adSlides, setAdSlides] = useState(() => {
    try {
      const arr = JSON.parse(vals.ad_slides || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      const arr = JSON.parse(vals.ad_slides || "[]");
      if (Array.isArray(arr)) setAdSlides(arr);
    } catch {}
  }, [vals.ad_slides]);
  const [qrConfig, setQrConfig] = useState(() => {
    try {
      const j = JSON.parse(vals.qr_config || "{}");
      return j && j.url ? j : { url: "https://frc4550.org" };
    } catch {
      return { url: "https://frc4550.org" };
    }
  });
  useEffect(() => {
    try {
      const j = JSON.parse(vals.qr_config || "{}");
      if (j && j.url) setQrConfig(j);
    } catch {}
  }, [vals.qr_config]);
  const [siteOrder, setSiteOrder] = useState([]);
  const [siteDragId, setSiteDragId] = useState(null);
  const [siteDragOverId, setSiteDragOverId] = useState(null);
  const [openLegal, setOpenLegal] = useState({ privacy_policy: false, terms_conditions: false });
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageMsg, setStorageMsg] = useState("");
  const [storageStatus, setStorageStatus] = useState(null);
  useEffect(() => { setVals({ ...config }); }, [config]);
  useEffect(() => {
    sbFetch("site_config?key=eq.hub_tile_order&select=value").then(r => {
      if (r?.[0]?.value) setTileOrder(r[0].value.split(",").map(s => s.trim()).filter(Boolean));
    });
    sbFetch("site_config?key=eq.hub_tiles_hidden&select=value").then(r => {
      if (r?.[0]?.value) setHiddenTiles(r[0].value.split(",").map(s => s.trim()).filter(Boolean));
    });
    sbFetch("site_config?key=eq.site_section_order&select=value").then(r => {
      if (r?.[0]?.value) setSiteOrder(r[0].value.split(",").map(s => s.trim()).filter(Boolean));
    });
  }, []);
  async function refreshStorageStatus() {
    const t = localStorage.getItem("admin_token");
    if (!t) return;
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: "status" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.data) setStorageStatus(j.data);
    } catch {}
  }
  useEffect(() => { refreshStorageStatus(); }, []);

  async function saveKey(key, overrideVal) {
    const val = overrideVal !== undefined ? overrideVal : vals[key];
    await adminProxy('site_config', 'upsert', { key, value: val });
    reload(); showToast(`✅ Saved: ${key}`);
  }

  async function saveAbout() {
    for (const k of ["about_eyebrow", "about_title", "about_text"]) await adminProxy("site_config", "upsert", { key: k, value: vals[k] || "" });
    reload(); showToast("✅ About section saved.");
  }

  async function saveFlip() {
    for (const k of ["flip_enabled", "flip_eyebrow", "flip_title", "flip_text"]) await adminProxy("site_config", "upsert", { key: k, value: vals[k] || "" });
    reload(); showToast("✅ Flipped section saved.");
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploading(true);
    const url = await uploadFile(logoFile);
    if (!url) { showToast("Upload failed.", "#ef4444"); setUploading(false); return; }
    const existing = await sbFetch("site_config?key=eq.logo_url&select=key");
    if (existing?.length) await adminProxy("site_config", "update", { id: existing[0].id, updates: { value: url } });
    else await adminProxy("site_config", "insert", { key: "logo_url", value: url });
    setLogoUrl(url); setLogoFile(null); setUploading(false); reload(); showToast("✅ Logo updated!");
  }

  async function uploadImgField(key) {
    const file = pendingImgUploads[key];
    if (!file) return;
    setUploadingImg(key);
    const url = await uploadFile(file, 'team-assets');
    if (!url) { showToast("Upload failed.", "#ef4444"); setUploadingImg(null); return; }
    await adminProxy('site_config', 'upsert', { key, value: url });
    setVals(v => ({ ...v, [key]: url }));
    setPendingImgUploads(p => { const n = { ...p }; delete n[key]; return n; });
    setUploadingImg(null);
    showToast(`✅ ${key} updated.`);
  }

  function defaultAdDuration(type) {
    if (type === "video") return 20;
    if (type === "image") return 8;
    if (type === "cad") return 12;
    return 10;
  }

  function updateAdSlide(idx, patch) {
    setAdSlides(arr => arr.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  function moveAdSlide(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= adSlides.length) return;
    const arr = [...adSlides];
    const [item] = arr.splice(idx, 1);
    arr.splice(target, 0, item);
    setAdSlides(arr);
  }

  function deleteAdSlide(idx) {
    setAdSlides(arr => arr.filter((_, i) => i !== idx));
    const n = { ...pendingAdUploads };
    delete n[idx];
    setPendingAdUploads(n);
  }

  function addAdSlide() {
    const slide = { type: "image", title: "", url: "", durationSec: 8, info: [] };
    setAdSlides(arr => [...arr, slide]);
  }

  function updateAdInfo(idx, fi, field, val) {
    setAdSlides(arr => arr.map((s, i) => i === idx ? { ...s, info: (s.info || []).map((f, j) => j === fi ? { ...f, [field]: val } : f) } : s));
  }

  function removeAdInfo(idx, fi) {
    setAdSlides(arr => arr.map((s, i) => i === idx ? { ...s, info: (s.info || []).filter((_, j) => j !== fi) } : s));
  }

  function addAdInfo(idx) {
    setAdSlides(arr => arr.map((s, i) => i === idx ? { ...s, info: [...(s.info || []), { label: "", value: "" }] } : s));
  }

  async function uploadAdMedia(idx) {
    const file = pendingAdUploads[idx];
    if (!file) return;
    setUploadingAd(idx);
    const url = await uploadFile(file, 'team-assets');
    if (!url) { showToast("Upload failed.", "#ef4444"); setUploadingAd(null); return; }
    setAdSlides(arr => arr.map((s, i) => i === idx ? { ...s, url } : s));
    setPendingAdUploads(p => { const n = { ...p }; delete n[idx]; return n; });
    setUploadingAd(null);
    showToast("✅ Media uploaded.");
  }

  async function saveAdSlides() {
    try {
      await adminProxy('site_config', 'upsert', { key: 'ad_slides', value: JSON.stringify(adSlides) });
      reload(); showToast("✅ Advert slides saved.");
    } catch (e) {
      showToast("Save failed: " + (e.message || e), "#ef4444");
    }
  }

  async function saveQrConfig() {
    try {
      await adminProxy('site_config', 'upsert', { key: 'qr_config', value: JSON.stringify(qrConfig) });
      reload(); showToast("✅ QR URL saved.");
    } catch (e) {
      showToast("Save failed: " + (e.message || e), "#ef4444");
    }
  }

  async function runStorageCleanup() {
    const adminToken = localStorage.getItem("admin_token");
    if (!adminToken) { showToast("Admin login required.", "#ef4444"); return; }
    setStorageBusy(true);
    setStorageMsg("Checking media storage...");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ action: "cleanup" }),
      });
      const j = await res.json().catch(() => ({}));
      setStorageMsg("");
      if (!res.ok) { showToast(j.error || "Cleanup failed.", "#ef4444"); return; }
      const d = j.data || {};
      const migrated = (d.migrated || []).length;
      const remaining = d.remaining || 0;
      const deleted = (d.deleted || []).length;
      const kept = d.kept || 0;
      const noToken = (d.failed || []).some(f => /not configured/i.test(f.error || ""));
      const failed = (d.failed || []).filter(f => !/not configured/i.test(f.error || "")).length;
      if (noToken) { showToast("GitHub storage isn't set up yet — add GITHUB_TOKEN in Vercel env first.", "#f59e0b"); return; }
      refreshStorageStatus();
      if (d.discovered === 0 && migrated === 0 && deleted === 0) { showToast("All media & docs are on GitHub. 🎉", "#22c55e"); return; }
      let msg = `✅ ${migrated} media/doc${migrated === 1 ? "" : "s"} on GitHub`;
      if (deleted) msg += `, removed ${deleted} orphan${deleted === 1 ? "" : "s"}`;
      showToast(msg + ".", "#22c55e");
      if (kept) showToast(`ℹ ${kept} non-media image${kept === 1 ? "" : "s"} stay in GitHub.`, "#94a3b8");
      if (failed) showToast(`⚠ ${failed} file${failed === 1 ? "" : "s"} couldn't migrate.`, "#f59e0b");
      if (remaining) showToast(`⏳ ${remaining} left — run again to continue.`, "#f59e0b");
      reload();
    } catch (e) {
      setStorageMsg("");
      showToast("Cleanup failed: " + (e.message || e), "#ef4444");
    }
    setStorageBusy(false);
  }

  const fields = [
    { key: "site_title", label: "Site Title" }, { key: "team_email", label: "Team Email" },
    { key: "instagram", label: "Instagram URL" }, { key: "youtube", label: "YouTube URL" },
    { key: "tba_api_key", label: "TBA API Key" },
    { key: "donate_url", label: "Donate URL" }, { key: "season_year", label: "Season Year" },
  ];

  const effOrder = siteOrder.length ? siteOrder : SITE_SECTIONS.map(s => s.id);

  return (
    <div>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Site Configuration</h1>
      <div style={S.card}>
        <div style={S.cardTitle}>Team Logo</div>
        <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'center' : 'center', gap: isMobile ? 12 : 20, textAlign: isMobile ? 'center' : undefined }}>
          <img src={logoUrl} alt="logo" style={{ width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(239,68,68,0.4)" }} />
          <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
            <button onClick={() => fileRef.current?.click()} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined }}>{logoFile ? `📸 ${logoFile.name}` : "Choose Image"}</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => setLogoFile(e.target.files[0])} />
            {logoFile && <button onClick={uploadLogo} disabled={uploading} style={{ ...S.btnPrimary, width: isMobile ? '100%' : undefined }}>{uploading ? "Uploading..." : "Upload"}</button>}
          </div>
        </div>
      </div>
      <BannerManager vals={vals} setVals={setVals} saveKey={saveKey} showToast={showToast} isMobile={isMobile} />
      <div style={S.card}>
        <div style={S.cardTitle}>Site Section Order</div>
        <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 8, marginBottom: 14 }}>
          <button onClick={async () => {
            const order = effOrder.join(",");
            const existing = (await sbFetch("site_config?key=eq.site_section_order&select=key")) || [];
            if (existing?.length) await adminProxy("site_config", "update", { id: existing[0].id, updates: { value: order } });
            else await adminProxy("site_config", "insert", { key: "site_section_order", value: order });
            reload(); showToast("✅ Site order saved.");
          }} style={S.btnPrimary}>Save Order</button>
          <button onClick={() => setSiteOrder([])} style={S.btnGhost}>Reset to Default</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {effOrder.map((id, i) => {
            const sec = SITE_SECTIONS.find(s => s.id === id);
            if (!sec) return null;
            return (
              <div key={sec.id} draggable
                onDragStart={() => setSiteDragId(sec.id)}
                onDragOver={e => { e.preventDefault(); setSiteDragOverId(sec.id); }}
                onDrop={e => {
                  e.preventDefault();
                  if (!siteDragId || siteDragId === sec.id) return;
                  const list = [...effOrder];
                  const from = list.indexOf(siteDragId);
                  const to = list.indexOf(sec.id);
                  if (from < 0 || to < 0) return;
                  list.splice(from, 1);
                  list.splice(to, 0, siteDragId);
                  setSiteOrder(list); setSiteDragId(null); setSiteDragOverId(null);
                }}
                onDragEnd={() => { setSiteDragId(null); setSiteDragOverId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: siteDragOverId === sec.id && siteDragId !== sec.id ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)", border: siteDragOverId === sec.id && siteDragId !== sec.id ? "1px dashed rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, cursor: "grab", opacity: siteDragId === sec.id ? 0.4 : 1 }}>
                  <span style={{ color: "#475569", fontSize: 16, cursor: "grab" }}>⠿</span>
                  <span style={{ fontSize: 18 }}>{sec.icon}</span>
                  <span style={{ fontSize: 13, color: "#f1f5f9", flex: 1 }}>{sec.label}</span>
                  <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>#{i + 1}</span>
                </div>
              );
          })}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Hub Tiles — Reorder & Toggle Visibility</div>
        <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 8, marginBottom: 14 }}>
          <button onClick={async () => {
            setTileSaving(true);
            const order = tileOrder.length ? tileOrder : HUB_TILES.map(t => t.id);
            const existing = (await sbFetch("site_config?key=eq.hub_tile_order&select=key")) || [];
            if (existing?.length) await adminProxy("site_config", "update", { id: existing[0].id, updates: { value: order.join(",") } });
            else await adminProxy("site_config", "insert", { key: "hub_tile_order", value: order.join(",") });
            setTileSaving(false); reload(); showToast("✅ Tile order saved.");
          }} disabled={tileSaving} style={{ ...S.btnPrimary, opacity: tileSaving ? 0.6 : 1 }}>{tileSaving ? "Saving..." : "Save Order"}</button>
          <button onClick={async () => {
            setHiddenSaving(true);
            const val = hiddenTiles.join(",");
            const existing = (await sbFetch("site_config?key=eq.hub_tiles_hidden&select=key")) || [];
            if (existing?.length) await adminProxy("site_config", "update", { id: existing[0].id, updates: { value: val } });
            else await adminProxy("site_config", "insert", { key: "hub_tiles_hidden", value: val });
            setHiddenSaving(false); reload(); showToast("✅ Tile visibility saved.");
          }} disabled={hiddenSaving} style={{ ...S.btnPrimary, opacity: hiddenSaving ? 0.6 : 1 }}>{hiddenSaving ? "Saving..." : "Save Visibility"}</button>
          <button onClick={() => {
            setTileOrder(HUB_TILES.map(t => t.id));
            setHiddenTiles([]);
          }} style={S.btnGhost}>Reset to Default</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(tileOrder.length ? tileOrder : HUB_TILES.map(t => t.id)).map((id, i) => {
            const tile = HUB_TILES.find(t => t.id === id);
            if (!tile) return null;
            const isHidden = hiddenTiles.includes(tile.id);
            return (
              <div key={tile.id} draggable
                onDragStart={() => setDragId(tile.id)}
                onDragOver={e => { e.preventDefault(); setDragOverId(tile.id); }}
                onDrop={e => {
                  e.preventDefault();
                  if (!dragId || dragId === tile.id) return;
                  const list = tileOrder.length ? [...tileOrder] : HUB_TILES.map(t => t.id);
                  const from = list.indexOf(dragId);
                  const to = list.indexOf(tile.id);
                  if (from < 0 || to < 0) return;
                  list.splice(from, 1);
                  list.splice(to, 0, dragId);
                  setTileOrder(list); setDragId(null); setDragOverId(null);
                }}
                onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: dragOverId === tile.id && dragId !== tile.id ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)", border: dragOverId === tile.id && dragId !== tile.id ? "1px dashed rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, cursor: "grab", opacity: dragId === tile.id ? 0.4 : 1 }}>
                <span style={{ color: "#475569", fontSize: 16, cursor: "grab" }}>⠿</span>
                <span style={{ fontSize: 18 }}>{tile.icon}</span>
                <span style={{ fontSize: 13, color: isHidden ? "#64748b" : "#f1f5f9", flex: 1, textDecoration: isHidden ? "line-through" : "none" }}>{tile.label}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: isHidden ? "#ef4444" : "#22c55e", fontFamily: "monospace", userSelect: "none" }}
                  onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={!isHidden}
                    onChange={() => setHiddenTiles(prev => isHidden ? prev.filter(x => x !== tile.id) : [...prev, tile.id])}
                    style={{ accentColor: isHidden ? "#ef4444" : "#22c55e" }} />
                  {isHidden ? "Hidden" : "Visible"}
                </label>
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>#{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>About Section</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Eyebrow (// text)</label>
            <input value={vals.about_eyebrow || ""} onChange={e => setVals({ ...vals, about_eyebrow: e.target.value })} style={{ ...S.input, width: "100%" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Title</label>
            <input value={vals.about_title || ""} onChange={e => setVals({ ...vals, about_title: e.target.value })} style={{ ...S.input, width: "100%" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Paragraph (typewriter)</label>
            <textarea rows={6} value={vals.about_text || ""} onChange={e => setVals({ ...vals, about_text: e.target.value })} style={{ ...S.input, width: "100%", resize: "vertical", fontSize: 12, lineHeight: 1.6 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>About metrics</label>
            {aboutMetrics.map((m, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", width: 18, flexShrink: 0 }}>#{idx + 1}</span>
                <input value={m.num || ""} onChange={e => setAboutMetrics(arr => arr.map((x, i) => i === idx ? { ...x, num: e.target.value } : x))} placeholder="Num" style={{ ...S.input, maxWidth: 90, marginBottom: 0 }} />
                <input value={m.label || ""} onChange={e => setAboutMetrics(arr => arr.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} placeholder="Label" style={{ ...S.input, flex: 1, marginBottom: 0, minWidth: 0 }} />
              </div>
            ))}
            <button onClick={async () => { await adminProxy("site_config", "upsert", { key: "about_metrics", value: JSON.stringify(aboutMetrics) }); reload(); showToast("✅ Metrics saved."); }} style={{ ...S.btnGhost, alignSelf: 'flex-start' }}>Save Metrics</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Landing image</label>
            <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center', flexWrap: "wrap" }}>
              {vals["landing_img_1"] && <img src={vals["landing_img_1"]} alt="" style={{ width: 80, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />}
              <button onClick={() => imgFileRefs.current["landing_img_1"]?.click()} style={{ ...S.btnGhost, flexShrink: 0 }}>{pendingImgUploads["landing_img_1"] ? pendingImgUploads["landing_img_1"].name : "Choose Image"}</button>
              {pendingImgUploads["landing_img_1"] && <button onClick={() => uploadImgField("landing_img_1")} disabled={uploadingImg === "landing_img_1"} style={{ ...S.btnPrimary, flexShrink: 0 }}>{uploadingImg === "landing_img_1" ? "Uploading..." : "Upload"}</button>}
              <input ref={el => imgFileRefs.current["landing_img_1"] = el} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file) setPendingImgUploads(p => ({ ...p, "landing_img_1": file })); }} />
            </div>
          </div>
          <div>
            <button onClick={saveAbout} style={S.btnPrimary}>Save</button>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Flipped Section (Our Story)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#e2e8f0" }}>
            <input type="checkbox" checked={vals.flip_enabled !== "false"} onChange={e => setVals({ ...vals, flip_enabled: e.target.checked ? "true" : "false" })} style={{ width: 16, height: 16, cursor: "pointer" }} />
            Show on homepage
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Eyebrow (// text)</label>
            <input value={vals.flip_eyebrow || ""} onChange={e => setVals({ ...vals, flip_eyebrow: e.target.value })} style={{ ...S.input, width: "100%" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Title</label>
            <input value={vals.flip_title || ""} onChange={e => setVals({ ...vals, flip_title: e.target.value })} style={{ ...S.input, width: "100%" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Paragraph</label>
            <textarea rows={6} value={vals.flip_text || ""} onChange={e => setVals({ ...vals, flip_text: e.target.value })} style={{ ...S.input, width: "100%", resize: "vertical", fontSize: 12, lineHeight: 1.6 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Landing image</label>
            <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center', flexWrap: "wrap" }}>
              {vals["landing_img_2"] && <img src={vals["landing_img_2"]} alt="" style={{ width: 80, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />}
              <button onClick={() => imgFileRefs.current["landing_img_2"]?.click()} style={{ ...S.btnGhost, flexShrink: 0 }}>{pendingImgUploads["landing_img_2"] ? pendingImgUploads["landing_img_2"].name : "Choose Image"}</button>
              {pendingImgUploads["landing_img_2"] && <button onClick={() => uploadImgField("landing_img_2")} disabled={uploadingImg === "landing_img_2"} style={{ ...S.btnPrimary, flexShrink: 0 }}>{uploadingImg === "landing_img_2" ? "Uploading..." : "Upload"}</button>}
              <input ref={el => imgFileRefs.current["landing_img_2"] = el} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file) setPendingImgUploads(p => ({ ...p, "landing_img_2": file })); }} />
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>Image displays with text on the LEFT, text on the RIGHT — reversed vs the About card.</div>
          </div>
          <div>
            <button onClick={saveFlip} style={S.btnPrimary}>Save</button>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Site Details</div>
        {fields.map(f => (
          <div key={f.key} style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 10, marginBottom: 12, alignItems: isMobile ? 'stretch' : 'flex-start' }}>
            <label style={{ color: "#94a3b8", fontSize: 12, minWidth: isMobile ? 0 : 120, fontFamily: "monospace", paddingTop: (f.long || f.upload) ? 8 : 0 }}>{f.label}</label>
            {f.upload ? (
              <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center', flexWrap: "wrap" }}>
                {vals[f.key] && <img src={vals[f.key]} alt="" style={{ width: 80, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)" }} />}
                <button onClick={() => imgFileRefs.current[f.key]?.click()} style={{ ...S.btnGhost, flexShrink: 0 }}>{pendingImgUploads[f.key] ? pendingImgUploads[f.key].name : "Choose Image"}</button>
                {pendingImgUploads[f.key] && <button onClick={() => uploadImgField(f.key)} disabled={uploadingImg === f.key} style={{ ...S.btnPrimary, flexShrink: 0 }}>{uploadingImg === f.key ? "Uploading..." : "Upload"}</button>}
                <input ref={el => imgFileRefs.current[f.key] = el} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file) setPendingImgUploads(p => ({ ...p, [f.key]: file })); }} />
              </div>
            ) : f.long ? (
              <textarea value={vals[f.key] || ""} onChange={e => setVals({ ...vals, [f.key]: e.target.value })}
                rows={12} style={{ ...S.input, flex: 1, marginBottom: 0, resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, minHeight: 140 }}
              />
            ) : (
              <input value={vals[f.key] || ""} onChange={e => setVals({ ...vals, [f.key]: e.target.value })} style={{ ...S.input, flex: 1, marginBottom: 0 }} />
            )}
            {!f.upload && <button onClick={() => saveKey(f.key)} style={{ ...S.btnGhost, width: isMobile ? '100%' : undefined, flexShrink: 0 }}>Save</button>}
          </div>
        ))}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, marginTop: 4 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace", marginBottom: 10 }}>Legal Documents</div>
          {["privacy_policy", "terms_conditions"].map(k => {
            const isPriv = k === "privacy_policy";
            const label = isPriv ? "Privacy Policy" : "Terms & Conditions";
            const expanded = openLegal[k];
            const raw = vals[k] || "";
            const stripped = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
            const preview = stripped.slice(0, 90) + (stripped.length > 90 ? "…" : "");
            return (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setOpenLegal(o => ({ ...o, [k]: !o[k] }))} style={{ ...S.btnGhost, flexShrink: 0, fontSize: 12, padding: "6px 10px" }}>{expanded ? "▾" : "▸"} {label}</button>
                  <span style={{ color: "#64748b", fontSize: 11, fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripped ? preview : "(empty — click to edit)"}</span>
                </div>
                {expanded && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={raw} onChange={e => setVals({ ...vals, [k]: e.target.value })} rows={12} style={{ ...S.input, width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, minHeight: 140 }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <button onClick={() => saveKey(k)} style={S.btnPrimary}>Save</button>
                      <button onClick={() => setVals(v => ({ ...v, [k]: isPriv ? PRIVACY_FALLBACK : TERMS_FALLBACK }))} style={S.btnGhost}>Load default</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <SponsorRibbonManager vals={vals} setVals={setVals} saveKey={saveKey} showToast={showToast} isMobile={isMobile} />
      <div style={S.card}>
        <div style={S.cardTitle}>📢 Advertisement / Slides</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Website URL (used by QR screen)</label>
            <input value={qrConfig.url || ""} onChange={e => setQrConfig(c => ({ ...c, url: e.target.value }))} placeholder="https://frc4550.org" style={{ ...S.input, width: "100%" }} />
          </div>
          {adSlides.map((slide, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select value={slide.type || "image"} onChange={e => updateAdSlide(idx, { type: e.target.value })} style={{ ...S.select, flex: 1, minWidth: 0, marginBottom: 0 }}>
                  {["video", "image", "cad", "info"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
                <button onClick={() => moveAdSlide(idx, -1)} disabled={idx === 0} style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 12 }}>▲</button>
                <button onClick={() => moveAdSlide(idx, 1)} disabled={idx === adSlides.length - 1} style={{ ...S.btnGhost, padding: "5px 10px", fontSize: 12 }}>▼</button>
                <button onClick={() => deleteAdSlide(idx)} style={{ ...S.btnDanger, padding: "5px 10px", fontSize: 12 }}>✕</button>
              </div>
              <input value={slide.title || ""} onChange={e => updateAdSlide(idx, { title: e.target.value })} placeholder="Slide title" style={{ ...S.input, width: "100%", marginBottom: 0 }} />
              {slide.type !== "info" && (
                <div style={{ display: "flex", flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center' }}>
                  <input value={slide.url || ""} onChange={e => updateAdSlide(idx, { url: e.target.value })} placeholder="Media URL (or upload below)" style={{ ...S.input, flex: 1, marginBottom: 0, minWidth: 0 }} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => { adFileRefs.current[idx]?.click(); }} style={{ ...S.btnGhost, flexShrink: 0, padding: "6px 10px", fontSize: 12 }}>
                      {pendingAdUploads[idx] ? `📤 ${pendingAdUploads[idx].name}` : "Upload"}
                    </button>
                    {pendingAdUploads[idx] && <button onClick={() => uploadAdMedia(idx)} disabled={uploadingAd === idx} style={{ ...S.btnPrimary, flexShrink: 0, padding: "6px 10px", fontSize: 12 }}>{uploadingAd === idx ? "Uploading..." : "Go"}</button>}
                    <input ref={el => adFileRefs.current[idx] = el} type="file" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (file) setPendingAdUploads(p => ({ ...p, [idx]: file })); }} />
                  </div>
                </div>
              )}
              {slide.type === "info" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <textarea value={slide.caption || ""} onChange={e => updateAdSlide(idx, { caption: e.target.value })} placeholder="Caption" rows={2} style={{ ...S.input, width: "100%", resize: "vertical", marginBottom: 0 }} />
                  <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Robot info fields</div>
                  {(slide.info || []).map((f, fi) => (
                    <div key={fi} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input value={f.label || ""} onChange={e => updateAdInfo(idx, fi, "label", e.target.value)} placeholder="Label" style={{ ...S.input, flex: 1, marginBottom: 0, minWidth: 0 }} />
                      <input value={f.value || ""} onChange={e => updateAdInfo(idx, fi, "value", e.target.value)} placeholder="Value" style={{ ...S.input, flex: 1, marginBottom: 0, minWidth: 0 }} />
                      <button onClick={() => removeAdInfo(idx, fi)} style={{ ...S.btnDanger, padding: "5px 10px", fontSize: 12 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addAdInfo(idx)} style={{ ...S.btnGhost, alignSelf: 'flex-start', padding: "6px 10px", fontSize: 12 }}>+ Add field</button>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Duration (sec)</label>
                <input type="number" min={1} value={slide.durationSec ?? defaultAdDuration(slide.type)} onChange={e => updateAdSlide(idx, { durationSec: Number(e.target.value) || 0 })} style={{ ...S.input, maxWidth: 90, marginBottom: 0 }} />
              </div>
            </div>
          ))}
          <button onClick={addAdSlide} style={{ ...S.btnGhost, alignSelf: 'flex-start' }}>+ Add Slide</button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveAdSlides} style={S.btnPrimary}>Save Advert Slides</button>
            <button onClick={saveQrConfig} style={S.btnPrimary}>Save QR URL</button>
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Media Storage</div>
        {storageStatus && (
          <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 10, lineHeight: 1.6 }}>
            {storageStatus.remaining > 0
              ? <span style={{ color: "#f59e0b" }}>🗂 {storageStatus.remaining} media/doc{storageStatus.remaining === 1 ? "" : "s"} still to migrate.</span>
              : <span style={{ color: "#22c55e" }}>✓ All media & docs are on GitHub.</span>}
            {storageStatus.bucketObjects && ` — ${Object.values(storageStatus.bucketObjects).reduce((a, b) => a + b, 0)} objects in storage buckets.`}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace", marginBottom: 12, lineHeight: 1.6 }}>
          <span>Media Gallery 🖼️ and Resources 📁 (images, PDFs, CAD, videos) upload to GitHub</span> — stored in this repo under <span style={{ color: "#a78bfa" }}>public/uploads/</span>. All other images — logo, banners, sponsor/captain photos, landing, inventory — also upload to GitHub. Data lives in <span style={{ color: "#a78bfa" }}>Cloudflare D1</span>.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={runStorageCleanup} disabled={storageBusy} style={{ ...S.btnPrimary, opacity: storageBusy ? 0.6 : 1 }}>{storageBusy ? "Working..." : "🚀 Move Media & Docs to GitHub"}</button>
          {storageMsg && <span style={{ fontSize: 12, color: "#a78bfa", fontFamily: "monospace" }}>{storageMsg}</span>}
        </div>
        <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", marginTop: 10 }}>
          Media (images, PDFs, CAD, videos) uploads to the GitHub repo via GITHUB_TOKEN in Vercel env. Data lives in Cloudflare D1.
        </div>
      </div>
    </div>
  );

  }

const S = {
  layout: { display: "flex", minHeight: "100vh", background: "#080a0f", color: "#f1f5f9", fontFamily: "'Exo 2', sans-serif" },
  sidebar: { width: 224, background: "#0a0e18", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", flexShrink: 0, position: "fixed", top: "env(safe-area-inset-top,0px)", left: 0, height: "100vh", overflowY: "auto", zIndex: 50 },
  sidebarBrand: { display: "flex", alignItems: "center", gap: 10, padding: "18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  sidebarLogo: { width: 34, height: 34, borderRadius: "50%", objectFit: "cover" },
  sidebarTitle: { fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#ef4444", letterSpacing: 2 },
  sidebarSub: { fontSize: 10, color: "#64748b", fontFamily: "monospace" },
  sidebarNav: { flex: 1, padding: "10px 0" },
  navItem: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "11px 16px", border: "none", cursor: "pointer", fontFamily: "'Exo 2', sans-serif", fontSize: 13, textAlign: "left", transition: "all 0.15s" },
  badge: { background: "#ef4444", color: "#fff", borderRadius: 12, padding: "1px 7px", fontSize: 11, fontWeight: 700 },
  logoutBtn: { margin: "12px 16px", background: "transparent", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: 8, borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "monospace" },
  main: { flex: 1, padding: "32px 36px", overflowY: "auto", marginLeft: 224 },
  pageTitle: { fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 20, color: "#f1f5f9", marginBottom: 24 },
  card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "22px", marginBottom: 18 },
  cardTitle: { fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, marginBottom: 16 },
  statRow: { display: "flex", gap: 14, flexWrap: "wrap" },
  statCard: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "20px", minWidth: 140, textAlign: "center" },
  statNum: { fontFamily: "'Orbitron', sans-serif", fontSize: 24, fontWeight: 700 },
  statLabel: { fontSize: 11, color: "#64748b", fontFamily: "monospace", marginTop: 4 },
  alertBanner: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", borderRadius: 10, padding: "10px 16px", marginTop: 14, fontSize: 13 },
  quickLinks: { display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" },
  quickBtn: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", padding: "10px 18px", borderRadius: 12, textDecoration: "none", fontSize: 13 },
  formRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  formCol: { display: "flex", flexDirection: "column", gap: 10 },
  input: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "monospace", outline: "none", flex: 1, minWidth: 120 },
  select: { background: "#0a0e18", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, fontFamily: "monospace", cursor: "pointer", flex: 1, minWidth: 120 },
  btnPrimary: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "9px 14px", color: "#ef4444", cursor: "pointer", fontSize: 13, fontFamily: "monospace", whiteSpace: "nowrap" },
  btnGhost: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "9px 14px", color: "#ef4444", cursor: "pointer", fontSize: 13, fontFamily: "monospace", whiteSpace: "nowrap" },
  btnDanger: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "9px 14px", color: "#ef4444", cursor: "pointer", fontSize: 13, fontFamily: "monospace", whiteSpace: "nowrap" },
  memberRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", minHeight: 64, gap: 10 },
  memberInfo: { display: "flex", alignItems: "center", gap: 10 },
  memberName: { color: "#f1f5f9", fontWeight: 600, fontSize: 14 },
  memberUser: { color: "#64748b", fontSize: 12, fontFamily: "monospace" },
  memberActions: { display: "flex", gap: 8, flexShrink: 0 },
  roleBadge: { borderRadius: 12, padding: "2px 10px", fontSize: 11, fontFamily: "monospace", flexShrink: 0 },
  taskColumns: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 },
  taskCol: { background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 14 },
  taskColHeader: { fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 },
  taskCount: { background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "1px 8px", fontSize: 11 },
  taskCard: { borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid rgba(255,255,255,0.06)" },
  taskTitle: { color: "#f1f5f9", fontSize: 13, fontWeight: 600, marginBottom: 4 },
  taskDesc: { color: "#64748b", fontSize: 11, marginBottom: 6 },
  taskMeta: { display: "flex", gap: 10, fontSize: 11, color: "#64748b", fontFamily: "monospace", marginBottom: 6, flexWrap: "wrap" },
  taskActions: { display: "flex", gap: 6 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "#64748b", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  td: { padding: "8px 12px", fontSize: 13, color: "#f1f5f9" },
  loginBg: { minHeight: "100vh", background: "#080a0f", display: "flex", alignItems: "center", justifyContent: "center" },
  loginCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "48px 40px", textAlign: "center", width: "100%", maxWidth: 360 },
  loginTitle: { fontFamily: "'Orbitron', sans-serif", fontSize: 20, fontWeight: 700, color: "#ef4444", letterSpacing: 4, marginBottom: 6 },
  loginSub: { fontSize: 12, color: "#64748b", fontFamily: "monospace", marginBottom: 28 },
  loginForm: { display: "flex", flexDirection: "column", gap: 12 },
  loginInput: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "12px 16px", color: "#fff", fontSize: 14, fontFamily: "monospace", outline: "none", textAlign: "center" },
  loginErr: { color: "#ef4444", fontSize: 12, fontFamily: "monospace" },
  loginBtn: { background: "#ef4444", border: "none", borderRadius: 10, padding: 12, color: "#fff", fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, cursor: "pointer" },
  loginBack: { display: "block", marginTop: 24, color: "#64748b", fontSize: 12, fontFamily: "monospace", textDecoration: "none" },
};

// ── QR GENERATOR ──────────────────────────────────────────
function QRGenerator({ reload, showToast, vals, isMobile }) {
  const [text, setText] = useState(() => {
    try {
      const j = JSON.parse(vals?.qr_config || "{}");
      return j.url || "https://frc4550.org";
    } catch {
      return "https://frc4550.org";
    }
  });
  const [size, setSize] = useState(600);
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState("M");
  const [dark, setDark] = useState("#ef4444");
  const [light, setLight] = useState("#ffffff");
  const [margin, setMargin] = useState(2);
  const [logo, setLogo] = useState(null);
  const [logoSize, setLogoSize] = useState(22);
  const [caption, setCaption] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  const logoInputRef = useRef(null);

  async function render(canvas, t = text, logoOverride = logo) {
    if (!canvas || !t.trim()) return;
    const tmp = document.createElement("canvas");
    tmp.width = size;
    tmp.height = size;
    await QRCode.toCanvas(tmp, t, opts).catch(() => {});
    if (logoOverride) {
      try {
        const img = await new Promise((res, rej) => { const im = new Image(); im.src = logoOverride; im.onload = () => res(im); im.onerror = rej; });
        const ctx = tmp.getContext("2d");
        const box = size * (logoSize / 100);
        const pad = box * 0.18;
        const bx = (size - box) / 2;
        const by = (size - box) / 2;
        ctx.fillStyle = light || "#ffffff";
        ctx.fillRect(bx - pad, by - pad, box + pad * 2, box + pad * 2);
        ctx.drawImage(img, bx, by, box, box);
      } catch {}
    }
    const hasCaption = caption && caption.trim();
    const capH = hasCaption ? 48 : 0;
    canvas.width = size;
    canvas.height = size + capH;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = light || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    if (hasCaption) {
      ctx.fillStyle = light || "#ffffff";
      ctx.fillRect(0, size, canvas.width, capH);
      ctx.fillStyle = dark || "#000000";
      ctx.font = `${Math.max(20, Math.floor(size / 22))}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(caption, canvas.width / 2, size + capH / 2);
    }
  }

  useEffect(() => {
    try {
      const j = JSON.parse(vals?.qr_config || "{}");
      if (j && j.url) setText(j.url);
      if (j && j.width) setSize(j.width);
      if (j && j.errorCorrectionLevel) setErrorCorrectionLevel(j.errorCorrectionLevel);
      if (j && j.dark) setDark(j.dark);
      if (j && j.light) setLight(j.light);
      if (j && typeof j.margin === "number") setMargin(j.margin);
      if (j && typeof j.logoSize === "number") setLogoSize(j.logoSize);
      if (j && j.caption) setCaption(j.caption);
      if (j && j.logo) setLogo(j.logo);
    } catch {}
  }, [vals?.qr_config]);

  const opts = {
    width: size,
    margin,
    errorCorrectionLevel,
    color: { dark, light },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text.trim()) return;
    render(canvas);
  }, [text, size, errorCorrectionLevel, dark, light, margin, logo, logoSize, caption]);

  async function download() {
    if (!text.trim()) { showToast("Enter content to encode.", "#ef4444"); return; }
    setDownloading(true);
    try {
      const off = document.createElement("canvas");
      await render(off, text, logo);
      const dataUrl = off.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "qrcode.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      showToast("Download failed: " + (e.message || e), "#ef4444");
    }
    setDownloading(false);
  }

  async function save() {
    if (!text.trim()) { showToast("Enter content to encode.", "#ef4444"); return; }
    setSaving(true);
    try {
      const cfg = { url: text, width: size, errorCorrectionLevel, dark, light, margin, logoSize, caption, logo };
      await adminProxy('site_config', 'upsert', { key: 'qr_config', value: JSON.stringify(cfg) });
      reload(); showToast("✅ QR config saved.");
    } catch (e) {
      showToast("Save failed: " + (e.message || e), "#ef4444");
    }
    setSaving(false);
  }

  function onLogoPicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast("Please choose an image file.", "#ef4444"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ maxWidth: 860, padding: "0 4px" }}>
      <h1 style={{ ...S.pageTitle, fontSize: isMobile ? 16 : 20 }}>Other Tools · QR Generator</h1>
      <div style={S.card}>
        <div style={S.cardTitle}>Content</div>
        <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Text / URL (required)</label>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="https://frc4550.org" style={{ ...S.input, width: "100%", marginTop: 6 }} />
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Options</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Size (px)</label>
            <input type="number" min={80} value={size} onChange={e => setSize(Number(e.target.value) || 0)} style={{ ...S.input, marginBottom: 0 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Error correction</label>
            <select value={errorCorrectionLevel} onChange={e => setErrorCorrectionLevel(e.target.value)} style={{ ...S.select, marginBottom: 0 }}>
              {["L", "M", "Q", "H"].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Dark (foreground)</label>
            <input type="color" value={dark} onChange={e => setDark(e.target.value)} style={{ width: "100%", marginBottom: 0, height: 40, background: "#0a0e18", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Light (background)</label>
            <input type="color" value={light} onChange={e => setLight(e.target.value)} style={{ width: "100%", marginBottom: 0, height: 40, background: "#0a0e18", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Margin</label>
            <input type="number" min={0} value={margin} onChange={e => setMargin(Number(e.target.value) || 0)} style={{ ...S.input, marginBottom: 0 }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={download} disabled={downloading} style={{ ...S.btnPrimary, opacity: downloading ? 0.6 : 1 }}>{downloading ? "Generating..." : "⬇ Download PNG"}</button>
          <button onClick={save} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "💾 Save to QR Config"}</button>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Logo &amp; Label</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Logo / image overlay (optional, drawn over center of the QR)</label>
            <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoPicked} style={{ display: "none" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => logoInputRef.current?.click()} style={{ ...S.btnGhost, padding: "8px 14px" }}>{logo ? "🖼 Replace Logo" : "🖼 Upload Logo"}</button>
              {logo && <button onClick={() => setLogo(null)} style={{ ...S.btnDanger, padding: "8px 14px" }}>Remove</button>}
              {logo && <img src={logo} alt="logo" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)", background: "#fff" }} />}
            </div>
          </div>
          {logo && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Logo size ({logoSize}% of QR)</label>
              <input type="range" min={10} max={40} value={logoSize} onChange={e => setLogoSize(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>Label below QR (optional)</label>
            <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="e.g. Vote for Team 4550!" style={{ ...S.input, width: "100%", marginBottom: 0 }} />
          </div>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Live Preview</div>
        <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
          <canvas ref={canvasRef} style={{ width: Math.min(size, 500), height: Math.min(size + (caption && caption.trim() ? 48 : 0), 545), background: light, borderRadius: 8, maxWidth: "100%", imageRendering: "pixelated", border: "1px solid rgba(255,255,255,0.1)" }} />
        </div>
      </div>
    </div>
  );
}
