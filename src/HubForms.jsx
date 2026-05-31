import { useState, useEffect } from "react";
import { FONTS, C, sbFetch, isAuthed, canEditHub, getUsername, HubHeader, toastStyle, inputStyle, selectStyle, addBtnStyle, ghostBtn, hubProxy } from "./hubUtils.jsx";

let qid = 1;
function nextQid() { return "q_" + (qid++); }

export default function HubForms() {
  const [authed] = useState(isAuthed());
  const [canEdit] = useState(canEditHub());
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [view, setView] = useState("list");
  const [editForm, setEditForm] = useState(null);
  const [fillForm, setFillForm] = useState(null);
  const [responsesForm, setResponsesForm] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Forms · Team 4550";
    loadData();
  }, []);

  async function loadData() {
    const f = await sbFetch("hub_forms?select=*&order=created_at.desc");
    if (f) setForms(f);
    const s = await sbFetch("hub_form_submissions?select=*&order=created_at.desc");
    if (s) setSubmissions(s);
  }

  const username = getUsername();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Exo 2', sans-serif" }}>
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="📋 Forms" />

      {view === "list" && (
        <ListForms
          forms={forms} submissions={submissions} canEdit={canEdit} username={username}
          onFill={f => { setFillForm(f); setView("fill"); }}
          onEdit={f => { setEditForm({ ...f, questions: f.questions || [] }); setView("edit"); }}
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
                await hubProxy("hub_forms", "update", { id: f.id, updates: { title: f.title, description: f.description, questions: f.questions } });
                showToast("Form updated.");
              } else {
                await hubProxy("hub_forms", "insert", { title: f.title, description: f.description, questions: f.questions, created_by: username });
                showToast("Form created.");
              }
              loadData();
              setView("list");
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
              await hubProxy("hub_form_submissions", "insert", { form_id: fillForm.id, submitted_by: username, answers });
              showToast("Response submitted.");
              loadData();
              setView("list");
            } catch (e) { showToast("Submit failed: " + (e.message || e)); }
          }}
          onCancel={() => setView("list")}
        />
      )}

      {view === "responses" && responsesForm && (
        <FormResponses
          form={responsesForm} submissions={submissions.filter(s => s.form_id === responsesForm.id)}
          onBack={() => setView("list")}
        />
      )}
    </div>
  );
}

function qTypes() { return ["text", "textarea", "select", "radio", "checkbox"]; }
function qTypeLabel(t) {
  return { text: "Short Text", textarea: "Paragraph", select: "Dropdown", radio: "Multiple Choice", checkbox: "Checkboxes" }[t] || t;
}

function ListForms({ forms, submissions, canEdit, username, onFill, onEdit, onDelete, onResponses, onNew }) {
  const userSubmitted = formId => submissions.some(s => s.form_id === formId && s.submitted_by === username);
  const submissionCount = formId => submissions.filter(s => s.form_id === formId).length;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onNew} style={addBtnStyle}>+ Create Form</button>
      </div>

      {forms.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: C.dim, fontFamily: "monospace", fontSize: 14 }}>
          No forms yet. Create one above!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {forms.map(f => {
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
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>
                  {(f.questions || []).length} question{(f.questions || []).length !== 1 ? "s" : ""}
                  {f.created_by && ` · by ${f.created_by}`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormBuilder({ form: initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial.title || "");
  const [desc, setDesc] = useState(initial.description || "");
  const [questions, setQuestions] = useState(initial.questions || []);
  const [errors, setErrors] = useState("");

  function addQuestion() {
    setQuestions([...questions, { id: nextQid(), type: "text", label: "", required: false, placeholder: "", options: [""] }]);
  }

  function updateQuestion(id, patch) {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function removeQuestion(id) {
    setQuestions(questions.filter(q => q.id !== id));
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

  function handleSave() {
    if (!title.trim()) { setErrors("Title required."); return; }
    const valid = questions.filter(q => q.label.trim());
    if (valid.length === 0) { setErrors("Add at least one question."); return; }
    const cleaned = valid.map(q => ({
      ...q,
      label: q.label.trim(),
      placeholder: q.placeholder || "",
      options: ["select", "radio", "checkbox"].includes(q.type) ? (q.options || []).filter(o => o.trim()) : undefined,
    }));
    onSave({ ...initial, title: title.trim(), description: desc.trim(), questions: cleaned });
  }

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
        style={{ ...inputStyle, minHeight: 50, resize: "vertical", marginBottom: 20 }} />

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
          <div key={q.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: "monospace" }}>Q{qi + 1}</span>
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
                <div style={{ fontSize: 10, color: C.dim, fontFamily: "monospace", marginBottom: 6 }}>Options</div>
                {(q.options || []).map((o, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: C.dim }}>{oi + 1}.</span>
                    <input value={o} onChange={e => updateOption(q.id, oi, e.target.value)}
                      placeholder={`Option ${oi + 1}`}
                      style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "6px 10px" }} />
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

            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
                <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                  style={{ accentColor: C.red }} />
                Required
              </label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button onClick={handleSave} style={addBtnStyle}>Save Form</button>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
      </div>
    </div>
  );
}

function FormFill({ form, username, onSubmit, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function setAnswer(qid, val) {
    setAnswers({ ...answers, [qid]: val });
    setErrors({ ...errors, [qid]: "" });
  }

  function handleSubmit() {
    const newErrors = {};
    (form.questions || []).forEach(q => {
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
    onSubmit(answers);
  }

  return (
    <div style={{ maxWidth: 650, margin: "0 auto", padding: "24px 20px" }}>
      <button onClick={onCancel} style={{ ...ghostBtn, marginBottom: 16, fontSize: 12 }}>← Back</button>

      <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{form.title}</div>
      {form.description && <div style={{ fontSize: 13, color: C.muted, fontFamily: "monospace", marginBottom: 20 }}>{form.description}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {(form.questions || []).map((q, qi) => (
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
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(q.options || []).filter(o => o.trim()).map((o, oi) => (
                  <label key={oi} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.text }}>
                    <input type="radio" name={q.id} value={o} checked={answers[q.id] === o}
                      onChange={e => setAnswer(q.id, e.target.value)} style={{ accentColor: C.red }} />
                    {o}
                  </label>
                ))}
              </div>
            )}

            {q.type === "checkbox" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(q.options || []).filter(o => o.trim()).map((o, oi) => {
                  const checked = (answers[q.id] || []).includes(o);
                  return (
                    <label key={oi} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: C.text }}>
                      <input type="checkbox" value={o} checked={checked}
                        onChange={e => {
                          const arr = answers[q.id] || [];
                          setAnswer(q.id, e.target.checked ? [...arr, o] : arr.filter(x => x !== o));
                        }} style={{ accentColor: C.red }} />
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

function FormResponses({ form, submissions }) {
  const questions = form.questions || [];
  const hasSubmissions = submissions.length > 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <a href="/member-hub/forms" style={{ ...ghostBtn, fontSize: 12 }}>← Back</a>
        <div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: C.text }}>{form.title}</div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "monospace", marginTop: 2 }}>
            {submissions.length} response{submissions.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {!hasSubmissions ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: C.dim, fontFamily: "monospace", fontSize: 14 }}>
          No responses yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>#</th>
                {questions.map(q => (
                  <th key={q.id} style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, minWidth: 140 }}>{q.label}</th>
                ))}
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>Submitted By</th>
                <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, color: C.muted, whiteSpace: "nowrap" }}>Date</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
