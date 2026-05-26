import { useState, useEffect, useRef } from "react";
import { FONTS, C, sbFetch, isAuthed, canEditHub, SUBTEAMS, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, modalStyle, addBtnStyle, ghostBtn, dangerBtn, hubProxy } from "./hubUtils.jsx";

const STATUSES = ["Backlog", "To Do", "In Progress", "Review", "Done"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const statusColor = { Backlog: "#475569", "To Do": "#64748b", "In Progress": "#3b82f6", Review: "#f59e0b", Done: "#22c55e" };
const priorityColor = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444", Critical: "#a855f7" };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const startOfWeek = d => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); return r; };

export default function HubTasks() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [modal, setModal] = useState(null);
  const [filterTeam, setFilterTeam] = useState("All");
  const [filterMember, setFilterMember] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [form, setForm] = useState({ title: "", description: "", subteam: "All", assigned_to: "", assigned_name: "", start_date: "", due_date: "", priority: "Medium", status: "To Do" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [dragId, setDragId] = useState(null);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Tasks · Team 4550";
    load();
  }, []);

  // Auto-delete completed tasks older than 24 hours
  useEffect(() => {
    const cleanup = async () => {
      try {
        const r = await sbFetch("hub_tasks?select=id,status,created_at&status=eq.Done");
        if (!r) return;
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        await Promise.all(r.filter(t => t.created_at && new Date(t.created_at).getTime() < cutoff).map(t =>
          hubProxy("hub_tasks", "delete", { id: t.id }).catch(() => {})
        ));
      } catch {}
    };
    cleanup();
    const interval = setInterval(cleanup, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function load() {
    const [t, m] = await Promise.all([
      sbFetch("hub_tasks?select=*&order=created_at.desc"),
      sbFetch("members?select=id,username,full_name,role&order=full_name.asc"),
    ]);
    if (t) setTasks(t);
    if (m) setMembers(m);
  }

  function openAdd(status = "To Do") {    if (!canEdit) return;    setForm({ title: "", description: "", subteam: "All", assigned_to: "", assigned_name: "", start_date: "", due_date: "", priority: "Medium", status });
    setModal({ mode: "add" });
  }

  function openEdit(task) {
    setForm({ title: task.title, description: task.description || "", subteam: task.subteam || "All", assigned_to: task.assigned_to || "", assigned_name: task.assigned_name || "", start_date: task.start_date || "", due_date: task.due_date || "", priority: task.priority, status: task.status });
    setModal({ mode: "edit", task });
  }

  async function save() {
    if (!form.title) return;
    setSaving(true);
    const member = members.find(m => m.id === form.assigned_to);
    const payload = { ...form, assigned_name: member ? member.full_name || member.username : form.assigned_name };
    if (!payload.start_date) { payload.start_date = null; delete payload.start_date; }
    if (!payload.due_date) { payload.due_date = null; delete payload.due_date; }
    try {
      if (modal.mode === "add") {
        await hubProxy("hub_tasks", "insert", payload);
        if (payload.status === "Done") notifyTaskDone(payload);
        showToast("Task created.");
      } else {
        await hubProxy("hub_tasks", "update", { id: modal.task.id, updates: payload });
        if (payload.status === "Done") notifyTaskDone({ ...modal.task, ...payload });
        showToast("Task updated.");
      }
    } catch (e) {
      showToast("Save failed: " + (e.message || e));
    }
    setSaving(false);
    setModal(null);
    load();
  }

  function notifyTaskDone(task) {
    const token = localStorage.getItem("hub_token");
    if (!token) return;
    const by = localStorage.getItem("hub_username") || "Someone";
    fetch("/api/announce-to-discord", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: `✅ Task Completed: ${task.title}`,
        body: `**${task.title}**\nCompleted by: ${by}\nPriority: ${task.priority}${task.assigned_name ? `\nAssigned to: ${task.assigned_name}` : ""}${task.subteam && task.subteam !== "All" ? `\nSubteam: ${task.subteam}` : ""}`,
        tag: "General",
      }),
    }).catch(() => {});
  }

  async function deleteTask(id) {
    try {
      await hubProxy("hub_tasks", "delete", { id });
      showToast("Deleted.");
    } catch (e) {
      showToast("Delete failed: " + (e.message || e));
    }
    load();
    setModal(null);
  }

  async function moveTask(id, newStatus) {
    try {
      const task = tasks.find(t => t.id === id);
      await hubProxy("hub_tasks", "update", { id, updates: { status: newStatus } });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      if (newStatus === "Done" && task) notifyTaskDone(task);
    } catch { showToast("Move failed."); }
  }

  function filteredTasks(status) {
    return tasks.filter(t => {
      if (t.status !== status) return false;
      if (filterTeam !== "All" && t.subteam !== filterTeam && t.subteam !== "All") return false;
      if (filterMember && t.assigned_to !== filterMember) return false;
      return true;
    });
  }

  const isOverdue = t => t.due_date && t.status !== "Done" && new Date(t.due_date) < new Date();

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif" }}>
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="✅ Task Board" />

      {/* View switcher + Filters */}
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "rgba(13,17,23,0.8)" }}>
        <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
          {["board", "gantt"].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: "5px 10px", cursor: "pointer", fontFamily: "monospace", fontSize: 10,
              background: viewMode === m ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${viewMode === m ? C.red : C.border}`,
              color: viewMode === m ? C.red : C.muted, borderRadius: 4,
            }}>{m === "board" ? "📋 Board" : "📊 Gantt"}</button>
          ))}
        </div>
        {canEdit ? <button onClick={() => openAdd()} style={addBtnStyle}>+ New Task</button> : <div style={{ color: C.dim, fontSize: 12, fontFamily: "monospace", padding: "10px 0" }}>View only</div>}
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
          {["All", "Build", "Programming", "Marketing & Outreach"].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={{ ...selectStyle, width: "auto" }}>
          <option value="">All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.username}</option>)}
        </select>
        <div style={{ marginLeft: "auto", fontSize: 12, color: C.dim, fontFamily: "monospace" }}>
          {tasks.filter(t => t.status !== "Done").length} open · {tasks.filter(t => t.status === "Done").length} done
        </div>
      </div>

      {viewMode === "gantt" ? (
        <GanttChart tasks={tasks.filter(t => filterTeam === "All" || t.subteam === filterTeam || t.subteam === "All").filter(t => !filterMember || t.assigned_to === filterMember)} {...{ priorityColor, statusColor, openEdit, isOverdue }} />
      ) : (
        /* Board */
        <div style={{ overflowX: "auto", padding: "20px" }}>
        <div style={{ display: "flex", gap: 14, minWidth: "max-content", alignItems: "flex-start" }}>
          {STATUSES.map(status => {
            const col = filteredTasks(status);
            return (
              <div
                key={status}
                style={{ width: 260, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); if (dragId) moveTask(dragId, status); setDragId(null); }}
              >
                {/* Column header */}
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor[status] }} />
                    <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>{status.toUpperCase()}</span>
                    <span style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: C.dim }}>{col.length}</span>
                  </div>
                  {canEdit && <button onClick={() => openAdd(status)} style={{ background: "transparent", border: "none", color: C.dim, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>+</button>}
                </div>

                {/* Cards */}
                <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 80 }}>
                  {col.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={isOverdue(task)}
                      onClick={() => openEdit(task)}
                      onDragStart={() => setDragId(task.id)}
                    />
                  ))}
                  {col.length === 0 && (
                    <div style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: "16px 0", fontFamily: "monospace" }}>Drop here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={modalStyle}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>
              {modal.mode === "add" ? "New Task" : "Edit Task"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={selectStyle}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={selectStyle}>
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <select value={form.subteam} onChange={e => setForm({ ...form, subteam: e.target.value })} style={selectStyle}>
                <option value="All">All Sub-Teams</option>
                {["Build", "Programming", "Marketing & Outreach"].map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} style={selectStyle}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name || m.username}</option>)}
              </select>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "monospace" }}>Start Date</div>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: "monospace" }}>Due Date</div>
                  <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={save} disabled={saving} style={{ ...addBtnStyle, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save"}</button>
                <button onClick={() => setModal(null)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
                {modal.mode === "edit" && <button onClick={() => deleteTask(modal.task.id)} style={dangerBtn}>Delete</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gantt Chart ──
function GanttChart({ tasks, priorityColor, statusColor, openEdit, isOverdue }) {
  const [ganttSpan, setGanttSpan] = useState("month"); // month | quarter
  const today = new Date();

  const hasRange = t => t.start_date || t.due_date;

  function parseDate(s) { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

  function ganttRange() {
    const now = new Date();
    if (ganttSpan === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 2, 0) };
    const q = Math.floor(now.getMonth() / 3) * 3;
    return { start: new Date(now.getFullYear(), q, 1), end: new Date(now.getFullYear(), q + 3, 0) };
  }

  const range = ganttRange();
  const dayCount = Math.round((range.end - range.start) / (1000 * 60 * 60 * 24)) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => { const d = new Date(range.start); d.setDate(d.getDate() + i); return d; });

  // Week headers
  const weeks = [];
  days.forEach(d => { const ws = startOfWeek(d); const wsStr = ws.toISOString(); if (!weeks.find(w => w === wsStr)) weeks.push(wsStr); });

  const barTasks = tasks.filter(t => hasRange(t)).sort((a, b) => {
    const sa = parseDate(a.start_date) || parseDate(a.due_date) || new Date();
    const sb = parseDate(b.start_date) || parseDate(b.due_date) || new Date();
    return sa - sb;
  });

  const noDateTasks = tasks.filter(t => !hasRange(t));

  function barLeft(task) {
    const s = parseDate(task.start_date) || parseDate(task.due_date) || range.start;
    const pct = ((s - range.start) / (range.end - range.start)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  function barWidth(task) {
    const s = parseDate(task.start_date) || parseDate(task.due_date) || range.start;
    const e = parseDate(task.due_date) || s;
    const dur = Math.max(e - s, 86400000);
    const pct = (dur / (range.end - range.start)) * 100;
    return Math.max(2, Math.min(100 - barLeft(task), pct));
  }

  return (
    <div style={{ padding: "12px 16px" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["month", "quarter"].map(s => (
          <button key={s} onClick={() => setGanttSpan(s)} style={{
            padding: "4px 10px", cursor: "pointer", fontFamily: "monospace", fontSize: 10,
            background: ganttSpan === s ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${ganttSpan === s ? C.red : C.border}`,
            color: ganttSpan === s ? C.red : C.muted, borderRadius: 4,
          }}>{s}</button>
        ))}
        <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginLeft: 8 }}>
          {days[0]?.toLocaleDateString()} – {days[days.length - 1]?.toLocaleDateString()}
        </span>
      </div>

      {/* Gantt grid */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 600, position: "relative" }}>
          {/* Week headers */}
          <div style={{ display: "flex", marginBottom: 4, borderBottom: `1px solid ${C.border}`, paddingBottom: 4 }}>
            <div style={{ width: 200, flexShrink: 0 }} />
            {weeks.map(w => {
              const d = new Date(w);
              const isCurrent = d <= today && addDays(d, 6) >= today;
              return (
                <div key={w} style={{ flex: 1, fontFamily: "monospace", fontSize: 9, color: isCurrent ? C.red : C.dim, fontWeight: isCurrent ? 700 : 400, textAlign: "center" }}>
                  {MONTHS[d.getMonth()].slice(0, 3)} {d.getDate()}
                </div>
              );
            })}
          </div>

          {/* Today line */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 200, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: `${((today - range.start) / (range.end - range.start)) * 100}%`, top: 0, bottom: 0, width: 1, background: C.red, opacity: 0.6 }} />
            </div>

            {/* Bar rows */}
            {barTasks.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", color: C.dim, fontFamily: "monospace", fontSize: 12 }}>
                No tasks with dates. Set a start or due date on a task to see it here.
              </div>
            )}
            {barTasks.map(task => (
              <div key={task.id} onClick={() => openEdit(task)} style={{ display: "flex", alignItems: "center", height: 28, marginBottom: 3, cursor: "pointer", position: "relative" }}>
                <div style={{ width: 200, flexShrink: 0, fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{task.title}</div>
                <div style={{ position: "absolute", left: 200, right: 0, height: "100%" }}>
                  <div style={{
                    position: "absolute", left: `${barLeft(task)}%`, width: `${barWidth(task)}%`,
                    top: 3, height: 22, borderRadius: 4,
                    background: isOverdue(task) ? "rgba(239,68,68,0.25)" : `${priorityColor[task.priority] || "#64748b"}33`,
                    borderLeft: `3px solid ${isOverdue(task) ? C.red : priorityColor[task.priority] || "#64748b"}`,
                  }}>
                    <div style={{ fontSize: 9, color: C.text, padding: "3px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {task.start_date ? task.start_date.slice(5) : ""} – {task.due_date ? task.due_date.slice(5) : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tasks without dates */}
          {noDateTasks.length > 0 && (
            <div style={{ marginTop: 20, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 6 }}>NO DATE SET</div>
              {noDateTasks.map(task => (
                <div key={task.id} onClick={() => openEdit(task)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor[task.priority], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.text }}>{task.title}</span>
                  <span style={{ fontSize: 9, color: C.dim, fontFamily: "monospace", marginLeft: "auto" }}>{task.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, isOverdue, onClick, onDragStart }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isOverdue ? "rgba(239,68,68,0.07)" : hovered ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isOverdue ? "rgba(239,68,68,0.3)" : hovered ? "rgba(255,255,255,0.15)" : C.border}`,
        borderLeft: `3px solid ${priorityColor[task.priority] || C.dim}`,
        borderRadius: 7,
        padding: "10px 11px",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>{task.title}</div>
      {task.description && <div style={{ fontSize: 11, color: C.dim, marginBottom: 7, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{task.description}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {task.subteam && task.subteam !== "All" && (
          <span style={{ fontSize: 10, background: "rgba(59,130,246,0.15)", color: "#93c5fd", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace" }}>{task.subteam}</span>
        )}
        {task.assigned_name && (
          <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>👤 {task.assigned_name.split(" ")[0]}</span>
        )}
        {task.due_date && (
          <span style={{ fontSize: 10, color: isOverdue ? C.red : C.dim, fontFamily: "monospace", marginLeft: "auto" }}>
            {isOverdue ? "⚠️ " : "📅 "}{task.due_date}
          </span>
        )}
      </div>
    </div>
  );
}
