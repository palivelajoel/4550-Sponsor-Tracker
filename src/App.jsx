import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import Starfield from './Starfield.jsx'
import { uploadFile, FONTS } from './hubUtils.jsx'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const STATUS_COLORS = {
  'Not Contacted': '#64748b',
  'Contacted': '#3b82f6',
  'In Progress': '#f59e0b',
  'Sponsored': '#22c55e',
  'Declined': '#ef4444',
}
const STATUS_OPTIONS = Object.keys(STATUS_COLORS)

const TIERS = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum']
const TIER_COLORS = { None: '#64748b', Bronze: '#b45309', Silver: '#94a3b8', Gold: '#eab308', Platinum: '#818cf8' }

const EMAIL_TEMPLATES = [
  {
    label: 'Initial Outreach',
    subject: 'FRC Team 4550 Sponsorship Opportunity',
    body: `Dear [Company Name] Team,\n\nMy name is [Your Name], and I'm a member of FRC Robotics Team 4550 "Something's Bruin" from Cherry Creek High School. We are reaching out to local businesses and organizations to seek sponsorship support for our upcoming robotics season.\n\nAs a sponsor, your company would receive recognition on our robot, team shirts, and website, as well as the opportunity to connect with motivated STEM students.\n\nWould you be open to a brief conversation about how we might partner together?\n\nThank you for your time and consideration.\n\nBest regards,\n[Your Name]\nFRC Team 4550`
  },
  {
    label: 'Follow-Up',
    subject: 'Following Up — FRC Team 4550 Sponsorship',
    body: `Dear [Company Name] Team,\n\nI wanted to follow up on my previous message regarding a sponsorship opportunity with FRC Robotics Team 4550 "Something's Bruin."\n\nWe are still looking for sponsors for our upcoming season and would love to have [Company Name] as a partner. Please let me know if you have any questions or would like more information.\n\nThank you again for your consideration!\n\nBest regards,\n[Your Name]\nFRC Team 4550`
  },
  {
    label: 'Thank You',
    subject: 'Thank You from FRC Team 4550!',
    body: `Dear [Company Name] Team,\n\nThank you so much for your generous sponsorship of FRC Robotics Team 4550 "Something's Bruin!" Your support means the world to our team and helps us continue to inspire the next generation of engineers and innovators.\n\nWe look forward to representing your company proudly throughout the season.\n\nWith gratitude,\n[Your Name]\nFRC Team 4550`
  },
]

