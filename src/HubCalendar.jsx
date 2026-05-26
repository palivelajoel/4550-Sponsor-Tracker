import { useState, useEffect } from "react";
import { FONTS, C, sbFetch, isAuthed, canEditHub, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, modalStyle, addBtnStyle, ghostBtn, dangerBtn } from "./hubUtils.jsx";
import Starfield from "./Starfield.jsx";

const EVENT_TYPES = [
  { value: "event", label: "Event", color: "#3b82f6" },
  { value: "deadline", label: "Deadline", color: "#ef4444" },
  { value: "meeting", label: "Meeting", color: "#22c55e" },
  { value: "competition", label: "Competition", color: "#f59e0b" },
  { value: "other", label: "Other", color: "#a855f7" },
];
const typeColor = t => EVENT_TYPES.find(e => e.value === t)?.color || "#64748b";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const toDateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfWeek = d => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r; };
const getDate = dateStr => { if (!dateStr) return new Date(); const [y, m, d] = dateStr.split("-").map(Number); return new Date(y, m - 1, d); };

export default function HubCalendar() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [rawEvents, setRawEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [today] = useState(new Date());
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState("month");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", type: "event", date: "", end_date: "", time: "", end_time: "", description: "", all_day: true });
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Calendar · Team 4550";
    loadData();
  }, []);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function loadData() {
    const [evRes, taskRes] = await Promise.all([
      sbFetch("hub_calendar?select=*&order=date.asc"),
      sbFetch("hub_tasks?select=id,title,status,priority,due_date,start_date,assigned_name,subteam&order=due_date.asc¬=due_date.is.null"),
    ]);
    if (evRes) setRawEvents(evRes);
    if (taskRes) setTasks(taskRes);
  }

  // ── Merge events + tasks ──
  const items = (() => {
    const evs = rawEvents.map(e => ({ ...e, kind: "event" }));
    const ts = tasks.filter(t => t.due_date).map(t => ({
      id: t.id, title: t.title, kind: "task", type: "deadline",
      date: t.due_date, end_date: t.due_date, all_day: true,
      time: null, end_time: null, description: "",
      priority: t.priority, status: t.status,
      assigned_name: t.assigned_name, subteam: t.subteam,
    }));
    return [...evs, ...ts].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  })();

  function itemsOnDate(dStr) {
    return items.filter(i => i.date === dStr || (i.end_date && i.date <= dStr && i.end_date >= dStr));
  }

  function itemsInRange(startStr, endStr) {
    return items.filter(i => i.date && i.date <= endStr && (!i.end_date || i.end_date >= startStr));
  }

  function itemColor(item) {
    if (item.kind === "task") {
      const pc = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444", Critical: "#a855f7" };
      return pc[item.priority] || "#64748b";
    }
    return typeColor(item.type);
  }

  // ── Event time positioning ──
  function parseTime(t) { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; }

  function eventStyle(item) {
    if (item.all_day !== false || !item.time) return null;
    const sm = parseTime(item.time) || 0;
    const em = parseTime(item.end_time) || (sm + 60);
    const dur = Math.max(em - sm, 15);
    return { top: `${(sm / 1440) * 100}%`, height: `${(dur / 1440) * 100}%`, minHeight: 22 };
  }

  function eventSummary(item) {
    if (item.time && item.all_day === false) return `${item.time.slice(0, 5)} ${item.title}`;
    return item.title;
  }

  // ── Navigation ──
  function nav(dir) {
    if (view === "month") setCursor(d => new Date(d.getFullYear(), d.getMonth() + dir, 1));
    else if (view === "week") setCursor(d => addDays(d, dir * 7));
    else if (view === "day") setCursor(d => addDays(d, dir));
    else setCursor(new Date());
  }

  function todayLabel() {
    if (view === "month") return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    if (view === "week") {
      const s = startOfWeek(cursor), e = addDays(s, 6);
      if (s.getMonth() === e.getMonth()) return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`;
      return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
    }
    if (view === "day") return `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
    return "All Events";
  }

  // ── Modal ──
  function openAdd(dateObj) {
    if (!canEdit) return;
    const d = dateObj ? toDateStr(dateObj) : "";
    setForm({ title: "", type: "event", date: d, end_date: "", time: "", end_time: "", description: "", all_day: true });
    setModal({ mode: "add" });
  }

  function openEdit(item) {
    if (!canEdit) return;
    if (item.kind === "task") return showToast("Edit tasks from the Task Board.");
    setForm({
      title: item.title, type: item.type || "event",
      date: item.date || "", end_date: item.end_date || "",
      time: item.time || "", end_time: item.end_time || "",
      description: item.description || "", all_day: item.all_day !== false,
    });
    setModal({ mode: "edit", event: item });
  }

  async function saveEvent() {
    if (!form.title || !form.date) return;
    setSaving(true);
    const payload = { ...form };
    if (!payload.end_date) delete payload.end_date;
    if (!payload.time) delete payload.time;
    if (!payload.end_time) delete payload.end_time;
    if (!payload.description) delete payload.description;
    if (modal.mode === "add") {
      await sbFetch("hub_calendar", { method: "POST", body: JSON.stringify(payload) });
      showToast("Event added!");
    } else {
      await sbFetch(`hub_calendar?id=eq.${modal.event.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      showToast("Event updated!");
    }
    setSaving(false); setModal(null); loadData();
  }

  async function deleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    await sbFetch(`hub_calendar?id=eq.${id}`, { method: "DELETE" });
    showToast("Deleted."); loadData(); setSelectedDay(null);
  }

  // ── Render helpers ──
  const tabBtn = (v) => ({
    padding: "7px 14px", cursor: "pointer", fontFamily: "'Orbitron',sans-serif",
    fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    color: view === v ? C.text : C.dim,
    borderBottom: view === v ? `2px solid ${C.red}` : "2px solid transparent",
    background: "transparent", borderTop: "none", borderLeft: "none", borderRight: "none",
  });

  const viewBtn = (v) => ({
    padding: "5px 10px", cursor: "pointer", fontFamily: "monospace", fontSize: 10,
    background: view === v ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${view === v ? C.red : C.border}`,
    color: view === v ? C.red : C.muted, borderRadius: 4,
  });

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <Starfield density={11500} opacity={0.28} />
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="📅 Calendar" />

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${C.border}`, flexWrap: "wrap", background: "rgba(13,17,23,0.8)", position: "sticky", top: 61, zIndex: 50 }}>
        <button onClick={() => nav(-1)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 14 }}>←</button>
        <button onClick={() => setCursor(new Date())} style={{ ...ghostBtn, fontSize: 10, padding: "4px 8px" }}>Today</button>
        <button onClick={() => nav(1)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 14 }}>→</button>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, color: C.text, marginRight: 12 }}>{todayLabel()}</div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {["month", "week", "day", "events"].map(v => (
            <button key={v} onClick={() => setView(v)} style={viewBtn(v)}>{v}</button>
          ))}
        </div>
        {canEdit && <button onClick={() => openAdd(cursor)} style={{ ...addBtnStyle, fontSize: 10, padding: "5px 10px" }}>+ Add</button>}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {view === "month" && <MonthView {...{ items: itemsOnDate, today, cursor, setCursor, selectedDay, setSelectedDay, openAdd, openEdit, canEdit, isMobile, itemColor }} />}
        {view === "week" && <WeekDayView mode="week" {...{ items: itemsOnDate, itemsInRange, cursor, today, openAdd, openEdit, canEdit, itemColor, eventStyle, eventSummary, isMobile }} />}
        {view === "day" && <WeekDayView mode="day" {...{ items: itemsOnDate, itemsInRange, cursor, today, openAdd, openEdit, canEdit, itemColor, eventStyle, eventSummary, isMobile }} />}
        {view === "events" && <EventsView {...{ items: itemsInRange, openEdit, canEdit, itemColor, eventSummary, isMobile }} />}
      </div>

      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={modalStyle}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>
              {modal.mode === "add" ? "New Event" : "Edit Event"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "monospace" }}>Start Date *</div>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "monospace" }}>End Date</div>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
                <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} />
                All day
              </label>
              {!form.all_day && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "monospace" }}>Start Time</div>
                    <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "monospace" }}>End Time</div>
                    <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} style={inputStyle} />
                  </div>
                </div>
              )}
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={selectStyle}>
                {EVENT_TYPES.filter(t => t.value !== "deadline").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={saveEvent} disabled={saving} style={{ ...addBtnStyle, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setModal(null)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
                {modal.mode === "edit" && <button onClick={() => { deleteEvent(modal.event.id); setModal(null); }} style={dangerBtn}>Delete</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Month View ──
function MonthView({ items: itemsOnDate, today, cursor, selectedDay, setSelectedDay, openAdd, openEdit, canEdit, isMobile, itemColor }) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "12px 8px" : "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
        {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontFamily: "monospace", fontSize: 10, color: C.dim, padding: "4px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dayItems = itemsOnDate(toDateStr(new Date(cursor.getFullYear(), cursor.getMonth(), day)));
          const isToday = day === today.getDate() && cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear();
          const sel = selectedDay === day;
          return (
            <div key={day} onClick={() => setSelectedDay(sel ? null : day)}
              onDoubleClick={() => openAdd(new Date(cursor.getFullYear(), cursor.getMonth(), day))}
              style={{ minHeight: isMobile ? 50 : 72, background: sel ? "rgba(239,68,68,0.12)" : isToday ? "rgba(59,130,246,0.1)" : C.surface, border: `1px solid ${sel ? "rgba(239,68,68,0.5)" : isToday ? "rgba(59,130,246,0.4)" : C.border}`, borderRadius: 6, padding: isMobile ? "3px" : "4px 5px", cursor: "pointer" }}>
              <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? C.blue : C.muted, marginBottom: 2 }}>{day}</div>
              {dayItems.slice(0, 3).map(item => (
                <div key={`${item.kind}-${item.id}`} onClick={e => { e.stopPropagation(); openEdit(item); }}
                  style={{ fontSize: 9, background: `${itemColor(item)}22`, color: itemColor(item), borderRadius: 2, padding: "1px 4px", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: canEdit && item.kind === "event" ? "pointer" : "default" }}>
                  {item.kind === "task" ? "▸ " : ""}{item.title}
                </div>
              ))}
              {dayItems.length > 3 && <div style={{ fontSize: 8, color: C.dim }}>+{dayItems.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week / Day View ──
function WeekDayView({ mode, items: itemsOnDate, itemsInRange, cursor, today, openAdd, openEdit, canEdit, itemColor, eventStyle, eventSummary, isMobile }) {
  const days = mode === "day" ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "8px 4px" : "16px 12px", userSelect: "none" }}>
      <div style={{ display: "grid", gridTemplateColumns: `40px repeat(${days.length},1fr)`, gap: 2 }}>
        {/* Header row */}
        <div />
        {days.map(d => {
          const isT = isSameDay(d, today);
          return (
            <div key={d.toISOString()} style={{ textAlign: "center", padding: "4px 0", fontFamily: "monospace", fontSize: 10, color: isT ? C.blue : C.dim, fontWeight: isT ? 700 : 400 }}>
              {mode === "day" ? "" : DAYS[d.getDay()]} {d.getDate()}
              <div onDoubleClick={() => openAdd(d)} style={{ cursor: "pointer" }}>{isT ? "●" : ""}</div>
            </div>
          );
        })}

        {/* Time rows */}
        {HOURS.map(h => {
          const timeStr = `${String(h).padStart(2, "0")}:00`;
          return (
            <>
              <div key={`t-${h}`} style={{ fontFamily: "monospace", fontSize: 9, color: C.dim, textAlign: "right", paddingRight: 4, minHeight: isMobile ? 30 : 40, borderTop: `1px solid ${C.border}`, lineHeight: "1px" }}>
                {h === 0 || h % 3 === 0 ? timeStr : ""}
              </div>
              {days.map(d => {
                const dStr = toDateStr(d);
                const dayItems = itemsOnDate(dStr).filter(i => i.all_day === false && i.time);
                const cellItems = dayItems.filter(i => {
                  const sm = parseInt(i.time) || 0;
                  return sm >= h && sm < h + 1;
                });
                return (
                  <div key={`${dStr}-${h}`} onDoubleClick={() => openAdd(d)}
                    style={{ minHeight: isMobile ? 30 : 40, borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, background: "rgba(255,255,255,0.01)", position: "relative", cursor: "pointer" }}>
                    {cellItems.map(item => (
                      <div key={`${item.kind}-${item.id}`} onClick={() => openEdit(item)}
                        style={{ position: "absolute", inset: "1px 1px auto 1px", background: `${itemColor(item)}33`, color: itemColor(item), borderRadius: 3, padding: "1px 4px", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: canEdit && item.kind === "event" ? "pointer" : "default", zIndex: 2 }}>
                        {item.title}
                      </div>
                    ))}
                    {/* All-day indicators for this day */}
                  </div>
                );
              })}
            </>
          );
        })}
      </div>

      {/* All-day items below the grid */}
      {(() => {
        const allDayItems = days.flatMap(d => itemsOnDate(toDateStr(d)).filter(i => i.all_day !== false || !i.time));
        if (!allDayItems.length) return null;
        return (
          <div style={{ marginTop: 8, padding: "8px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 6 }}>ALL-DAY</div>
            {allDayItems.map(item => (
              <div key={`${item.kind}-${item.id}`} onClick={() => openEdit(item)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", cursor: canEdit && item.kind === "event" ? "pointer" : "default", fontSize: 12, color: C.text }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: itemColor(item), flexShrink: 0 }} />
                <span style={{ fontFamily: "monospace", fontSize: 11, color: item.kind === "task" ? C.dim : C.muted, flexShrink: 0 }}>
                  {item.kind === "task" ? "TASK" : item.type?.toUpperCase()}
                </span>
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── Events View (compact agenda, no empty slots) ──
function EventsView({ items: itemsInRange, openEdit, canEdit, itemColor, eventSummary, isMobile }) {
  const start = toDateStr(new Date(new Date().getFullYear(), 0, 1));
  const end = toDateStr(new Date(new Date().getFullYear() + 1, 0, 1));
  const all = itemsInRange(start, end);

  if (!all.length) return <div style={{ textAlign: "center", padding: 60, color: C.dim, fontFamily: "monospace" }}>No events or task deadlines.</div>;

  const groups = {};
  all.forEach(item => {
    const label = item.date || "Unknown";
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  const sortedDates = Object.keys(groups).sort();

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: isMobile ? "12px 8px" : "20px" }}>
      {sortedDates.map(dateStr => {
        const d = getDate(dateStr);
        const label = isSameDay(d, new Date()) ? "Today" : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        const isPast = d < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        return (
          <div key={dateStr} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: isPast ? C.dim : C.text, letterSpacing: 1, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${C.border}` }}>
              {label} <span style={{ color: C.dim, fontFamily: "monospace", fontWeight: 400 }}>{dateStr}</span>
            </div>
            {groups[dateStr].map(item => {
              const startTime = item.time ? item.time.slice(0, 5) : "";
              const endTime = item.end_time ? item.end_time.slice(0, 5) : "";
              const timeLabel = startTime ? (endTime ? `${startTime} – ${endTime}` : startTime) : "";
              return (
                <div key={`${item.kind}-${item.id}`} onClick={() => openEdit(item)}
                  style={{ display: "flex", gap: 10, padding: "8px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 4, cursor: canEdit && item.kind === "event" ? "pointer" : "default", alignItems: "center" }}>
                  <div style={{ width: 3, height: 28, borderRadius: 2, background: itemColor(item), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {item.kind === "task" && (
                        <span style={{ fontSize: 9, background: "rgba(239,68,68,0.12)", color: C.red, borderRadius: 3, padding: "0 5px", fontFamily: "monospace" }}>
                          {item.priority} · {item.status}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>{item.type?.toUpperCase() || "EVENT"}</span>
                      {timeLabel && <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{timeLabel}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
