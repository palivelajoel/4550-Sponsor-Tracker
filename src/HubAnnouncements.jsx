import { useState, useEffect } from "react";
import { motion } from 'framer-motion'
import { FONTS, C, sbFetch, isAuthed, canEditHub, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, addBtnStyle, ghostBtn, dangerBtn, hubProxy } from "./hubUtils.jsx";
import HubBackground from "./HubBackground.jsx";

const TAGS = ["General", "Build", "Programming", "Marketing & Outreach", "Competition", "Reminder", "Urgent"];
const tagColor = { General: "#64748b", Build: "#f59e0b", Programming: "#3b82f6", "Marketing & Outreach": "#22c55e", Competition: "#ef4444", Reminder: "#a855f7", Urgent: "#ef4444" };

export default function HubAnnouncements() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tag: "General", pinned: false, author: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Announcements · Team 4550";
    const username = localStorage.getItem("hub_username") || "";
    setForm(f => ({ ...f, author: username }));
    load();
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function load() {
    const r = await sbFetch("hub_announcements?select=*&order=pinned.desc,created_at.desc");
    if (r) setItems(r);
  }

  async function post() {
    if (!form.title || !form.body) return showToast("Title and body required.");
    setSaving(true);
    try {
      await hubProxy("hub_announcements", "insert", form);
      // Push to Discord
      const token = localStorage.getItem("hub_token");
      if (token) {
        fetch("/api/announce-to-discord", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        }).catch(() => {});
      }
      showToast("Posted!");
    } catch (e) {
      showToast("Post failed: " + (e.message || e));
    }
    setSaving(false);
    setModal(false);
    setForm(f => ({ ...f, title: "", body: "", tag: "General", pinned: false }));
    load();
  }

  async function deleteItem(id) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await hubProxy("hub_announcements", "delete", { id });
      showToast("Deleted.");
    } catch (e) {
      showToast("Delete failed: " + (e.message || e));
    }
    setExpanded(null);
    load();
  }

  async function togglePin(item) {
    try {
      await hubProxy("hub_announcements", "update", { id: item.id, updates: { pinned: !item.pinned } });
    } catch (e) {
      showToast("Pin failed: " + (e.message || e));
    }
    load();
  }

  const filtered = filter === "All" ? items : items.filter(i => i.tag === filter);

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <HubBackground density={11000} opacity={0.28} animated={false} />
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="📣 Announcements" />

      {/* Toolbar */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {canEdit ? <button onClick={() => setModal(true)} style={addBtnStyle}>+ Post Announcement</button> : <div style={{ color: C.dim, fontSize: 12, fontFamily: "monospace", padding: "10px 0" }}>View only: only captains and mentors can post announcements.</div>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...TAGS].map(tag => (
            <button key={tag} onClick={() => setFilter(tag)} style={{
              background: filter === tag ? `${tagColor[tag] || "#ef4444"}22` : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === tag ? tagColor[tag] || "#ef4444" : C.border}`,
              color: filter === tag ? tagColor[tag] || C.red : C.muted,
              borderRadius: 20, padding: "5px 11px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
            }}>{tag}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 20px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: C.dim, padding: "60px 0", fontFamily: "monospace" }}>No announcements yet.</div>
        )}
        {filtered.map((item, i) => {
          const isExpanded = expanded === item.id;
          return (
            <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: i * 0.04 }}
              style={{
              background: item.pinned ? "rgba(239,68,68,0.06)" : C.surface,
              border: `1px solid ${item.pinned ? "rgba(239,68,68,0.25)" : C.border}`,
              borderRadius: 10,
              padding: "18px 20px",
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    {item.pinned && <span style={{ fontSize: 11, color: C.red, fontFamily: "monospace" }}>📌 PINNED</span>}
                    <span style={{ fontSize: 10, background: `${tagColor[item.tag] || "#64748b"}22`, color: tagColor[item.tag] || "#64748b", borderRadius: 10, padding: "2px 8px", fontFamily: "monospace" }}>{item.tag}</span>
                    <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>{timeAgo(item.created_at)}</span>
                    {item.author && <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>· {item.author}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, whiteSpace: "pre-wrap", display: isExpanded ? "block" : "-webkit-box", WebkitLineClamp: isExpanded ? "unset" : 3, WebkitBoxOrient: "vertical", overflow: isExpanded ? "visible" : "hidden" }}>
                    {item.body}
                  </div>
                  {item.body.length > 200 && (
                    <button onClick={() => setExpanded(isExpanded ? null : item.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 12, cursor: "pointer", fontFamily: "monospace", marginTop: 6, padding: 0 }}>
                      {isExpanded ? "Show less" : "Read more →"}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  {canEdit ? (
                    <>
                      <button onClick={() => togglePin(item)} style={{ ...ghostBtn, fontSize: 11, padding: "5px 10px" }}>{item.pinned ? "Unpin" : "Pin"}</button>
                      <button onClick={() => deleteItem(item.id)} style={{ ...dangerBtn, fontSize: 11, padding: "5px 10px" }}>Delete</button>
                    </>
                  ) : (
                    <div style={{ color: C.dim, fontSize: 11, fontFamily: "monospace" }}>View only</div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Post modal */}
      {modal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 520 }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>New Announcement</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <textarea placeholder="Message *" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} />
              <select value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })} style={selectStyle}>
                {TAGS.map(t => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="Your name" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} style={inputStyle} />
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted, cursor: "pointer" }}>
                <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} />
                Pin this announcement
              </label>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={post} disabled={saving} style={{ ...addBtnStyle, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? "Posting..." : "Post"}</button>
                <button onClick={() => setModal(false)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