const styles = {
  app: { minHeight: '100vh', background: '#080a0f', fontFamily: "'Exo 2', sans-serif", color: '#f1f5f9', padding: '0' },
  header: { background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '28px', fontFamily: "'Orbitron', sans-serif", letterSpacing: '3px', color: '#ef4444', margin: 0 },

  main: { padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' },
  statsRow: { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  statCard: { flex: '1', minWidth: '100px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center' },
  statNum: { fontSize: '28px', fontFamily: "'Orbitron', sans-serif", letterSpacing: '2px' },
  statLabel: { fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', marginTop: '2px' },
  controls: { display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' },
  input: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '13px', fontFamily: "'Share Tech Mono', monospace", outline: 'none', flex: '1', minWidth: '180px' },
  select: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '13px', fontFamily: "'Share Tech Mono', monospace", outline: 'none', cursor: 'pointer' },
  btn: { background: '#ef4444', border: 'none', borderRadius: '8px', padding: '10px 16px', color: '#fff', fontSize: '12px', fontFamily: "'Orbitron', sans-serif", cursor: 'pointer', letterSpacing: '1px', fontWeight: '700', whiteSpace: 'nowrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px', transition: 'all 0.3s ease', wordBreak: 'break-word', overflowWrap: 'anywhere' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px' },
  company: { fontSize: '18px', fontFamily: "'Orbitron', sans-serif", letterSpacing: '2px', color: '#f1f5f9', wordBreak: 'break-word', overflowWrap: 'anywhere', minWidth: 0 },
  statusBadge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap', borderRadius: '20px', padding: '4px 12px', fontSize: '10px', letterSpacing: '1px', fontWeight: '600', border: '1px solid' },
  fieldRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', color: '#94a3b8', minWidth: 0, flexWrap: 'wrap' },
  copyBtn: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '2px 8px', color: '#ef4444', fontSize: '10px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" },
  cardActions: { display: 'flex', gap: '8px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' },
  editBtn: { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '6px 12px', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", flex: 1 },
  deleteBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '6px 12px', color: '#f87171', fontSize: '11px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace" },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalBox: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontFamily: "'Orbitron', sans-serif", fontSize: '22px', letterSpacing: '2px', color: '#ef4444', marginBottom: '20px' },
  field: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '10px', color: '#94a3b8', letterSpacing: '1px', marginBottom: '6px' },
  modalInput: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '13px', fontFamily: "'Share Tech Mono', monospace", outline: 'none', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' },
  toast: { position: 'fixed', bottom: '24px', right: '24px', background: '#ef4444', border: 'none', borderRadius: '10px', padding: '12px 20px', color: '#fff', fontSize: '13px', zIndex: 2000, animation: 'fadeIn 0.3s ease' },
  lookupBtn: { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '8px 14px', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontFamily: "'Share Tech Mono', monospace", whiteSpace: 'nowrap' },
  lookupRow: { display: 'flex', gap: '8px', alignItems: 'flex-end' },
}

function Toast({ message }) { return <div style={styles.toast}>{message}</div> }

function SuggestionsBox({ showToast }) {
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const submit = async () => {
    if (!msg.trim()) return
    setSending(true)
    await supabase.from('suggestions').insert([{ message: msg.trim() }])
    setMsg('')
    setSending(false)
    showToast('💡 Suggestion submitted!')
  }
  return (
    <div style={{ marginTop: '48px', padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }}>
      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '16px', letterSpacing: '2px', color: '#ef4444', marginBottom: '8px' }}>💡 SUGGESTIONS</div>
      <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 12px', letterSpacing: '0.5px' }}>Have an idea or found a bug? Leave a suggestion and the team will review it.</p>
      <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type your suggestion here..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', color: '#e2e8f0', fontSize: '12px', fontFamily: "'Share Tech Mono', monospace", outline: 'none', resize: 'vertical', height: '80px', boxSizing: 'border-box' }} />
      <button onClick={submit} disabled={sending || !msg.trim()} style={{ marginTop: '8px', background: '#ef4444', border: 'none', borderRadius: '8px', padding: '8px 20px', color: '#fff', fontSize: '12px', fontFamily: "'Orbitron', sans-serif", cursor: 'pointer', letterSpacing: '1px', fontWeight: 700 }}>
        {sending ? 'SENDING...' : 'SUBMIT'}
      </button>
    </div>
  )
}

function EmailTemplatesModal({ sponsor, onClose }) {
  const [selected, setSelected] = useState(0)
  const [body, setBody] = useState(EMAIL_TEMPLATES[0].body)
  const [subject, setSubject] = useState(EMAIL_TEMPLATES[0].subject)

  const selectTemplate = (i) => {
    setSelected(i)
    setBody(EMAIL_TEMPLATES[i].body)
    setSubject(EMAIL_TEMPLATES[i].subject)
  }

  const filled_body = body.replace('[Company Name]', sponsor?.company || '')
  const filled_subject = subject.replace('[Company Name]', sponsor?.company || '')

  const copyBody = () => { navigator.clipboard.writeText(filled_body) }
  const openEmail = () => { window.open(`mailto:${sponsor?.email || ''}?subject=${encodeURIComponent(filled_subject)}&body=${encodeURIComponent(filled_body)}`, '_blank') }

  return (
    <div style={styles.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modalBox, maxWidth: '600px' }}>
        <div style={styles.modalTitle}>📧 EMAIL TEMPLATES — {sponsor?.company}</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {EMAIL_TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => selectTemplate(i)} style={{ ...styles.btn, background: selected === i ? '#ef4444' : 'transparent', border: selected === i ? 'none' : '1px solid rgba(239,68,68,0.3)', color: selected === i ? '#fff' : '#ef4444' }}>{t.label}</button>
          ))}
        </div>
        <div style={styles.field}>
          <label style={styles.label}>SUBJECT</label>
          <input style={styles.modalInput} value={filled_subject} onChange={e => setSubject(e.target.value.replace(sponsor?.company || '', '[Company Name]'))} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>BODY</label>
          <textarea style={{ ...styles.modalInput, height: '220px', resize: 'vertical' }} value={filled_body} onChange={e => setBody(e.target.value.replace(sponsor?.company || '', '[Company Name]'))} />
        </div>
        <div style={styles.modalActions}>
          <button style={styles.btn} onClick={openEmail}>📨 OPEN IN EMAIL APP</button>
          <button style={styles.btn} onClick={copyBody}>📋 COPY BODY</button>
          <button style={{ ...styles.editBtn, flex: 'none' }} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}

