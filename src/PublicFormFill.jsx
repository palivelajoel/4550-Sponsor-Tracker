import { useState, useEffect } from "react";
import { FONTS, C, sbFetch, toastStyle, inputStyle, selectStyle, addBtnStyle, ghostBtn } from "./hubUtils.jsx";

export default function PublicFormFill() {
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    document.title = "Form · Team 4550";
    const formId = window.location.pathname.startsWith("/forms/")
      ? window.location.pathname.split("/")[2]
      : new URLSearchParams(window.location.search).get("id");
    if (!formId) { setLoading(false); return; }
    (async () => {
      const data = await sbFetch(`hub_forms?id=eq.${formId}&select=*`);
      if (data && data.length > 0 && data[0].visibility === "public") {
        setForm(data[0]);
      }
      setLoading(false);
    })();
  }, []);

  function setAnswer(qid, val) {
    setAnswers({ ...answers, [qid]: val });
    setErrors({ ...errors, [qid]: "" });
  }

  function serializeAnswers() {
    const out = {};
    (form.questions || []).forEach(q => {
      const val = answers[q.id];
      if (val === undefined) return;
      if (q.type === "radio") out[q.id] = (q.options || [])[Number(val)] ?? "";
      else if (q.type === "checkbox") out[q.id] = (Array.isArray(val) ? val : []).map(i => (q.options || [])[Number(i)] ?? "");
      else out[q.id] = val;
    });
    return out;
  }

  async function handleSubmit(e) {
    e.preventDefault();
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
    const payload = serializeAnswers();
    try {
      const res = await fetch("/api/public-form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: form.id, answers: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setSubmitted(true);
      fetch("/api/sheets-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formTitle: form.title,
          questions: form.questions || [],
          answers: payload,
          submittedBy: "public",
          timestamp: new Date().toISOString(),
        }),
      }).then(async r => {
        if (!r.ok) { const j = await r.json().catch(() => null); showToast("Sheet sync failed: " + (j?.error || r.status)); }
      }).catch(e => showToast("Sheet sync failed: " + (e.message || e)));
    } catch (err) {
      showToast("Submit failed: " + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Exo 2', sans-serif" }}>
        <style>{FONTS}</style>
        <div style={{ color: "#64748b", fontFamily: "monospace", fontSize: 14 }}>Loading form...</div>
      </div>
    );
  }

  if (!form) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Exo 2', sans-serif" }}>
        <style>{FONTS}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#e2e8f0" }}>Form Not Found</div>
          <div style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>This form doesn't exist or isn't public.</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Exo 2', sans-serif" }}>
        <style>{FONTS}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#22c55e" }}>Submitted!</div>
          <div style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace" }}>Thank you for your response.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#e2e8f0", fontFamily: "'Exo 2', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-40%", left: "-20%", width: "140%", height: "140%", background: "radial-gradient(ellipse at 30% 20%, rgba(34,211,238,0.05) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(99,102,241,0.05) 0%, transparent 50%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 650, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{form.title}</div>
        {form.description && <div style={{ fontSize: 13, color: "#64748b", fontFamily: "monospace", marginBottom: 24 }}>{form.description}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {(form.questions || []).map((q, qi) => (
              <div key={q.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${errors[q.id] ? "#ef4444" : "rgba(255,255,255,0.08)"}`, borderRadius: 10, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{q.label}</span>
                  {q.required && <span style={{ color: "#ef4444", fontSize: 12 }}>*</span>}
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
                        <label key={oi} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#e2e8f0", userSelect: "none" }}>
                          <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                            <input type="radio" name={`${form.id}_${qi}`} value={String(oi)} checked={checked}
                              onChange={e => setAnswer(q.id, e.target.value)}
                              style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }} />
                            <span style={{
                              position: "absolute", inset: 0, borderRadius: "50%",
                              border: `2px solid ${checked ? "#22d3ee" : "rgba(255,255,255,0.2)"}`,
                              background: checked ? "rgba(34,211,238,0.1)" : "transparent",
                              transition: "all 0.2s",
                              boxShadow: checked ? "0 0 10px rgba(34,211,238,0.35)" : "none",
                            }}>
                              {checked && <span style={{ position: "absolute", top: 3, left: 3, width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />}
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
                        <label key={oi} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#e2e8f0", userSelect: "none" }}>
                          <span style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                            <input type="checkbox" value={String(oi)} checked={checked}
                              onChange={e => {
                                const arr = (answers[q.id] || []).map(String);
                                setAnswer(q.id, e.target.checked ? [...arr, String(oi)] : arr.filter(x => x !== String(oi)));
                              }}
                              style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", margin: 0 }} />
                            <span style={{
                              position: "absolute", inset: 0, borderRadius: 4,
                              border: `2px solid ${checked ? "#22d3ee" : "rgba(255,255,255,0.2)"}`,
                              background: checked ? "rgba(34,211,238,0.15)" : "transparent",
                              transition: "all 0.2s",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: checked ? "0 0 10px rgba(34,211,238,0.35)" : "none",
                            }}>
                              {checked && <span style={{ color: "#22d3ee", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                            </span>
                          </span>
                          {o}
                        </label>
                      );
                    })}
                  </div>
                )}

                {errors[q.id] && <div style={{ color: "#ef4444", fontSize: 10, fontFamily: "monospace", marginTop: 4 }}>{errors[q.id]}</div>}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <button type="submit" disabled={submitting} style={{ ...addBtnStyle, width: "100%", padding: "14px 24px", fontSize: 14, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
