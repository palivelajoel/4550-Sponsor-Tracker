import { useState, useEffect, useRef } from "react";
import { motion } from 'framer-motion'
import { FONTS, C, sbFetch, isAuthed, canEditHub, getUsername, getToken, HubHeader, FormHeader, toastStyle, inputStyle, selectStyle, addBtnStyle, ghostBtn, hubProxy, getVisibleQuestions } from "./hubUtils.jsx";
import HubBackground from "./HubBackground.jsx";

export default function HubForms() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [view, setView] = useState("list");
  const [editForm, setEditForm] = useState(null);
  const [fillForm, setFillForm] = useState(null);
  const [responsesForm, setResponsesForm] = useState(null);
  const [shareId, setShareId] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Forms · Team 4550";
    loadData();
  }, []);

  async function loadData() {
    const f = await sbFetch("hub_forms?select=*&order=created_at.desc");
    const s = await sbFetch("hub_form_submissions?select=*&order=created_at.desc");
    if (f === null || s === null) { showToast("Failed to load forms — check RLS policies on hub_forms."); return; }
    setForms(f);
    setSubmissions(s);
  }

  const username = getUsername();

  async function testSheets() {
    showToast("Testing Google Sheets connection...");
    try {
      const res = await fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const j = await res.json();
      if (res.ok && j.ok) showToast(`Sheets OK — "${j.spreadsheet}" tabs: ${j.tabs.join(", ")}`);
      else showToast("Sheets error: " + (j.error || res.status));
    } catch (e) { showToast("Sheets error: " + (e.message || e)); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif", position: "relative" }}>
      <HubBackground density={11000} opacity={0.28} />
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      {view === "fill" ? (
        <FormHeader right={<button onClick={() => setView("list")} style={ghostBtn}>← Back</button>} />
      ) : (
        <HubHeader title="📋 Forms" />
      )}

      {view === "list" && (
        <ListForms
          forms={forms} submissions={submissions} canEdit={canEdit} username={username}
          onTestSheets={testSheets}
          onFill={f => { setFillForm(f); setView("fill"); }}
          onEdit={f => {
            const seen = {};
            const remap = {};
            const qs = (f.questions || []).map(q => {
              let id = q.id;
              if (!id || seen[id]) { do { id = nextQid(); } while (seen[id]); if (q.id) remap[q.id] = id; }
              seen[id] = true;
              return { ...q, id };
            });
            qs.forEach(q => {
              if (q.show_if && q.show_if.questionId) {
                const n = remap[q.show_if.questionId] || q.show_if.questionId;
                if (n !== q.show_if.questionId) q.show_if = { ...q.show_if, questionId: n };
              }
            });
            setEditForm({ ...f, questions: qs }); setView("edit");
          }}
          onDelete={async id => {
            if (!confirm("Delete this form and all its responses?")) return;
            try { await hubProxy("hub_forms", "delete", { id }); showToast("Form deleted."); loadData(); } catch (e) { showToast("Delete failed: " + (e.message || e)); }
          }}
          onResponses={f => { setResponsesForm(f); setView("responses"); }}
          onNew={() => { setEditForm({ title: "", description: "", questions: [] }); setView("edit"); }}
          loadData={loadData}
        />
      )}

      {view === "edit" && (
        <FormBuilder
          form={editForm}
          onSave={async f => {
            try {
              if (f.id) {
                await hubProxy("hub_forms", "update", { id: f.id, updates: { title: f.title, description: f.description, questions: f.questions, visibility: f.visibility || "draft" } });
                showToast("Form updated.");
                loadData();
                setView("list");
              } else {
                const res = await hubProxy("hub_forms", "insert", { title: f.title, description: f.description, questions: f.questions, created_by: username, visibility: f.visibility || "draft" });
                showToast("Form created.");
                loadData();
                const newId = res?.data?.[0]?.id;
                if ((f.visibility || "draft") === "public" && newId) {
                  setShareId(newId);
                  setView("share");
                } else {
                  setView("list");
                }
              }
            } catch (e) { showToast("Save failed: " + (e.message || e)); }
          }}
          onCancel={() => setView("list")}
        />
      )}

      {view === "fill" && fillForm && (
        <FormFill
          form={fillForm} username={username}
          onSubmit={async answers => {
            try {
              const res = await hubProxy("hub_form_submissions", "insert", { form_id: fillForm.id, submitted_by: username, answers });
              showToast("Response submitted.");
              fetch("/api/sheets-sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  formTitle: fillForm.title,
                  questions: fillForm.questions || [],
                  answers,
                  submittedBy: username,
                  submissionId: res?.data?.[0]?.id || "",
                  timestamp: new Date().toISOString(),
                }),
              }).then(async r => {
                if (!r.ok) { const j = await r.json().catch(() => null); showToast("Sheet sync failed: " + (j?.error || r.status)); }
              }).catch(e => showToast("Sheet sync failed: " + (e.message || e)));
              loadData();
              setView("list");
            } catch (e) { showToast("Submit failed: " + (e.message || e)); }
          }}
          onCancel={() => setView("list")}
        />
      )}

      {view === "share" && shareId && (
        <ShareLink id={shareId} onDone={() => setView("list")} />
      )}

      {view === "responses" && responsesForm && (
        <FormResponses
          form={responsesForm} submissions={submissions.filter(s => s.form_id === responsesForm.id)}
          canSync={canEdit} onReload={loadData} onToast={showToast}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}

function nextQid() { return "q_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function qTypes() { return ["text", "textarea", "select", "radio", "checkbox"]; }
function qTypeLabel(t) {
  return { text: "Short Text", textarea: "Paragraph", select: "Dropdown", radio: "Multiple Choice", checkbox: "Checkboxes" }[t] || t;
}

function ListForms({ forms, submissions, canEdit, username, onFill, onEdit, onDelete, onResponses, onNew, onTestSheets }) {
  const userSubmitted = formId => submissions.some(s => s.form_id === formId && s.submitted_by === username);
  const submissionCount = formId => submissions.filter(s => s.form_id === formId).length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {canEdit && <button onClick={onTestSheets} style={ghostBtn}>Test Sheets</button>}
        <button onClick={onNew} style={addBtnStyle}>+ Create Form</button>
      </div>

      {forms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.dim, fontFamily: "monospace", fontSize: 14 }}>
          No forms yet. Create one above!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {forms.map(f => {
            if (f.visibility === "draft" && !canEdit) return null;
            const didSubmit = userSubmitted(f.id);
            return (
              <div key={f.id} style={{ background: C.surface, border: `1px solid ${didSubmit ? "rgba(34,197,94,0.3)" : C.border}`, borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: 1 }}>{f.title}</div>
                    {f.description && <div style={{ fontSize: 13, color: C.muted, marginTop: 4, fontFamily: "monospace" }}>{f.description}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
                    {!didSubmit ? (
                      <button onClick={() => onFill(f)} style={{ ...addBtnStyle, padding: "8px 16px", fontSize: 12 }}>Fill Out</button>
                    ) : (
                      <span style={{ fontSize: 11, color: "#22c55e", fontFamily: "monospace", padding: "8px 0" }}>✓ Submitted</span>
                    )}
                    {(canEdit || f.created_by === username) && (
                      <>
                        <button onClick={() => onEdit(f)} style={{ ...ghostBtn, padding: "8px 12px", fontSize: 11 }}>Edit</button>
                        <button onClick={() => onResponses(f)} style={{ ...ghostBtn, padding: "8px 12px", fontSize: 11 }}>
                          Responses ({submissionCount(f.id)})
                        </button>
                        <button onClick={() => onDelete(f.id)} style={{ ...ghostBtn, padding: "8px 12px", fontSize: 11, color: C.red, borderColor: `${C.red}44` }}>Del</button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{(f.questions || []).length} question{(f.questions || []).length !== 1 ? "s" : ""}</span>
                  {f.created_by && <span>· by {f.created_by}</span>}
                  {f.visibility === "public" && (
                    <span style={{ fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "2px 8px", borderRadius: 6 }}>
                      🌐 Public — <a href={`/forms/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#22c55e", textDecoration: "underline" }}>/forms/{f.id.slice(0, 8)}</a>
                    </span>
                  )}
                  {f.visibility === "draft" && (
                    <span style={{ fontSize: 10, color: "#f59e0b", background: "rgba(245,158,11,0.12)", padding: "2px 8px", borderRadius: 6 }}>📝 Draft</span>
                  )}
                  {f.visibility === "team" && (
                    <span style={{ fontSize: 10, color: C.muted, background: `${C.surface}`, padding: "2px 8px", borderRadius: 6 }}>🔒 Team</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShareLink({ id, onDone }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/forms/${id}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div style={{ maxWidth: 650, margin: "0 auto", padding: "24px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>Form Created!</div>
      <div style={{ fontSize: 12, color: C.dim, fontFamily: "monospace", marginBottom: 22 }}>Anyone with this link can submit responses:</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input readOnly value={url} onFocus={e => e.target.select()} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={copy} style={{ ...addBtnStyle, whiteSpace: "nowrap" }}>{copied ? "✓ Copied!" : "Copy Link"}</button>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, color: C.muted, fontSize: 12, fontFamily: "monospace" }}>Open form ↗</a>
      <div>
        <button onClick={onDone} style={{ ...ghostBtn, marginTop: 24 }}>← Back to Forms</button>
      </div>
    </div>
  );
}

function FormBuilder({ form: initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial.title || "");
  const [desc, setDesc] = useState(initial.description || "");
  const [questions, setQuestions] = useState(initial.questions || []);
  const [visibility, setVisibility] = useState(initial.visibility || "draft");
  const [errors, setErrors] = useState("");
  const dragFrom = useRef(null);
  const [dragOverQi, setDragOverQi] = useState(null);

  function addQuestion() {
    setQuestions([...questions, { id: nextQid(), type: "text", label: "", required: false, placeholder: "", options: [""] }]);
  }

  function updateQuestion(id, patch) {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function removeQuestion(id) {
    setQuestions(questions.filter(q => q.id !== id));
  }

  function moveQuestion(from, to) {
    if (from === to) return;
    const arr = [...questions];
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    setQuestions(arr);
  }

  function finishDrag(targetQi) {
    if (dragFrom.current !== null && dragFrom.current !== targetQi) moveQuestion(dragFrom.current, targetQi);
    dragFrom.current = null;
    setDragOverQi(null);
  }

  function setShowIf(qid, questionId) {
    const prev = questions.find(q => q.id === qid)?.show_if;
    if (!questionId) { updateQuestion(qid, { show_if: undefined }); return; }
    const same = prev && prev.questionId === questionId;
    updateQuestion(qid, { show_if: { questionId, values: same ? prev.values || [] : [], not: same ? !!prev.not : false } });
  }

  function toggleShowIfVal(qid, value) {
    const prev = questions.find(q => q.id === qid)?.show_if;
    const g = { questionId: "", values: [], not: false, ...(prev || {}) };
    const cur = Array.isArray(g.values) ? g.values : [];
    updateQuestion(qid, { show_if: { ...g, values: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] } });
  }

  function setShowIfRaw(qid, text) {
    const prev = questions.find(q => q.id === qid)?.show_if;
    const g = { questionId: "", values: [], not: false, ...(prev || {}) };
    updateQuestion(qid, { show_if: { ...g, values: text.split(",").map(s => s.trim()).filter(Boolean) } });
  }

  function setShowIfNot(qid) {
    const prev = questions.find(q => q.id === qid)?.show_if;
    const g = { questionId: "", values: [], not: false, ...(prev || {}) };
    updateQuestion(qid, { show_if: { ...g, not: !g.not } });
  }

  function addOption(qid) {
    setQuestions(questions.map(q => q.id === qid ? { ...q, options: [...(q.options || []), ""] } : q));
  }

  function updateOption(qid, oi, val) {
    setQuestions(questions.map(q => q.id === qid ? { ...q, options: (q.options || []).map((o, i) => i === oi ? val : o) } : q));
  }

  function removeOption(qid, oi) {
    setQuestions(questions.map(q => q.id === qid ? { ...q, options: (q.options || []).filter((_, i) => i !== oi) } : q));
  }

  function isCorrect(q, oi) {
    return Array.isArray(q.correct) ? q.correct.includes(oi) : q.correct === oi;
  }

  function toggleCorrect(qid, oi) {
    setQuestions(questions.map(q => {
      if (q.id !== qid) return q;
      if (q.type === "checkbox") {
        const arr = Array.isArray(q.correct) ? q.correct : [];
        return { ...q, correct: arr.includes(oi) ? arr.filter(x => x !== oi) : [...arr, oi] };
      }
      return { ...q, correct: q.correct === oi ? undefined : oi };
    }));
  }

  function saveWithVisibility(vis) {
    if (!title.trim()) { setErrors("Title required."); return; }
    const valid = questions.filter(q => q.label.trim());
    if (valid.length === 0) { setErrors("Add at least one question."); return; }
    const cleaned = valid.map(q => ({
      ...q,
      label: q.label.trim(),
      placeholder: q.placeholder || "",
      options: ["select", "radio", "checkbox"].includes(q.type) ? (q.options || []).filter(o => o.trim()) : undefined,
    }));
    onSave({ ...initial, title: title.trim(), description: desc.trim(), questions: cleaned, visibility: vis });
  }

  function handleSave() { saveWithVisibility(visibility); }
  function handlePublish() { saveWithVisibility("team"); }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 20px" }}>
      <button onClick={onCancel} style={{ ...ghostBtn, marginBottom: 16, fontSize: 12 }}>← Back</button>

      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20 }}>
        {initial.id ? "Edit Form" : "Create Form"}
      </div>

      {errors && <div style={{ color: C.red, fontSize: 12, fontFamily: "monospace", marginBottom: 12 }}>{errors}</div>}

      <input placeholder="Form Title *" value={title} onChange={e => setTitle(e.target.value)}
        style={{ ...inputStyle, fontSize: 16, marginBottom: 12, fontFamily: "'Orbitron',sans-serif" }} />
      <textarea placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)}
        style={{ ...inputStyle, minHeight: 50, resize: "vertical", marginBottom: 16 }} />

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>VISIBILITY</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setVisibility("draft")} style={{ ...ghostBtn, flex: 1, padding: "10px 14px", fontSize: 12, borderColor: visibility === "draft" ? "#f59e0b" : C.border, color: visibility === "draft" ? "#f59e0b" : C.muted, background: visibility === "draft" ? "rgba(245,158,11,0.07)" : "transparent" }}>
            📝 Draft
          </button>
          <button onClick={() => setVisibility("team")} style={{ ...ghostBtn, flex: 1, padding: "10px 14px", fontSize: 12, borderColor: visibility === "team" ? C.accent : C.border, color: visibility === "team" ? C.accent : C.muted, background: visibility === "team" ? `${C.accent}11` : "transparent" }}>
            🔒 Team Only
          </button>
          <button onClick={() => setVisibility("public")} style={{ ...ghostBtn, flex: 1, padding: "10px 14px", fontSize: 12, borderColor: visibility === "public" ? "#22c55e" : C.border, color: visibility === "public" ? "#22c55e" : C.muted, background: visibility === "public" ? "rgba(34,197,94,0.07)" : "transparent" }}>
            🌐 Public Link
          </button>
        </div>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginTop: 6 }}>
          {visibility === "draft" && "Only you and captains/admins can see this form."}
          {visibility === "team" && "All logged-in hub members can access this form."}
          {visibility === "public" && "Anyone with the link can submit — you'll get a share link after saving."}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: 1 }}>Questions</div>
        <button onClick={addQuestion} style={{ ...ghostBtn, fontSize: 11, padding: "6px 14px" }}>+ Add Question</button>
      </div>

      {questions.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.dim, fontFamily: "monospace", fontSize: 12 }}>
          No questions yet. Click "Add Question" to get started.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {questions.map((q, qi) => (
          <div key={q.id} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverQi(qi); }} onDragLeave={() => { if (dragOverQi === qi) setDragOverQi(null); }} onDrop={e => { e.preventDefault(); finishDrag(qi); }}
            style={{ background: C.surface, border: `1px solid ${dragOverQi === qi ? "#22d3ee" : C.border}`, borderRadius: 10, padding: "16px 18px", transition: "border-color 0.15s", boxShadow: dragOverQi === qi ? "0 0 0 1px rgba(34,211,238,0.25)" : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span draggable onDragStart={e => { dragFrom.current = qi; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(qi)); } catch {} }}
                  title="Drag to reorder"
                  style={{ cursor: "grab", color: dragOverQi === qi ? "#22d3ee" : C.dim, fontSize: 13, letterSpacing: 1, userSelect: "none", transform: dragOverQi === qi ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>⠿</span>
                <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>Q{qi + 1}</span>
              </div>
              <button onClick={() => removeQuestion(q.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>✕</button>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <input placeholder="Question label *" value={q.label} onChange={e => updateQuestion(q.id, { label: e.target.value })}
                style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
              <select value={q.type} onChange={e => updateQuestion(q.id, { type: e.target.value })}
                style={{ ...selectStyle, width: 160, fontSize: 12 }}>
                {qTypes().map(t => <option key={t} value={t}>{qTypeLabel(t)}</option>)}
              </select>
            </div>

            {["select", "radio", "checkbox"].includes(q.type) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 6 }}>Options — click ✓ to mark the correct answer</div>
                {(q.options || []).map((o, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: C.dim }}>{oi + 1}.</span>
                    <input value={o} onChange={e => updateOption(q.id, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "6px 10px" }} />
                    <button onClick={() => toggleCorrect(q.id, oi)} title="Mark as correct answer"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "2px", color: isCorrect(q, oi) ? "#22c55e" : C.dim, fontWeight: isCorrect(q, oi) ? 700 : 400 }}>✓</button>
                    <button onClick={() => removeOption(q.id, oi)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 12, padding: "2px" }}>✕</button>
                  </div>
                ))}
                <button onClick={() => addOption(q.id)} style={{ ...ghostBtn, fontSize: 10, padding: "4px 10px", marginTop: 2 }}>+ Option</button>
              </div>
            )}

            {q.type === "text" && (
              <input placeholder="Placeholder (optional)" value={q.placeholder || ""}
                onChange={e => updateQuestion(q.id, { placeholder: e.target.value })}
                style={{ ...inputStyle, fontSize: 12, marginTop: 8, padding: "6px 10px" }} />
            )}
            {q.type === "textarea" && (
              <input placeholder="Placeholder (optional)" value={q.placeholder || ""}
                onChange={e => updateQuestion(q.id, { placeholder: e.target.value })}
                style={{ ...inputStyle, fontSize: 12, marginTop: 8, padding: "6px 10px" }} />
            )}

            {(() => {
              const gate = q.show_if;
              const target = gate && gate.questionId ? questions.find(p => p.id === gate.questionId) : null;
              const isChoice = target && ["select", "radio", "checkbox"].includes(target.type);
              const vals = gate && Array.isArray(gate.values) ? gate.values : [];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.dim, fontFamily: "monospace" }}>
                    ← Show only if answer to…
                    <select value={gate?.questionId || ""} onChange={e => setShowIf(q.id, e.target.value)}
                      style={{ ...selectStyle, fontSize: 12, padding: "6px 8px", width: "auto", flex: 1 }}>
                      <option value="">(always show)</option>
                      {questions.map((p, pi) => pi === qi ? null : (
                        <option key={p.id} value={p.id}>Q{pi + 1}: {String(p.label || "").slice(0, 40) || "(untitled)"}</option>
                      ))}
                    </select>
                  </label>
                  {target && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>{isChoice ? "is one of:" : "matches (comma-separated values):"}</div>
                      {isChoice ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {(target.options || []).filter(o => o.trim()).map((o, oi) => {
                            const ov = o.trim();
                            const on = vals.includes(ov);
                            return (
                              <label key={oi} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: on ? "#22d3ee" : C.muted, fontFamily: "monospace", cursor: "pointer" }}>
                                <input type="checkbox" checked={on} onChange={() => toggleShowIfVal(q.id, ov)} style={{ cursor: "pointer" }} />
                                {o}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <input value={vals.join(", ")} onChange={e => setShowIfRaw(q.id, e.target.value)}
                          placeholder="e.g. yes, maybe (blank = shows only if left empty)"
                          style={{ ...inputStyle, fontSize: 12, padding: "6px 10px" }} />
                      )}
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted, fontFamily: "monospace", cursor: "pointer" }}>
                        <input type="checkbox" checked={!!gate?.not} onChange={() => setShowIfNot(q.id)} style={{ cursor: "pointer" }} />
                        invert — show when answer is NONE of these
                      </label>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                <span style={{ position: "relative", width: 16, height: 16, flexShrink: 0 }}>
                  <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                    style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }} />
                  <span style={{
                    position: "absolute", inset: 0, borderRadius: 3,
                    border: `2px solid ${q.required ? "#ef4444" : "rgba(255,255,255,0.2)"}`,
                    background: q.required ? "rgba(239,68,68,0.15)" : "transparent",
                    transition: "all 0.2s",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {q.required && <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </span>
                </span>
                Required
              </label>
            </div>
          </div>
        ))}
      </div>

      {visibility === "public" && questions.some(q => q.correct !== undefined && (!Array.isArray(q.correct) || q.correct.length > 0)) && (
        <div style={{ color: "#f59e0b", fontSize: 11, fontFamily: "monospace", marginBottom: 12 }}>
          ⚠ Correct answers are stored with the form and viewable in the page source by anyone on a public form.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={handleSave} style={addBtnStyle}>Save</button>
        {visibility === "draft" && (
          <button onClick={handlePublish} style={{ ...addBtnStyle, background: "#22c55e" }}>Save & Publish</button>
        )}
      </div>
    </div>
  );
}

function FormFill({ form, username, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const visibleQ = getVisibleQuestions(form.questions, answers);

  function setAnswer(qid, val) {
    setAnswers({ ...answers, [qid]: val });
    setErrors({ ...errors, [qid]: "" });
  }

  function serializeAnswers() {
    const out = {};
    visibleQ.forEach(q => {
      const val = answers[q.id];
      if (val === undefined) return;
      if (q.type === "radio") out[q.id] = (q.options || [])[Number(val)] ?? "";
      else if (q.type === "checkbox") out[q.id] = (Array.isArray(val) ? val : []).map(i => (q.options || [])[Number(i)] ?? "");
      else out[q.id] = val;
    });
    return out;
  }

  function handleSubmit() {
    const newErrors = {};
    visibleQ.forEach(q => {
      if (q.required) {
        const val = answers[q.id];
        if (!val || (Array.isArray(val) && val.length === 0)) {
          newErrors[q.id] = "Required";
        }
      }
    });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setSubmitting(true);
    onSubmit(serializeAnswers());
  }

  return (
    <div style={{ maxWidth: 650, margin: "0 auto", padding: "24px 20px" }}>
      <button onClick={onCancel} style={{ ...ghostBtn, marginBottom: 16, fontSize: 12 }}>← Back</button>

      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{form.title}</div>
      {form.description && <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace", marginBottom: 20 }}>{form.description}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {visibleQ.map((q, qi) => (
          <div key={q.id} style={{ background: C.surface, border: `1px solid ${errors[q.id] ? C.red : C.border}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{q.label}</span>
              {q.required && <span style={{ color: C.red, fontSize: 12 }}>*</span>}
            </div>

            {q.type === "text" && (
              <input value={answers[q.id] || ""} onChange={e => setAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || ""} style={inputStyle} />
            )}

            {q.type === "textarea" && (
              <textarea value={answers[q.id] || ""} onChange={e => setAnswer(q.id, e.target.value)}
                placeholder={q.placeholder || ""} style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} />
            )}

            {q.type === "select" && (
              <select value={answers[q.id] || ""} onChange={e => setAnswer(q.id, e.target.value)} style={selectStyle}>
                <option value="">-- Select --</option>
                {(q.options || []).filter(o => o.trim()).map((o, oi) => (
                  <option key={oi} value={o}>{o}</option>
                ))}
              </select>
            )}

            {q.type === "radio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(q.options || []).map((o, oi) => ({ o, oi })).filter(x => x.o.trim()).map(({ o, oi }) => {
                  const checked = answers[q.id] === String(oi);
                  return (
                    <label key={oi} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: C.text, userSelect: "none" }}>
                      <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                        <input type="radio" name={`${form.id}_${qi}`} value={String(oi)} checked={checked}
                          onChange={e => setAnswer(q.id, e.target.value)}
                          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }} />
                        <span style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          border: `2px solid ${checked ? "#ef4444" : "rgba(255,255,255,0.2)"}`,
                          background: checked ? "rgba(239,68,68,0.1)" : "transparent",
                          transition: "all 0.2s",
                          boxShadow: checked ? "0 0 10px rgba(239,68,68,0.35)" : "none",
                        }}>
                          {checked && <span style={{ position: "absolute", top: 3, left: 3, width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />}
                        </span>
                      </span>
                      {o}
                    </label>
                  );
                })}
              </div>
            )}

            {q.type === "checkbox" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(q.options || []).map((o, oi) => ({ o, oi })).filter(x => x.o.trim()).map(({ o, oi }) => {
                  const checked = (answers[q.id] || []).includes(String(oi));
                  return (
                    <label key={oi} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: C.text, userSelect: "none" }}>
                      <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                        <input type="checkbox" value={String(oi)} checked={checked}
                          onChange={e => {
                            const arr = (answers[q.id] || []).map(String);
                            setAnswer(q.id, e.target.checked ? [...arr, String(oi)] : arr.filter(x => x !== String(oi)));
                          }}
                          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }} />
                        <span style={{
                          position: "absolute", inset: 0, borderRadius: 4,
                          border: `2px solid ${checked ? "#ef4444" : "rgba(255,255,255,0.2)"}`,
                          background: checked ? "rgba(239,68,68,0.15)" : "transparent",
                          transition: "all 0.2s",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: checked ? "0 0 10px rgba(239,68,68,0.35)" : "none",
                        }}>
                          {checked && <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </span>
                      </span>
                      {o}
                    </label>
                  );
                })}
              </div>
            )}

            {errors[q.id] && <div style={{ color: C.red, fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>{errors[q.id]}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={handleSubmit} disabled={submitting} style={{ ...addBtnStyle, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function FormResponses({ form, submissions, canSync, onReload, onToast }) {
  const questions = form.questions || [];
  const hasSubmissions = submissions.length > 0;
  const [viewType, setViewType] = useState("table");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncErr, setSyncErr] = useState(false);

  async function syncWithSheets() {
    setSyncing(true); setSyncMsg(""); setSyncErr(false);
    try {
      const res = await fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action: "sync", formId: form.id, questions }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.status);
      setSyncMsg(`✓ Sheets synced — ${j.pushed} pushed · ${j.imported} added · ${j.removed} removed · ${j.total} responses.`);
      if (onReload) onReload();
    } catch (e) {
      setSyncErr(true);
      setSyncMsg("Sync failed: " + (e.message || e));
    } finally {
      setSyncing(false);
    }
  }

  function downloadCSV() {
    if (!hasSubmissions) return;
    const header = ["#", ...questions.map(q => q.label), "Submitted By", "Date"];
    const rows = submissions.map((s, si) => {
      return [
        si + 1,
        ...questions.map(q => {
          const ans = s.answers?.[q.id];
          return Array.isArray(ans) ? ans.join(", ") : (ans || "");
        }),
        s.submitted_by || "",
        s.created_at ? new Date(s.created_at).toLocaleDateString() : "",
      ];
    });
    const csvContent = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.title.replace(/[^a-z0-9]/gi, "_")}_responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const answerKey = questions
    .map((q, qi) => {
      if (q.correct === undefined) return null;
      if (q.type === "checkbox") {
        if (!Array.isArray(q.correct) || q.correct.length === 0) return null;
        return `Q${qi + 1}: ${q.correct.map(i => (q.options || [])[i]).filter(Boolean).join(", ")}`;
      }
      const opt = (q.options || [])[q.correct];
      return opt ? `Q${qi + 1}: ${opt}` : null;
    })
    .filter(Boolean);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <style>{`
        .form-response-scroll{scrollbar-width:thin;scrollbar-color:#ef4444 #0d1117;}
        .form-response-scroll::-webkit-scrollbar{height:10px;}
        .form-response-scroll::-webkit-scrollbar-track{background:#0d1117;border-radius:6px;}
        .form-response-scroll::-webkit-scrollbar-thumb{background:#ef4444;border-radius:6px;}
        .form-response-scroll::-webkit-scrollbar-thumb:hover{background:#f87171;}
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <a href="/member-hub/forms" style={{ ...ghostBtn, fontSize: 12 }}>← Back</a>
        <div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text }}>{form.title}</div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>
            {submissions.length} response{submissions.length !== 1 ? "s" : ""}
          </div>
        </div>
        {canSync && (
          <button onClick={syncWithSheets} disabled={syncing} style={{ ...ghostBtn, fontSize: 11, padding: "8px 14px", marginLeft: hasSubmissions && canSync ? 0 : "auto", opacity: syncing ? 0.6 : 1 }}>
            {syncing ? "Syncing…" : "⇅ Sync with Sheets"}
          </button>
        )}
        {hasSubmissions && (
          <button onClick={downloadCSV} style={{ ...ghostBtn, fontSize: 11, padding: "8px 14px", marginLeft: canSync ? 0 : "auto" }}>
            ↓ Download CSV
          </button>
        )}
      </div>

      {syncMsg && (
        <div style={{ background: syncErr ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${syncErr ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 11, fontFamily: "monospace", color: syncErr ? "#f87171" : "#4ade80" }}>
          {syncMsg}
        </div>
      )}

      {answerKey.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 11, fontFamily: "monospace", color: "#22c55e" }}>
          ✓ Answer key — {answerKey.join(" · ")}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", letterSpacing: 1 }}>VIEW AS</span>
        <select value={viewType} onChange={e => setViewType(e.target.value)} style={{ ...selectStyle, width: "auto", fontSize: 12, padding: "6px 10px" }}>
          <option value="table">Table</option>
          <option value="pie">Pie Charts</option>
          <option value="column">Column Charts</option>
        </select>
      </div>

      {!hasSubmissions ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.dim, fontFamily: "monospace", fontSize: 14 }}>
          No responses yet.
        </div>
      ) : viewType === "table" ? (
        <div className="form-response-scroll" style={{ overflowX: "scroll", paddingBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>#</th>
                {questions.map(q => (
                  <th key={q.id} style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, minWidth: 140 }}>{q.label}</th>
                ))}
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>Submitted By</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, whiteSpace: "nowrap" }}>Date</th>
                {canSync && <th style={{ width: 1 }}></th>}
                </tr>
            </thead>
            <tbody>
              {submissions.map((s, si) => (
                <tr key={s.id}>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.dim }}>{si + 1}</td>
                  {questions.map(q => {
                    const ans = s.answers?.[q.id];
                    const display = Array.isArray(ans) ? ans.join(", ") : (ans || "-");
                    return <td key={q.id} style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.text }}>{display}</td>;
                  })}
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.dim }}>{s.submitted_by}</td>
                  <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.dim, whiteSpace: "nowrap" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  {canSync && (
                    <td style={{ padding: "10px 12px", borderBottom: `1px solid ${C.border}`, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Delete response #${si + 1}? This removes it from the viewer.`)) return;
                          try {
                            await hubProxy("hub_form_submissions", "delete", { id: s.id });
                            if (onToast) onToast(`Response #${si + 1} deleted.`);
                            if (onReload) onReload();
                          } catch (e) { if (onToast) onToast("Delete failed: " + (e.message || e)); }
                        }}
                        style={{ ...ghostBtn, fontSize: 11, padding: "4px 9px", color: "#ef4444", borderColor: "rgba(239,68,68,0.35)" }}
                      >
                        ✕ Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        questions.map((q, qi) => {
          const data = tallyQuestion(q, submissions);
          const qlabel = `Q${qi + 1} · ${q.label}`;
          if (["select", "radio", "checkbox"].includes(q.type)) {
            const entries = Object.entries(data.tally).filter(([, c]) => c > 0);
            return viewType === "pie"
              ? <PieCard key={q.id} label={qlabel} entries={entries} total={submissions.length} />
              : <ColumnCard key={q.id} label={qlabel} entries={entries} />;
          }
          return <TextCard key={q.id} label={qlabel} responses={data.responses} />;
        })
      )}
    </div>
  );
}