function NotesModal({ sponsor, onClose }) {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('sponsor_notes').select('*').eq('sponsor_id', sponsor.id).order('created_at', { ascending: false })
      if (data) setNotes(data)
      setLoading(false)
    }
    fetch()
  }, [sponsor.id])

  const addNote = async () => {
    if (!newNote.trim()) return
    const { data } = await supabase.from('sponsor_notes').insert([{ sponsor_id: sponsor.id, note: newNote.trim() }]).select()
    if (data) setNotes(n => [data[0], ...n])
    setNewNote('')
  }

  const deleteNote = async (id) => {
    await supabase.from('sponsor_notes').delete().eq('id', id)
    setNotes(n => n.filter(x => x.id !== id))
  }

  return (
    <div style={styles.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modalBox, maxWidth: '560px' }}>
        <div style={styles.modalTitle}>📝 NOTES — {sponsor.company}</div>
        <div style={styles.field}>
          <label style={styles.label}>ADD INTERACTION NOTE</label>
          <textarea style={{ ...styles.modalInput, height: '80px', resize: 'vertical' }} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="e.g. Called and spoke with manager, follow up next week..." />
          <button style={{ ...styles.editBtn, marginTop: '8px', background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }} onClick={addNote}>+ ADD NOTE</button>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
          {loading ? <div style={{ color: '#475569', fontSize: '12px' }}>Loading...</div> :
            notes.length === 0 ? <div style={{ color: '#475569', fontSize: '12px' }}>No notes yet.</div> :
            notes.map(n => (
              <div key={n.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', lineHeight: '1.5', marginBottom: '4px' }}>{n.note}</div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => deleteNote(n.id)} style={{ ...styles.deleteBtn, padding: '4px 10px', fontSize: '10px' }}>DEL</button>
              </div>
            ))
          }
        </div>
        <div style={styles.modalActions}>
          <button style={{ ...styles.editBtn }} onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  )
}

