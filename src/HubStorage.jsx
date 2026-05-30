import { useState, useEffect } from "react";
import { FONTS, C, HubHeader, toastStyle, inputStyle, selectStyle, addBtnStyle, ghostBtn, modalStyle, overlayStyle } from "./hubUtils.jsx";

const STORAGE_KEY = 'custom_email_templates';

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

function saveTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export default function HubStorage() {
  const [authed, setAuthed] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    const a = localStorage.getItem("hub_authed") === "true";
    if (!a) { window.location.href = "/member-hub"; return; }
    setAuthed(true);
    document.title = "Your Stuff · Team 4550";
    setTemplates(loadTemplates());
  }, []);

  const save = (form) => {
    if (!form.label.trim() || !form.subject.trim() || !form.body.trim()) return;
    let list = loadTemplates();
    if (form._edit) {
      list = list.map((t, i) => i === form._edit ? { label: form.label.trim(), subject: form.subject.trim(), body: form.body.trim() } : t);
    } else {
      list.push({ label: form.label.trim(), subject: form.subject.trim(), body: form.body.trim() });
    }
    saveTemplates(list);
    setTemplates(list);
    setModal(null);
    showToast(form._edit ? "✅ Template updated" : "✅ Template added");
  };

  const remove = (idx) => {
    if (!confirm("Delete this template?")) return;
    const list = loadTemplates();
    list.splice(idx, 1);
    saveTemplates(list);
    setTemplates(list);
    showToast("🗑️ Template deleted");
  };

  if (!authed) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2',sans-serif", position: "relative" }}>
      <style>{FONTS}</style>
      <HubHeader title="YOUR STUFF" />

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text }}>📧 Email Templates</div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 4 }}>
              Customize templates used in the Sponsor Tracker
            </div>
          </div>
          <button style={addBtnStyle} onClick={() => setModal({})}>+ ADD TEMPLATE</button>
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
                    <button style={ghostBtn} onClick={() => setModal({ ...t, _edit: i })}>EDIT</button>
                    <button style={{ ...ghostBtn, color: C.red, borderColor: `${C.red}44` }} onClick={() => remove(i)}>DEL</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", marginBottom: 4 }}>Subject: {t.subject}</div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis" }}>{t.body}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal && (
        <TemplateForm form={modal} onSave={save} onClose={() => setModal(null)} />
      )}

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

function TemplateForm({ form, onSave, onClose }) {
  const [label, setLabel] = useState(form.label || "");
  const [subject, setSubject] = useState(form.subject || "");
  const [body, setBody] = useState(form.body || "");
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
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
          <button style={addBtnStyle} onClick={() => onSave({ label, subject, body, _edit: form._edit })} disabled={!label.trim() || !subject.trim() || !body.trim()}>
            SAVE
          </button>
          <button style={ghostBtn} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