const CHART_PALETTE = ["#ef4444", "#22d3ee", "#22c55e", "#f59e0b", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6"];

function tallyQuestion(q, submissions) {
  if (["select", "radio", "checkbox"].includes(q.type)) {
    const tally = {};
    (q.options || []).forEach(o => { if (o.trim()) tally[o] = 0; });
    submissions.forEach(s => {
      const a = s.answers?.[q.id];
      if (Array.isArray(a)) a.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
      else if (a) tally[a] = (tally[a] || 0) + 1;
    });
    return { tally };
  }
  const responses = [];
  submissions.forEach(s => {
    const a = s.answers?.[q.id];
    if (a && String(a).trim()) responses.push(String(a));
  });
  return { responses };
}

function ChartCard({ label, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>{label}</div>
      {children}
    </div>
  );
}

function PieCard({ label, entries, total }) {
  let acc = 0;
  const stops = entries.map(([_, count], i) => {
    const start = total ? (acc / total) * 360 : 0;
    acc += count;
    const end = total ? (acc / total) * 360 : 360;
    return `${CHART_PALETTE[i % CHART_PALETTE.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return (
    <ChartCard label={label}>
      <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ width: 140, height: 140, borderRadius: "50%", flexShrink: 0, background: stops.length ? `conic-gradient(${stops.join(", ")})` : C.border }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map(([opt, count], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_PALETTE[i % CHART_PALETTE.length], flexShrink: 0 }} />
              {opt} — {count}{total > 0 ? ` (${Math.round((count / total) * 100)}%)` : ""}
            </div>
          ))}
          {entries.length === 0 && <span style={{ fontSize: 11, color: C.dim }}>No responses</span>}
        </div>
      </div>
    </ChartCard>
  );
}

function ColumnCard({ label, entries }) {
  const max = Math.max(...entries.map(([, c]) => c), 1);
  return (
    <ChartCard label={label}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, minHeight: 170, overflowX: "auto" }}>
        {entries.map(([opt, count], i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60, flex: 1 }}>
            <div style={{ fontSize: 12, color: C.text, fontFamily: "monospace", marginBottom: 4 }}>{count}</div>
            <div style={{ width: 48, height: `${(count / max) * 130}px`, minHeight: count > 0 ? 4 : 0, background: CHART_PALETTE[i % CHART_PALETTE.length], borderRadius: "6px 6px 0 0", opacity: 0.85 }} />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: "center", wordBreak: "break-word", maxWidth: 90 }}>{opt}</div>
          </div>
        ))}
        {entries.length === 0 && <span style={{ fontSize: 11, color: C.dim }}>No responses</span>}
      </div>
    </ChartCard>
  );
}

function TextCard({ label, responses }) {
  return (
    <ChartCard label={`${label} (${responses.length} response${responses.length !== 1 ? "s" : ""})`}>
      {responses.length === 0 ? <span style={{ fontSize: 11, color: C.dim }}>No responses</span> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {responses.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}`, paddingBottom: 7 }}>{r}</div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