function Modal({ sponsor, onClose, onSave }) {
  const [form, setForm] = useState(sponsor || { company: '', email: '', phone: '', notes: '', logo_url: '', status: 'Not Contacted', tier: 'None', follow_up_date: '' })
  const [looking, setLooking] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoFileRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const uploadLogo = async (file) => {
    if (!file) return
    setLogoUploading(true)
    const url = await uploadFile(file, 'team-assets')
    if (url) { set('logo_url', url) }
    setLogoUploading(false)
  }

  const lookup = async () => {
    if (!form.company.trim()) return
    setLooking(true)
    try {
      const res = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: form.company }) })
      const parsed = await res.json()
      setForm(f => ({ ...f, email: parsed.email || f.email, phone: parsed.phone || f.phone, notes: parsed.notes || f.notes }))
    } catch (e) { console.error(e) }
    setLooking(false)
  }

  return (
    <div style={styles.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modalBox}>
        <div style={styles.modalTitle}>{sponsor ? 'EDIT SPONSOR' : 'ADD SPONSOR'}</div>
        <div style={styles.field}>
          <label style={styles.label}>COMPANY</label>
          <div style={styles.lookupRow}>
            <input style={{ ...styles.modalInput, flex: 1 }} value={form.company || ''} onChange={e => set('company', e.target.value)} placeholder="Company name" />
            <button style={styles.lookupBtn} onClick={lookup} disabled={looking}>{looking ? '⏳ LOOKING...' : '🔍 LOOKUP'}</button>
          </div>
          {looking && <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '6px' }}>Searching for contact info...</div>}
        </div>
        {['email', 'phone', 'notes'].map(k => (
          <div key={k} style={styles.field}>
            <label style={styles.label}>{k.toUpperCase()}</label>
            <input style={styles.modalInput} value={form[k] || ''} onChange={e => set(k, e.target.value)} placeholder={k === 'email' ? 'contact@company.com' : k === 'phone' ? '(555) 000-0000' : ''} />
          </div>
        ))}
        <div style={styles.field}>
          <label style={styles.label}>LOGO URL</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...styles.modalInput, flex: 1 }} value={form.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
            <button type="button" onClick={() => logoFileRef.current?.click()} style={{ ...styles.lookupBtn, fontSize: 16 }}>{logoUploading ? '⏳' : '📸'}</button>
            <input ref={logoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) uploadLogo(e.target.files[0]) }} />
          </div>
          {form.logo_url && (
            <img src={form.logo_url} alt="logo preview" style={{ height: 40, marginTop: 8, borderRadius: 6, objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }} onError={e => { e.target.style.display = 'none' }} />
          )}
        </div>
        <div style={styles.field}>
          <label style={styles.label}>STATUS</label>
          <select style={{ ...styles.modalInput, cursor: 'pointer' }} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>SPONSOR TIER</label>
          <select style={{ ...styles.modalInput, cursor: 'pointer' }} value={form.tier || 'None'} onChange={e => set('tier', e.target.value)}>
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>FOLLOW-UP DATE</label>
          <input type="date" style={{ ...styles.modalInput, colorScheme: 'dark' }} value={form.follow_up_date || ''} onChange={e => set('follow_up_date', e.target.value)} />
        </div>
        <div style={styles.modalActions}>
          <button style={styles.btn} onClick={() => onSave(form)}>SAVE</button>
          <button style={{ ...styles.editBtn, flex: 'none' }} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

