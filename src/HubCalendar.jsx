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

export default function HubCalendar() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [tab, setTab] = useState("todos");
  const [events, setEvents] = useState([]);
  const [today] = useState(new Date());
  const [view, setView] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", type: "event", date: "", end_date: "", time: "", description: "", all_day: true });
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [toast, setToast] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Calendar · Team 4550";
    loadEvents();
  }, []);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function loadEvents() {
    const r = await sbFetch("hub_calendar?select=*&order=date.asc");
    if (r) setEvents(r);
  }

  function openAdd(date) {
    if (!canEdit) return;
    const d = date ? `${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}` : "";
    setForm({ title: "", type: "event", date: d, end_date: "", time: "", description: "", all_day: true });
    setModal({ mode: "add" });
  }

  function openEdit(ev) {
    setForm({ title: ev.title, type: ev.type, date: ev.date, end_date: ev.end_date || "", time: ev.time || "", description: ev.description || "", all_day: ev.all_day !== false });
    setModal({ mode: "edit", event: ev });
  }

  async function saveEvent() {
    if (!form.title || !form.date) return;
    setSaving(true);
    if (modal.mode === "add") {
      await sbFetch("hub_calendar", { method: "POST", body: JSON.stringify(form) });
      showToast("Event added!");
    } else {
      await sbFetch(`hub_calendar?id=eq.${modal.event.id}`, { method: "PATCH", body: JSON.stringify(form) });
      showToast("Event updated!");
    }
    setSaving(false);
    setModal(null);
    loadEvents();
  }

  async function deleteEvent(id) {
    if (!confirm("Delete this event?")) return;
    await sbFetch(`hub_calendar?id=eq.${id}`, { method: "DELETE" });
    showToast("Deleted.");
    loadEvents();
    setSelectedDay(null);
  }

  // Calendar grid helpers
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function eventsOnDay(day) {
    const dateStr = `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.date === dateStr || (e.end_date && e.date <= dateStr && e.end_date >= dateStr));
  }

  function isToday(day) {
    return day === today.getDate() && view.month === today.getMonth() && view.year === today.getFullYear();
  }

  const upcomingEvents = events.filter(e => e.date >= today.toISOString().split("T")[0]).slice(0, 8);
  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  const icalUrl = `${window.location.origin}/api/calendar.ics`;

  async function copyIcalUrl() {
    try {
      await navigator.clipboard.writeText(icalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy. URL: " + icalUrl);
    }
  }

  if (!authed) return null;

  const tabStyle = (active) => ({
    padding: "10px 20px",
    cursor: "pointer",
    fontFamily: "'Orbitron', sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
    color: active ? C.text : C.dim,
    borderBottom: active ? `2px solid ${C.red}` : "2px solid transparent",
    transition: "all 0.15s",
    background: "transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <Starfield density={11500} opacity={0.28} />
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}

      <HubHeader title="📅 Team Calendar" />

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, background: "rgba(13,17,23,0.8)", position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => setTab("todos")} style={tabStyle(tab === "todos")}>📋 TO DOS</button>
        <button onClick={() => setTab("subscribe")} style={tabStyle(tab === "subscribe")}>📅 SUBSCRIBE</button>
      </div>

      {tab === "subscribe" ? (
        /* ── Subscribe Tab ── */
        <div style={{ maxWidth: 600, margin: "0 auto", padding: isMobile ? "18px 12px" : "28px 20px", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>
            Subscribe to Calendar
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, lineHeight: 1.6 }}>
            This calendar includes both to-dos (from the To Dos tab) and task deadlines. 
            Subscribe in your favorite calendar app — changes auto-sync.
          </div>

          {/* iCal URL */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", marginBottom: 8 }}>CALENDAR URL</div>
            <div style={{ display: "flex", gap: 8 }}>
              <code style={{ flex: 1, background: "rgba(0,0,0,0.3)", padding: "10px 12px", borderRadius: 6, fontSize: 12, color: C.text, fontFamily: "monospace", wordBreak: "break-all", border: `1px solid ${C.border}` }}>
                {icalUrl}
              </code>
              <button onClick={copyIcalUrl} style={{ ...addBtnStyle, fontSize: 12, padding: "10px 14px", flexShrink: 0 }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", marginBottom: 14 }}>HOW TO SUBSCRIBE</div>
            {[
              { app: "Google Calendar", steps: "Open Google Calendar → Other calendars → + → From URL → paste the URL → Add calendar" },
              { app: "Apple Calendar", steps: "File → New Calendar Subscription → paste the URL → Subscribe → adjust settings → OK" },
              { app: "Outlook", steps: "Open Outlook → Calendar → Add calendar → From internet → paste the URL → OK" },
              { app: "Any iCal app", steps: "Most calendar apps support iCal subscriptions. Paste the URL as a web calendar link." },
            ].map(item => (
              <div key={item.app} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 4 }}>{item.app}</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{item.steps}</div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", marginTop: 8 }}>
              The feed includes all to-dos and task deadlines. Captains/admins can add events on the To Dos tab — they appear in your subscribed calendar within minutes.
            </div>
          </div>
        </div>
      ) : (
        /* ── To Dos (existing calendar) Tab ── */
        <div style={{ maxWidth: 1300, margin: "0 auto", padding: isMobile ? "18px 12px" : "28px 20px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: isMobile ? 16 : 24, alignItems: "start", position: "relative", zIndex: 1 }}>

          {/* Left: Calendar */}
          <div>
            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <button onClick={() => setView(v => { const d = new Date(v.year, v.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={navBtnStyle}>←</button>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 700, color: C.text }}>{MONTHS[view.month]} {view.year}</div>
              <button onClick={() => setView(v => { const d = new Date(v.year, v.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={navBtnStyle}>→</button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
              {DAYS.map(d => (
                <div key={d} style={{ textAlign: "center", fontFamily: "monospace", fontSize: 11, color: C.dim, padding: "6px 0" }}>{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} />;
                const dayEvs = eventsOnDay(day);
                const selected = selectedDay === day;
                const todayCell = isToday(day);
                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(selected ? null : day)}
                    style={{
                      minHeight: isMobile ? 58 : 80,
                      background: selected ? "rgba(239,68,68,0.12)" : todayCell ? "rgba(59,130,246,0.1)" : C.surface,
                      border: `1px solid ${selected ? "rgba(239,68,68,0.5)" : todayCell ? "rgba(59,130,246,0.4)" : C.border}`,
                      borderRadius: 8,
                      padding: isMobile ? "5px 4px" : "6px 7px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onDoubleClick={() => openAdd({ year: view.year, month: view.month, day })}
                  >
                    <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: todayCell ? 700 : 400, color: todayCell ? C.blue : C.muted, marginBottom: 4 }}>{day}</div>
                    {dayEvs.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{ fontSize: 10, background: `${typeColor(ev.type)}22`, color: typeColor(ev.type), borderRadius: 3, padding: "1px 5px", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvs.length > 3 && <div style={{ fontSize: 9, color: C.dim }}>+{dayEvs.length - 3} more</div>}
                  </div>
                );
              })}
            </div>

            {/* Selected day panel */}
            {selectedDay && (
              <div style={{ marginTop: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, color: C.text }}>{MONTHS[view.month]} {selectedDay}, {view.year}</div>
                  <button onClick={() => openAdd({ year: view.year, month: view.month, day: selectedDay })} style={addBtnStyle}>+ Add Event</button>
                </div>
                {selectedEvents.length === 0 && <div style={{ color: C.dim, fontSize: 13 }}>No to-dos. Double-click any day to add.</div>}
                {selectedEvents.map(ev => (
                  <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ width: 4, minHeight: 40, borderRadius: 2, background: typeColor(ev.type), flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: typeColor(ev.type), fontFamily: "monospace", marginTop: 2 }}>{ev.type?.toUpperCase()}{ev.time ? ` · ${ev.time}` : ""}</div>
                      {ev.description && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{ev.description}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {canEdit ? (
                        <>
                          <button onClick={() => openEdit(ev)} style={ghostBtn}>Edit</button>
                          <button onClick={() => deleteEvent(ev.id)} style={dangerBtn}>✕</button>
                        </>
                      ) : (
                        <div style={{ color: C.dim, fontSize: 11, fontFamily: "monospace" }}>View only</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {canEdit ? (
              <button onClick={() => openAdd(null)} style={{ ...addBtnStyle, width: "100%", padding: "12px", fontSize: 13, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>+ ADD TO DO</button>
            ) : (
              <div style={{ color: C.dim, fontSize: 12, fontFamily: "monospace", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, textAlign: "center" }}>View only: captains and mentors can edit to-dos.</div>
            )}

            {/* Legend */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>TO DO TYPES</div>
              {EVENT_TYPES.map(t => (
                <div key={t.value} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />
                  <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{t.label}</span>
                </div>
              ))}
            </div>

            {/* Upcoming */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, color: C.dim, letterSpacing: 2, marginBottom: 12 }}>UPCOMING TO DOS</div>
              {upcomingEvents.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>No upcoming to-dos.</div>}
              {upcomingEvents.map(ev => (
                <div key={ev.id} onClick={() => openEdit(ev)} style={{ display: "flex", gap: 8, marginBottom: 10, cursor: "pointer" }}>
                  <div style={{ width: 3, borderRadius: 2, background: typeColor(ev.type), flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>{ev.date}{ev.time ? ` · ${ev.time}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={modalStyle}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>
              {modal.mode === "add" ? "Add To Do" : "Edit To Do"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={selectStyle}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 4, fontFamily: "monospace" }}>Start Date *</div>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 4, fontFamily: "monospace" }}>End Date</div>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.all_day} onChange={e => setForm({ ...form, all_day: e.target.checked })} />
                  All day
                </label>
                {!form.all_day && (
                  <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                )}
              </div>
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
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

const navBtnStyle = { background: C.surface, border: `1px solid ${C.border}`, color: C.muted, padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 16, fontFamily: "monospace" };
