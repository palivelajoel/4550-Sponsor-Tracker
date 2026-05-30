import { useState, useEffect, useRef } from "react";
import { FONTS, C, sbFetch } from "./hubUtils.jsx";

const SLIDE_DURATION = 12000; // ms per slide

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const typeColor = { event: "#3b82f6", deadline: "#ef4444", meeting: "#22c55e", competition: "#f59e0b", other: "#a855f7" };
const priorityColor = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444", Critical: "#a855f7" };
const statusColor = { Backlog: "#475569", "To Do": "#64748b", "In Progress": "#3b82f6", Review: "#f59e0b", Done: "#22c55e" };

export default function HubProjector() {
  const [slide, setSlide] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [data, setData] = useState({ events: [], tasks: [], announcements: [] });
  const [logoUrl, setLogoUrl] = useState("/logo.jpg");
  const [now, setNow] = useState(new Date());
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoFull, setAutoFull] = useState(false);
  const containerRef = useRef(null);
  const timerRef = useRef(null);

  const SLIDES = [
    { id: "calendar", label: "📅 Upcoming Events" },
    { id: "tasks", label: "✅ Open Tasks" },
    { id: "announcements", label: "📣 Announcements" },
  ];

  useEffect(() => {
    document.title = "Meeting Projector · Team 4550";
    load();
    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    if (paused) { clearTimeout(timerRef.current); return; }
    timerRef.current = setTimeout(() => advance(), SLIDE_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [slide, paused]);

  async function load() {
    const [ev, tk, an, cfg] = await Promise.all([
      sbFetch("hub_calendar?select=*&order=date.asc"),
      sbFetch("hub_tasks?status=neq.Done&select=*&order=priority.desc,due_date.asc"),
      sbFetch("hub_announcements?select=*&order=pinned.desc,created_at.desc&limit=6"),
      sbFetch("site_config?key=eq.logo_url&select=value"),
    ]);
    const todayStr = new Date().toISOString().split("T")[0];
    setData({
      events: ev ? ev.filter(e => e.date >= todayStr).slice(0, 12) : [],
      tasks: tk ? tk.slice(0, 20) : [],
      announcements: an || [],
    });
    if (cfg?.[0]) setLogoUrl(cfg[0].value);
  }

  function advance() {
    setTransitioning(true);
    setTimeout(() => {
      setSlide(s => (s + 1) % SLIDES.length);
      setTransitioning(false);
    }, 350);
  }

  function goTo(i) {
    setTransitioning(true);
    setTimeout(() => { setSlide(i); setTransitioning(false); }, 350);
    clearTimeout(timerRef.current);
    if (!paused) timerRef.current = setTimeout(() => advance(), SLIDE_DURATION);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  }

  useEffect(() => {
    const fn = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  const progress = !paused ? ((Date.now() % SLIDE_DURATION) / SLIDE_DURATION) * 100 : 0;

  return (
    <div ref={containerRef} style={{ minHeight: "100vh", background: "#050709", color: C.text, fontFamily: "'Exo 2', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{FONTS + `
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
        .projector-slide { animation: slideIn 0.35s ease both; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={logoUrl} alt="logo" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
          <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: C.red, letterSpacing: 2 }}>SOMETHING'S BRUIN · FRC 4550</span>
        </div>

        {/* Slide nav dots */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {SLIDES.map((s, i) => (
            <button key={s.id} onClick={() => goTo(i)} style={{ background: i === slide ? C.red : "rgba(255,255,255,0.15)", border: "none", borderRadius: i === slide ? 10 : "50%", width: i === slide ? 28 : 8, height: 8, cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setPaused(p => !p)} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: C.muted, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button onClick={load} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: C.muted, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>↻ Refresh</button>
          <button onClick={toggleFullscreen} style={{ background: C.red, border: "none", color: "#fff", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
            {fullscreen ? "⊠ EXIT" : "⊞ FULLSCREEN"}
          </button>
          {!fullscreen && <a href="/member-hub" style={{ fontSize: 11, color: C.dim, textDecoration: "none", fontFamily: "monospace" }}>← Hub</a>}
        </div>
      </div>

      {/* Progress bar */}
      {!paused && (
        <div style={{ height: 2, background: "rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div key={`${slide}-${paused}`} style={{ height: "100%", background: C.red, animation: `progressBar ${SLIDE_DURATION}ms linear` }} />
        </div>
      )}

      {/* Slide label */}
      <div style={{ textAlign: "center", padding: "10px 0 0", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: C.dim, letterSpacing: 2, flexShrink: 0 }}>
        {SLIDES[slide].label}
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, overflow: "hidden", padding: "16px 32px 24px", position: "relative", opacity: transitioning ? 0 : 1, transition: "opacity 0.35s ease" }}
        className={transitioning ? "" : "projector-slide"}
      >
        {SLIDES[slide].id === "calendar" && <CalendarSlide events={data.events} now={now} />}
        {SLIDES[slide].id === "tasks" && <TasksSlide tasks={data.tasks} />}
        {SLIDES[slide].id === "announcements" && <AnnouncementsSlide items={data.announcements} />}
        {/* Clock overlay on all slides */}
        <div style={{ position: "absolute", top: 12, right: 16, fontFamily: "'Orbitron', sans-serif", fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: 2, textShadow: "0 0 20px rgba(0,0,0,0.8)", opacity: 0.7, lineHeight: 1.2, textAlign: "right" }}>
          <div>{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
          <div style={{ fontSize: 10, fontFamily: "'Share Tech Mono', monospace", fontWeight: 400, color: C.dim, letterSpacing: 1 }}>{now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#334155" }}>
          {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#334155" }}>
          {data.events.length} upcoming · {data.tasks.length} open tasks · {data.announcements.length} announcements
        </div>
      </div>
    </div>
  );
}

// ── CALENDAR SLIDE ──────────────────────────────────────────────────────
function CalendarSlide({ events, now }) {
  const todayStr = now.toISOString().split("T")[0];
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const firstDay = new Date(thisYear, thisMonth, 1).getDay();
  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function eventsOn(day) {
    const ds = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.date === ds || (e.end_date && e.date <= ds && e.end_date >= ds));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, height: "100%" }}>
      {/* Mini calendar */}
      <div>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(18px, 3vw, 28px)", fontWeight: 700, color: C.text, marginBottom: 16 }}>
          {MONTHS[thisMonth]} {thisYear}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
          {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, color: C.dim, fontFamily: "monospace", padding: "4px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const dayEvs = eventsOn(day);
            const ds = `${thisYear}-${String(thisMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = ds === todayStr;
            return (
              <div key={day} style={{ minHeight: 52, background: isToday ? "rgba(59,130,246,0.15)" : dayEvs.length ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${isToday ? "rgba(59,130,246,0.5)" : dayEvs.length ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)"}`, borderRadius: 5, padding: "4px 5px" }}>
                <div style={{ fontSize: 11, color: isToday ? C.blue : C.dim, fontWeight: isToday ? 700 : 400, fontFamily: "monospace" }}>{day}</div>
                {dayEvs.slice(0, 2).map(ev => (
                  <div key={ev.id} style={{ fontSize: 8, background: `${typeColor[ev.type]}22`, color: typeColor[ev.type], borderRadius: 2, padding: "1px 3px", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div style={{ overflow: "hidden" }}>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>UPCOMING</div>
        {events.length === 0 && <div style={{ color: C.dim, fontFamily: "monospace", fontSize: 14 }}>No upcoming events.</div>}
        {events.slice(0, 8).map(ev => (
          <div key={ev.id} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
            <div style={{ width: 4, minHeight: 36, borderRadius: 2, background: typeColor[ev.type] || C.dim, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "clamp(12px, 1.5vw, 15px)", color: C.text }}>{ev.title}</div>
              <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>
                {ev.date}{ev.end_date && ev.end_date !== ev.date ? ` → ${ev.end_date}` : ""}{ev.time ? ` · ${ev.time}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TASKS SLIDE ──────────────────────────────────────────────────────────
function TasksSlide({ tasks }) {
  const active = tasks.filter(t => t.status === "In Progress");
  const todo = tasks.filter(t => t.status === "To Do" || t.status === "Backlog");
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date());

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 14 }}>
        {[
          { label: "TOTAL OPEN", val: tasks.length, color: C.blue },
          { label: "IN PROGRESS", val: active.length, color: C.amber },
          { label: "OVERDUE", val: overdue.length, color: C.red },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}12`, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "10px 20px", textAlign: "center", flex: 1 }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: C.dim, letterSpacing: 2, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Task columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, overflow: "hidden" }}>
        <TaskColumn title="IN PROGRESS" tasks={active} color={C.amber} />
        <TaskColumn title="UP NEXT" tasks={todo.slice(0, 8)} color={C.blue} />
      </div>
    </div>
  );
}

function TaskColumn({ title, tasks, color }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 8, padding: 14, overflow: "hidden" }}>
      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, color, letterSpacing: 2, marginBottom: 10 }}>{title} ({tasks.length})</div>
      {tasks.length === 0 && <div style={{ color: C.dim, fontSize: 13, fontFamily: "monospace" }}>None</div>}
      {tasks.map(t => {
        const overdue = t.due_date && new Date(t.due_date) < new Date();
        return (
          <div key={t.id} style={{ borderLeft: `3px solid ${priorityColor[t.priority] || C.dim}`, paddingLeft: 10, marginBottom: 10 }}>
            <div style={{ fontSize: "clamp(12px, 1.4vw, 14px)", fontWeight: 600, color: overdue ? C.red : C.text, lineHeight: 1.3 }}>{t.title}</div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", marginTop: 2 }}>
              {t.subteam && t.subteam !== "All" ? `${t.subteam} · ` : ""}{t.assigned_name ? `${t.assigned_name}` : "Unassigned"}
              {overdue ? ` · ⚠️ ${t.due_date}` : t.due_date ? ` · ${t.due_date}` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ANNOUNCEMENTS SLIDE ──────────────────────────────────────────────────
function AnnouncementsSlide({ items }) {
  const tagColor = { General: "#64748b", Build: "#f59e0b", Programming: "#3b82f6", "Marketing & Outreach": "#22c55e", Competition: "#ef4444", Reminder: "#a855f7", Urgent: "#ef4444" };

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return "just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(16px, 2.5vw, 24px)", fontWeight: 700, color: C.text, marginBottom: 20 }}>
        Team Announcements
      </div>
      {items.length === 0 && <div style={{ color: C.dim, fontFamily: "monospace", fontSize: 14 }}>No announcements.</div>}
      <div style={{ display: "grid", gridTemplateColumns: items.length > 2 ? "1fr 1fr" : "1fr", gap: 14 }}>
        {items.slice(0, 4).map(item => (
          <div key={item.id} style={{ background: item.pinned ? "rgba(239,68,68,0.07)" : "rgba(255,255,255,0.03)", border: `1px solid ${item.pinned ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              {item.pinned && <span style={{ fontSize: 11, color: C.red, fontFamily: "monospace" }}>📌</span>}
              <span style={{ fontSize: 10, background: `${tagColor[item.tag] || "#64748b"}22`, color: tagColor[item.tag] || "#64748b", borderRadius: 10, padding: "2px 8px", fontFamily: "monospace" }}>{item.tag}</span>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginLeft: "auto" }}>{timeAgo(item.created_at)}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: "clamp(13px, 1.8vw, 16px)", color: C.text, marginBottom: 6 }}>{item.title}</div>
            <div style={{ fontSize: "clamp(11px, 1.2vw, 13px)", color: C.muted, lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
              {item.body}
            </div>
            {item.author && <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginTop: 8 }}>— {item.author}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