function ImportModal({ onClose, onImport, existingSponsors }) {
  const [csv, setCsv] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [imageNames, setImageNames] = useState([])

  const parseCSVLine = (line) => {
    const result = []
    let cur = '', inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  const parse = (text) => {
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) return []
    return lines.slice(1).map(line => {
      const vals = parseCSVLine(line)
      const company = (vals[0] || '').replace(/['"]/g, '').trim()
      return { company, email: '', phone: '', notes: '', status: 'Not Contacted', tier: 'None' }
    }).filter(r => r.company && r.company.length > 0)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCsv(ev.target.result)
    reader.readAsText(file)
  }

  const handleImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setExtracting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      try {
        const res = await fetch('/api/extract-brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: file.type }) })
        const data = await res.json()
        setImageNames(data.brands || [])
      } catch (e) { console.error(e) }
      setExtracting(false)
    }
    reader.readAsDataURL(file)
  }

  const csvRows = parse(csv)
  const imageRows = imageNames.map(name => ({ company: name, email: '', phone: '', notes: '', status: 'Not Contacted', tier: 'None' }))
  const allRows = [...csvRows, ...imageRows.filter(r => !csvRows.find(c => c.company === r.company))]
  const existingNames = (existingSponsors || []).map(s => s.company?.toLowerCase())
  const newRows = allRows.filter(r => !existingNames.includes(r.company?.toLowerCase()))
  const dupeRows = allRows.filter(r => existingNames.includes(r.company?.toLowerCase()))

  return (
    <div style={styles.modal} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modalBox, maxWidth: '560px' }}>
        <div style={styles.modalTitle}>📥 IMPORT SPONSORS</div>
        <div style={styles.field}>
          <label style={styles.label}>📄 UPLOAD CSV FILE</label>
          <input type="file" accept=".csv" onChange={handleFile} style={{ ...styles.modalInput, padding: '8px', cursor: 'pointer' }} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>OR PASTE CSV TEXT</label>
          <textarea style={{ ...styles.modalInput, height: '90px', resize: 'vertical' }} value={csv} onChange={e => setCsv(e.target.value)} placeholder={'company,email,phone\nMicro Center,donations@microcenter.com,800-634-3478'} />
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '16px 0' }} />
        <div style={styles.field}>
          <label style={styles.label}>📸 SCAN IMAGE FOR BRANDS</label>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px' }}>Upload a photo of a sponsor list, flyer, or signage — AI will extract brand names automatically.</p>
          <input type="file" accept="image/*" onChange={handleImage} style={{ ...styles.modalInput, padding: '8px', cursor: 'pointer' }} />
          {extracting && <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '6px' }}>🔍 Scanning image for brands...</div>}
          {imageNames.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={styles.label}>{imageNames.length} BRANDS DETECTED FROM IMAGE</div>
              {imageNames.map((n, i) => <div key={i} style={{ fontSize: '11px', color: '#e2e8f0', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{n}</div>)}
            </div>
          )}
        </div>
        {allRows.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={styles.label}>PREVIEW ({newRows.length} new, {dupeRows.length} duplicates)</div>
            {newRows.slice(0, 4).map((r, i) => <div key={i} style={{ fontSize: '11px', color: '#e2e8f0', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.company}</div>)}
            {newRows.length > 4 && <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>...and {newRows.length - 4} more</div>}
            {dupeRows.length > 0 && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '8px', padding: '6px 10px', background: 'rgba(245,158,11,0.1)', borderRadius: '6px' }}>⚠️ Skipping {dupeRows.length} already in list: {dupeRows.slice(0,3).map(r => r.company).join(', ')}{dupeRows.length > 3 ? '...' : ''}</div>}
          </div>
        )}
        <div style={styles.modalActions}>
          <button style={styles.btn} onClick={() => onImport(newRows)} disabled={!newRows.length}>IMPORT {newRows.length > 0 ? `${newRows.length} SPONSORS` : ''}</button>
          <button style={{ ...styles.editBtn, flex: 'none' }} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem('sb_authed') === 'true')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [sponsors, setSponsors] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterTier, setFilterTier] = useState('All')
  const [sortBy, setSortBy] = useState('date')
  const [modal, setModal] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [emailModal, setEmailModal] = useState(null)
  const [notesModal, setNotesModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupProgress, setLookupProgress] = useState({ current: 0, total: 0 })
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const fetchSponsors = useCallback(async () => {
    const { data } = await supabase.from('sponsors').select('*').order('date_added', { ascending: false })
    if (data) setSponsors(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchSponsors()
    const channel = supabase.channel('sponsors-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => { fetchSponsors(); showToast('🔄 List updated by a teammate') })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [fetchSponsors, authed])

  const handleLogin = () => {
    // Team password is read from Vite env var VITE_TEAM_PASSWORD
    const teamPw = import.meta.env.VITE_TEAM_PASSWORD
    if (pwInput === teamPw) { localStorage.setItem('sb_authed', 'true'); setAuthed(true); setPwError(false) }
    else setPwError(true)
  }

  const save = async (form) => {
    if (!form.company.trim()) return
    if (modal.id) {
      await supabase.from('sponsors').update({ ...form, updated_at: new Date().toISOString() }).eq('id', modal.id)
    } else {
      await supabase.from('sponsors').insert([{ ...form, date_added: new Date().toISOString(), updated_at: new Date().toISOString() }])
    }
    setModal(null); fetchSponsors()
    showToast(modal.id ? '✅ Sponsor updated' : '✅ Sponsor added')
  }

  const handleImport = async (rows) => {
    const now = new Date().toISOString()
    const records = rows.map(r => ({ ...r, date_added: now, updated_at: now }))
    for (let i = 0; i < records.length; i += 50) await supabase.from('sponsors').insert(records.slice(i, i + 50))
    setShowImport(false); fetchSponsors()
    showToast(`✅ Imported ${rows.length} sponsors!`)
  }

  const remove = async (id) => {
    if (!confirm('Delete this sponsor?')) return
    await supabase.from('sponsors').delete().eq('id', id)
    fetchSponsors(); showToast('🗑️ Sponsor deleted')
  }

  const updateStatus = async (id, status) => {
    await supabase.from('sponsors').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetchSponsors()
  }

  const copy = (text) => { navigator.clipboard.writeText(text); showToast('📋 Copied!') }

  const exportCSV = () => {
    const headers = ['company', 'email', 'phone', 'notes', 'status', 'tier', 'follow_up_date', 'date_added']
    const rows = sponsors.map(s => headers.map(h => `"${(s[h] || '').toString().replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'frc4550-sponsors.csv'; a.click()
    URL.revokeObjectURL(url); showToast('📤 Exported to CSV!')
  }

  const lookupAll = async () => {
    const missing = sponsors.filter(s => !s.email && !s.phone)
    if (!missing.length) { showToast('✅ All sponsors already have contact info!'); return }
    if (!confirm(`Look up contact info for ${missing.length} sponsors? This may take a few minutes.`)) return
    setLookingUp(true); setLookupProgress({ current: 0, total: missing.length })
    for (let i = 0; i < missing.length; i++) {
      const s = missing[i]; setLookupProgress({ current: i + 1, total: missing.length })
      try {
        const res = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company: s.company }) })
        const parsed = await res.json()
        if (parsed.email || parsed.phone) await supabase.from('sponsors').update({ email: parsed.email || s.email, phone: parsed.phone || s.phone, notes: parsed.notes || s.notes, updated_at: new Date().toISOString() }).eq('id', s.id)
      } catch (e) { console.error(e) }
      await new Promise(r => setTimeout(r, 800))
    }
    setLookingUp(false); fetchSponsors(); showToast(`✅ Lookup complete for ${missing.length} sponsors!`)
  }

  const today = new Date().toISOString().split('T')[0]
  const followUpDue = sponsors.filter(s => s.follow_up_date && s.follow_up_date <= today && s.status !== 'Sponsored' && s.status !== 'Declined')

  const filtered = sponsors.filter(s => {
    const q = search.toLowerCase()
    return (!q || s.company?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)) &&
      (filterStatus === 'All' || s.status === filterStatus) &&
      (filterTier === 'All' || s.tier === filterTier)
  }).sort((a, b) => {
    if (sortBy === 'alpha') return (a.company || '').localeCompare(b.company || '')
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '')
    if (sortBy === 'tier') return TIERS.indexOf(b.tier || 'None') - TIERS.indexOf(a.tier || 'None')
    if (sortBy === 'followup') return (a.follow_up_date || '9999') > (b.follow_up_date || '9999') ? 1 : -1
    return new Date(b.date_added || 0) - new Date(a.date_added || 0)
  })

  const counts = STATUS_OPTIONS.reduce((acc, s) => { acc[s] = sponsors.filter(x => x.status === s).length; return acc }, {})

  useEffect(() => { document.title = '4550 Something\'s Bruin | Sponsor Tracker' }, [])

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#080a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Exo 2', sans-serif" }}>
      <style>{FONTS}</style>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '48px 40px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <img src='/logo.jpg' alt='Team 4550' style={{ height: '80px', width: '80px', objectFit: 'contain', borderRadius: '12px', marginBottom: '20px' }} />
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '24px', letterSpacing: '3px', color: '#ef4444', marginBottom: '6px' }}>SOMETHING'S BRUIN</div>
        <div style={{ fontSize: '11px', color: '#475569', letterSpacing: '2px', marginBottom: '32px' }}>SPONSOR TRACKER · TEAM 4550</div>
        <input type='password' placeholder='Enter team password' value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(false) }} onKeyDown={e => e.key === 'Enter' && handleLogin()} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: pwError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '12px 16px', color: '#e2e8f0', fontSize: '13px', fontFamily: "'Share Tech Mono', monospace", outline: 'none', boxSizing: 'border-box', marginBottom: '8px' }} />
        {pwError && <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '12px' }}>Incorrect password</div>}
        <button onClick={handleLogin} style={{ width: '100%', background: '#ef4444', border: 'none', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '13px', fontFamily: "'Orbitron', sans-serif", cursor: 'pointer', letterSpacing: '1px', fontWeight: 700, marginTop: '4px' }}>ENTER</button>
      </div>
    </div>
  )

  return (
    <div style={{ ...styles.app, position: 'relative' }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <Starfield density={12000} opacity={0.28} />
        {[{ s:500, t:"-20%", l:"-15%", c:"rgba(239,68,68,0.07)", d:"0s" }, { s:350, b:"-10%", r:"-10%", c:"rgba(59,130,246,0.05)", d:"1.5s" }, { s:250, t:"45%", r:"15%", c:"rgba(168,85,247,0.04)", d:"0.8s" }].map((o,i) => (
          <div key={i} style={{ position:"absolute", width:o.s, height:o.s, top:o.t, bottom:o.b, left:o.l, right:o.r, borderRadius:"50%", background:`radial-gradient(circle, ${o.c}, transparent)`, animation:`orbFloat ${6+i}s ease-in-out infinite`, animationDelay:o.d }} />
        ))}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
        <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation:"scanline 4s linear infinite", top:"-4px" }} />
      </div>
      <style>{FONTS}</style>
      <style>{`
        @keyframes orbFloat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
        .sponsor-card { outline: 1px solid rgba(255,255,255,0.08); border-radius: 14px; transform: translateZ(0); transition: transform 0.22s ease, box-shadow 0.22s ease, outline-color 0.22s ease; }
        .sponsor-card:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 24px 55px rgba(239,68,68,0.14); outline-color: rgba(239,68,68,0.45); }
        input::placeholder { color: #475569; } textarea::placeholder { color: #475569; }
        select option { background: #0a0e18; }
      `}</style>

      <div style={{ ...styles.header, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src='/logo.jpg' alt='Team 4550' style={{ height: '68px', width: '68px', objectFit: 'contain', borderRadius: '8px' }} />
          <h1 style={styles.title}>4550 - Something's Bruin | SPONSOR TRACKER</h1>
        </div>
      </div>

      <div style={{ ...styles.main, position: 'relative', zIndex: 1 }}>
        {followUpDue.length > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#fbbf24' }}>
            ⏰ <strong>{followUpDue.length} sponsor{followUpDue.length > 1 ? 's' : ''}</strong> due for follow-up: {followUpDue.map(s => s.company).join(', ')}
          </div>
        )}

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={{ ...styles.statNum, color: '#ef4444' }}>{sponsors.length}</div>
            <div style={styles.statLabel}>TOTAL</div>
          </div>
          {STATUS_OPTIONS.map(s => (
            <div key={s} style={styles.statCard}>
              <div style={{ ...styles.statNum, color: STATUS_COLORS[s] }}>{counts[s]}</div>
              <div style={styles.statLabel}>{s.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div style={styles.controls}>
          <input style={styles.input} placeholder="Search sponsors..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={styles.select} value={filterTier} onChange={e => setFilterTier(e.target.value)}>
            <option value="All">All Tiers</option>
            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={styles.select} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="date">Sort: Date</option>
            <option value="alpha">Sort: A–Z</option>
            <option value="status">Sort: Status</option>
            <option value="tier">Sort: Tier</option>
            <option value="followup">Sort: Follow-Up</option>
          </select>
        </div>
        <div style={{ ...styles.controls, marginTop: '-12px' }}>
          <button style={styles.btn} onClick={exportCSV}>📤 EXPORT CSV</button>
          <button style={styles.btn} onClick={() => setShowImport(true)}>📥 IMPORT SPONSORS</button>
          <button style={styles.btn} onClick={lookupAll} disabled={lookingUp}>🔍 {lookingUp ? `LOOKING UP ${lookupProgress.current}/${lookupProgress.total}...` : 'LOOKUP ALL MISSING'}</button>
          <button style={styles.btn} onClick={() => setModal({})}>+ ADD SPONSOR</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: '60px' }}>Loading...</div>
        ) : (
          <div style={styles.grid}>
            {filtered.map(s => {
              const color = STATUS_COLORS[s.status] || '#64748b'
              const tierColor = TIER_COLORS[s.tier] || '#64748b'
              const isFollowUpDue = s.follow_up_date && s.follow_up_date <= today
              return (
                <div key={s.id} style={{ ...styles.card, outline: isFollowUpDue ? '2px solid rgba(245,158,11,0.4)' : 'none' }}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={styles.company}>{s.company}</div>
                      {s.tier && s.tier !== 'None' && (
                        <div style={{ fontSize: '10px', color: tierColor, letterSpacing: '1px', marginTop: '2px' }}>★ {s.tier.toUpperCase()}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{ ...styles.statusBadge, color, borderColor: color + '50', background: color + '15' }}>{s.status}</div>
                      {isFollowUpDue && <div style={{ fontSize: '9px', color: '#fbbf24', letterSpacing: '1px' }}>⏰ FOLLOW-UP DUE</div>}
                    </div>
                  </div>
                  {s.email && <div style={styles.fieldRow}><span>📧</span><a href={`mailto:${s.email}`} target='_blank' rel='noreferrer' style={{ flex: 1, color: '#fca5a5', textDecoration: 'none', wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0 }}>{s.email}</a><button style={styles.copyBtn} onClick={() => copy(s.email)}>COPY</button></div>}
                  {s.phone && <div style={styles.fieldRow}><span>📞</span><a href={`tel:${s.phone}`} style={{ flex: 1, color: '#fca5a5', textDecoration: 'none', wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0 }}>{s.phone}</a><button style={styles.copyBtn} onClick={() => copy(s.phone)}>COPY</button></div>}
                  {s.notes && <div style={{ ...styles.fieldRow, alignItems: 'flex-start' }}><span>📝</span><span style={{ color: '#94a3b8', lineHeight: '1.5', fontSize: '11px', wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', minWidth: 0 }}>{s.notes}</span></div>}
                  {s.follow_up_date && <div style={styles.fieldRow}><span>📅</span><span style={{ color: isFollowUpDue ? '#fbbf24' : '#94a3b8', fontSize: '11px' }}>Follow up: {s.follow_up_date}</span></div>}
                  <div style={{ marginTop: '12px' }}>
                    <label style={styles.label}>STATUS</label>
                    <select style={{ ...styles.select, width: '100%', fontSize: '12px', padding: '7px 10px' }} value={s.status} onChange={e => updateStatus(s.id, e.target.value)}>
                      {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div style={styles.cardActions}>
                    <button style={styles.editBtn} onClick={() => setModal(s)}>EDIT</button>
                    <button style={{ ...styles.editBtn, flex: 'none' }} onClick={() => setEmailModal(s)}>EMAIL</button>
                    <button style={{ ...styles.editBtn, flex: 'none' }} onClick={() => setNotesModal(s)}>NOTES</button>
                    <button style={styles.deleteBtn} onClick={() => remove(s.id)}>DEL</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <SuggestionsBox showToast={showToast} />
        <div style={{ textAlign: 'center', padding: '24px', fontSize: '11px', color: '#334155', fontFamily: "'Share Tech Mono', monospace", letterSpacing: '2px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '40px' }}>
          BUILT BY PALIVELA_JOEL · FRC TEAM 4550
        </div>
      </div>

      {modal !== null && <Modal sponsor={modal.id ? modal : null} onClose={() => setModal(null)} onSave={save} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} existingSponsors={sponsors} />}
      {emailModal && <EmailTemplatesModal sponsor={emailModal} onClose={() => setEmailModal(null)} />}
      {notesModal && <NotesModal sponsor={notesModal} onClose={() => setNotesModal(null)} />}
      {toast && <Toast message={toast} />}
    </div>
  )
}
