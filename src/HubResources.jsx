import { useState, useEffect, useRef } from "react";
import { motion } from 'framer-motion'
import { FONTS, C, sbFetch, isAuthed, canEditHub, getRole, getSubteam, getUsername, uploadFile, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, addBtnStyle, ghostBtn, dangerBtn, hubProxy } from "./hubUtils.jsx";
import HubBackground from "./HubBackground.jsx";

const CATEGORIES = ["All", "CAD & Design", "Programming", "Documentation", "Marketing", "Finance", "Competition", "Other"];
const catIcon = { "CAD & Design": "🔧", Programming: "💻", Documentation: "📄", Marketing: "📢", Finance: "💰", Competition: "🏆", Other: "📁" };
function templateKey() { return 'custom_email_templates_' + getUsername(); }

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(templateKey())) || []; } catch { return []; }
}
function saveTemplates(templates) {
  localStorage.setItem(templateKey(), JSON.stringify(templates));
}

export default function HubResources() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("All");
  const [folderFilter, setFolderFilter] = useState(null);
  const [groupBy, setGroupBy] = useState("category");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "Documentation", url: "", file_name: "", folder: "" });
  const [uploadMode, setUploadMode] = useState("url");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);
  // Your Stuff state
  const [templates, setTemplates] = useState([]);
  const [templateModal, setTemplateModal] = useState(null);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Resources · Team 4550";
    load();
    setTemplates(loadTemplates());
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function load() {
    const r = await sbFetch("hub_resources?select=*&order=category.asc,created_at.desc");
    if (r) setItems(r);
  }

  async function submit() {
    if (!form.title) return showToast("Title required.");
    setUploading(true);
    let url = form.url;
    let file_name = form.file_name;
    if (uploadMode === "file" && file) {
      url = await uploadFile(file, "team-assets");
      if (!url) { showToast("Upload failed."); setUploading(false); return; }
      file_name = file.name;
    }
    if (!url) { showToast("Provide a URL or file."); setUploading(false); return; }
    try {
      await hubProxy("hub_resources", "insert", { ...form, url, file_name });
      showToast("Resource added!");
    } catch (e) {
      showToast("Add failed: " + (e.message || e));
    }
    setModal(false);
    setFile(null);
    setForm({ title: "", description: "", category: "Documentation", url: "", file_name: "", folder: "" });
    setUploading(false);
    load();
  }

  async function deleteItem(id) {
    if (!confirm("Delete this resource?")) return;
    try {
      await hubProxy("hub_resources", "delete", { id });
      showToast("Deleted.");
    } catch (e) {
      showToast("Delete failed: " + (e.message || e));
    }
    load();
  }

  const saveTemplate = (t) => {
    if (!t.label.trim() || !t.subject.trim() || !t.body.trim()) return;
    let list = loadTemplates();
    if (t._edit !== undefined) {
      list = list.map((x, i) => i === t._edit ? { label: t.label.trim(), subject: t.subject.trim(), body: t.body.trim() } : x);
    } else {
      list.push({ label: t.label.trim(), subject: t.subject.trim(), body: t.body.trim() });
    }
    saveTemplates(list);
    setTemplates(list);
    setTemplateModal(null);
    showToast(t._edit !== undefined ? "✅ Template updated" : "✅ Template added");
  };

  const deleteTemplate = (idx) => {
    if (!confirm("Delete this template?")) return;
    const list = loadTemplates();
    list.splice(idx, 1);
    saveTemplates(list);
    setTemplates(list);
    showToast("🗑️ Template deleted");
  };

  const showTemplates = getRole() === "Admin" || getSubteam() === "Marketing & Outreach";
  const folders = [...new Set(items.map(i => i.folder || ""))].sort();

  const filtered = items.filter(i => {
    if (filter !== "All" && i.category !== filter) return false;
    if (folderFilter !== null && (i.folder || "") !== folderFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groups = {};
  filtered.forEach(i => {
    const key = groupBy === "folder" ? (i.folder || "Uncategorized") : i.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
  });

  function getFileIcon(url, fname) {
    const ext = (fname || url || "").split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return "📕";
    if (["doc", "docx"].includes(ext)) return "📝";
    if (["xls", "xlsx"].includes(ext)) return "📊";
    if (["ppt", "pptx"].includes(ext)) return "📊";
    if (["zip", "rar"].includes(ext)) return "🗜️";
    if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "🖼️";
    if (url?.includes("drive.google.com")) return "📂";
    if (url?.includes("figma.com")) return "🎨";
    if (url?.includes("github.com")) return "💻";
    return catIcon[url] || "🔗";
  }

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <HubBackground density={11000} opacity={0.28} />
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="📁 Resources" />

      {/* Toolbar */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {canEdit ? <button onClick={() => setModal(true)} style={addBtnStyle}>+ Add Resource</button> : <div style={{ color: C.dim, fontSize: 12, fontFamily: "monospace", padding: "10px 0" }}>View only</div>}
        <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: 180 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              background: filter === cat ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === cat ? "#ec4899" : C.border}`,
              color: filter === cat ? "#ec4899" : C.muted,
              borderRadius: 20, padding: "5px 11px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
            }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
          <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {["category", "folder"].map(m => (
              <button key={m} onClick={() => setGroupBy(m)} style={{
                padding: "5px 10px", background: groupBy === m ? "rgba(236,72,153,0.2)" : "transparent",
                border: "none", color: groupBy === m ? "#ec4899" : C.muted, cursor: "pointer", fontSize: 11, fontFamily: "monospace",
              }}>{m === "category" ? "🏷️ Cat" : "📁 Folder"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Folders */}
      <div style={{ padding: "0 20px 14px", display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.015)" }}>
        <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", padding: "5px 0", marginRight: 4 }}>Folders:</span>
        <button onClick={() => setFolderFilter(null)} style={{
          background: folderFilter === null ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${folderFilter === null ? "#ec4899" : C.border}`,
          color: folderFilter === null ? "#ec4899" : C.muted,
          borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
        }}>All</button>
        <button onClick={() => setFolderFilter("")} style={{
          background: folderFilter === "" ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${folderFilter === "" ? "#ec4899" : C.border}`,
          color: folderFilter === "" ? "#ec4899" : C.muted,
          borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
        }}>Uncategorized</button>
        {folders.filter(f => f).map(f => (
          <button key={f} onClick={() => setFolderFilter(f)} style={{
            background: folderFilter === f ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${folderFilter === f ? "#ec4899" : C.border}`,
            color: folderFilter === f ? "#ec4899" : C.muted,
            borderRadius: 20, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontFamily: "monospace",
          }}>{f}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
        {Object.keys(groups).length === 0 && (
          <div style={{ textAlign: "center", color: C.dim, padding: "60px 0", fontFamily: "monospace" }}>
            No resources yet. Add links, Google Drive files, or upload documents.
          </div>
        )}
        {Object.entries(groups).map(([key, items]) => (
          <div key={key} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 18 }}>{groupBy === "folder" ? "📁" : catIcon[key] || "📁"}</span>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: 1 }}>{key.toUpperCase()}</div>
              <div style={{ flex: 1, height: 1, background: C.border, marginLeft: 8 }} />
              <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>{items.length}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
              {items.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.03 }} whileHover={{ borderColor: "rgba(255,255,255,0.2)" }}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}
                >
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{getFileIcon(item.url, item.file_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, color: C.text, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onMouseEnter={e => e.target.style.color = "#ec4899"}
                      onMouseLeave={e => e.target.style.color = C.text}
                    >{item.title}</a>
                    {item.description && <div style={{ fontSize: 11, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>{item.description}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
                      {item.file_name && <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{item.file_name}</div>}
                      {groupBy === "folder" ? (
                        <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{catIcon[item.category] || "📁"} {item.category}</div>
                      ) : item.folder && (
                        <div style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>📁 {item.folder}</div>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteItem(item.id)} style={{ background: "transparent", border: "none", color: "#475569", cursor: "pointer", fontSize: 14, flexShrink: 0, padding: "0 2px" }}
                      onMouseEnter={e => e.target.style.color = C.red}
                      onMouseLeave={e => e.target.style.color = "#475569"}
                    >✕</button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showTemplates && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px 40px" }}>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text }}>📧 Email Templates</div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 4 }}>
                  Customize templates used in the Sponsor Tracker
                </div>
              </div>
              <button style={addBtnStyle} onClick={() => setTemplateModal({})}>+ ADD TEMPLATE</button>
            </div>

            {templates.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: C.dim, fontFamily: "monospace", fontSize: 13 }}>
                No custom templates yet. Add your first email template above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {templates.map((t, i) => (
                  <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: 1 }}>{t.label}</div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button style={ghostBtn} onClick={() => setTemplateModal({ ...t, _edit: i })}>EDIT</button>
                        <button style={{ ...ghostBtn, color: C.red, borderColor: `${C.red}44` }} onClick={() => deleteTemplate(i)}>DEL</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>Subject: {t.subject}</div>
                    <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>{t.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add modal */}
      {modal && <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
        <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 460 }}>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 20 }}>Add Resource</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle} />
            <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
              {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="Folder (optional)" value={form.folder} onChange={e => setForm({ ...form, folder: e.target.value })} list="res-folders" style={inputStyle} />
            <datalist id="res-folders">
              {folders.filter(f => f).map(f => <option key={f} value={f} />)}
            </datalist>
            <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
              {["url", "file"].map(m => (
                <button key={m} onClick={() => setUploadMode(m)} style={{ flex: 1, padding: "8px", background: uploadMode === m ? "rgba(236,72,153,0.2)" : "transparent", border: "none", color: uploadMode === m ? "#ec4899" : C.muted, cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                  {m === "url" ? "🔗 Link / URL" : "📁 Upload File"}
                </button>
              ))}
            </div>
            {uploadMode === "url" ? (
              <input placeholder="https://drive.google.com/... or any URL" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={inputStyle} />
            ) : (
              <div>
                <button onClick={() => fileRef.current?.click()} style={{ ...ghostBtn, width: "100%", padding: "10px" }}>
                  {file ? `✓ ${file.name}` : "Choose file"}
                </button>
                <input ref={fileRef} type="file" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={submit} disabled={uploading} style={{ ...addBtnStyle, flex: 1, opacity: uploading ? 0.6 : 1 }}>{uploading ? "Uploading..." : "Add"}</button>
              <button onClick={() => setModal(false)} style={{ ...ghostBtn, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>}

      {/* Template form modal */}
      {templateModal && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setTemplateModal(null)}>
          <div style={{ background: "#0d1117", border: `1px solid ${C.border}`, borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 460 }}>
            <TemplateForm form={templateModal} onSave={saveTemplate} onCancel={() => setTemplateModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateForm({ form, onSave, onCancel }) {
  const [label, setLabel] = useState(form.label || "");
  const [subject, setSubject] = useState(form.subject || "");
  const [body, setBody] = useState(form.body || "");
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 700, color: C.red, marginBottom: 20 }}>
        {form._edit !== undefined ? "EDIT TEMPLATE" : "NEW TEMPLATE"}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>LABEL</label>
        <input style={inputStyle} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Cold Email" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>SUBJECT</label>
        <input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Sponsorship Opportunity with [Company Name]" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 6 }}>BODY (use [Company Name] and [Your Name] as placeholders)</label>
        <textarea style={{ ...inputStyle, height: 200, resize: "vertical", lineHeight: 1.6 }} value={body} onChange={e => setBody(e.target.value)} placeholder="Dear [Company Name] Team,..." />
      </div>
      <div style={{ marginBottom: 14 }}>
        <button style={{ ...ghostBtn, fontSize: 11 }} onClick={() => setShowPreview(v => !v)}>
          {showPreview ? "HIDE PREVIEW" : "SHOW PREVIEW"}
        </button>
        {showPreview && (
          <div style={{ marginTop: 10, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12, fontFamily: "monospace", color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            <div style={{ color: C.dim, marginBottom: 4 }}>Subject: {subject || "(empty)"}</div>
            <div>{body || "(empty)"}</div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={addBtnStyle} onClick={() => onSave({ label, subject, body, _edit: form._edit })} disabled={!label.trim() || !subject.trim() || !body.trim()}>SAVE</button>
        <button style={ghostBtn} onClick={onCancel}>CANCEL</button>
      </div>
    </>
  );
}
