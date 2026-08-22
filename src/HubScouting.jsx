import { useState, useEffect, useRef } from "react";
import { FONTS, C, sbFetch, isAuthed, canEditHub, HubHeader, toastStyle, inputStyle, selectStyle, overlayStyle, addBtnStyle, ghostBtn, dangerBtn } from "./hubUtils.jsx";
import HubBackground from "./HubBackground.jsx";

// ─────────────────────────────────────────────────────────
// REBUILT 2026 — game config (fetched dynamically, falls back to this)
// ─────────────────────────────────────────────────────────
const DEFAULT_GAME_CONFIG = {
  year: 2026,
  name: "REBUILT",
  description: "Score Fuel into your Hub, then climb the Tower before time runs out.",
  scoring: {
    auto_fuel_hub: { label: "Fuel → Hub (Auto)", pts: 1 },
    auto_tower_l1: { label: "Tower L1 Climb (Auto)", pts: 15, max: 2 },
    teleop_fuel_hub: { label: "Fuel → Active Hub (Teleop)", pts: 1 },
    endgame_tower_l1: { label: "Tower Level 1", pts: 10 },
    endgame_tower_l2: { label: "Tower Level 2", pts: 20 },
    endgame_tower_l3: { label: "Tower Level 3", pts: 30 },
  },
  rp: {
    energized: { label: "ENERGIZED (≥100 Fuel in Hub)", threshold: 100 },
    supercharged: { label: "SUPERCHARGED (≥360 Fuel in Hub)", threshold: 360 },
    traversal: { label: "TRAVERSAL (Tower pts ≥50)", threshold: 50 },
  },
  climb_options: ["None", "Level 1 (10)", "Level 2 (20)", "Level 3 (30)"],
  climb_pts: { "None": 0, "Level 1 (10)": 10, "Level 2 (20)": 20, "Level 3 (30)": 30 },
  gamepiece: "Fuel",
  field_elements: ["Hub (active/inactive alternating)", "Tower", "Depot", "Trench", "Outpost/Chute"],
};

// TBA API – fetch current year's game info
async function fetchGameFromTBA(tbaKey, year = new Date().getFullYear()) {
  if (!tbaKey) return null;
  try {
    const res = await fetch(`https://www.thebluealliance.com/api/v3/events/${year}?simple=true`, { headers: { "X-TBA-Auth-Key": tbaKey } });
    if (!res.ok) return null;
    const events = await res.json();
    return events?.[0]?.name ? { year, eventsCount: events.length } : null;
  } catch { return null; }
}

async function fetchTeamAtEvents(tbaKey, teamNumber, year = new Date().getFullYear()) {
  if (!tbaKey || !teamNumber) return [];
  try {
    const res = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${teamNumber}/events/${year}/simple`, { headers: { "X-TBA-Auth-Key": tbaKey } });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────
// Score calculator for REBUILT 2026
// ─────────────────────────────────────────────────────────
function calcScore(entry, cfg = DEFAULT_GAME_CONFIG) {
  if (!entry) return 0;
  let s = 0;
  s += (entry.auto_fuel || 0) * cfg.scoring.auto_fuel_hub.pts;
  if (entry.auto_climb) s += cfg.scoring.auto_tower_l1.pts;
  s += (entry.teleop_fuel || 0) * cfg.scoring.teleop_fuel_hub.pts;
  s += cfg.climb_pts[entry.endgame] || 0;
  return s;
}

function calcRP(entry, allFuel, cfg = DEFAULT_GAME_CONFIG) {
  let rp = 0;
  if (allFuel >= cfg.rp.energized.threshold) rp++;
  if (allFuel >= cfg.rp.supercharged.threshold) rp++;
  const towerPts = cfg.climb_pts[entry.endgame] || 0;
  if (towerPts >= cfg.rp.traversal.threshold) rp++;
  return rp;
}

// ─────────────────────────────────────────────────────────
// Shared counter widget
// ─────────────────────────────────────────────────────────
function Counter({ value, onChange, label, color = C.red, mini = false }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:mini?4:8, userSelect:"none" }}>
      {label && <span style={{ fontSize:mini?10:12, color:C.dim, fontFamily:"monospace", minWidth:mini?50:80, lineHeight:1.3 }}>{label}</span>}
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} style={{ width:mini?32:40, height:mini?32:40, borderRadius:8, border:`1px solid ${C.border}`, background:"rgba(255,255,255,0.05)", color:C.muted, cursor:"pointer", fontSize:18, fontWeight:700, touchAction:"manipulation", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>−</button>
      <div style={{ width:mini?32:40, textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:mini?16:22, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      <button type="button" onClick={() => onChange(value + 1)} style={{ width:mini?32:40, height:mini?32:40, borderRadius:8, border:`1px solid ${color}55`, background:`${color}18`, color, cursor:"pointer", fontSize:18, fontWeight:700, touchAction:"manipulation", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>+</button>
    </div>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", userSelect:"none", padding:"4px 0" }} onClick={() => onChange(!value)}>
      <div style={{ width:44, height:24, borderRadius:12, background:value?C.green:"rgba(255,255,255,0.08)", border:`1px solid ${value?C.green:C.border}`, position:"relative", transition:"all 0.2s", flexShrink:0 }}>
        <div style={{ width:18, height:18, borderRadius:"50%", background:value?"#fff":C.dim, position:"absolute", top:2, left:value?22:2, transition:"left 0.2s" }} />
      </div>
      <span style={{ fontSize:13, color:value?C.text:C.muted, fontFamily:"monospace" }}>{label}</span>
    </div>
  );
}

function SectionHead({ label, color = C.red }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, marginTop:22 }}>
      <div style={{ width:3, height:18, borderRadius:2, background:color, flexShrink:0 }} />
      <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, letterSpacing:2, color }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MATCH SCOUT TAB
// ─────────────────────────────────────────────────────────
const EMPTY_MATCH = {
  team_number:"", match_number:"", alliance:"Red", scouter_name:"",
  auto_fuel:0, auto_climb:false,
  teleop_fuel:0,
  endgame:"None",
  defense:false, defended:false, died:false, notes:"",
};

function MatchScout({ onSubmit, username, cfg = DEFAULT_GAME_CONFIG, isMobile }) {
  const [form, setForm] = useState({ ...EMPTY_MATCH, scouter_name: username || "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const score = calcScore(form, cfg);
  const totalFuel = (form.auto_fuel || 0) + (form.teleop_fuel || 0);
  const rp = calcRP(form, totalFuel, cfg);

  async function submit() {
    if (!form.team_number || !form.match_number) return;
    setSaving(true);
    await sbFetch("scouting_matches", { method:"POST", body:JSON.stringify({ ...form, team_number:parseInt(form.team_number), match_number:parseInt(form.match_number) }) });
    setSaving(false);
    setForm({ ...EMPTY_MATCH, scouter_name:form.scouter_name });
    onSubmit?.();
  }

  return (
    <div style={{ maxWidth:680, margin:"0 auto" }}>
      {/* Game banner */}
      <div style={{ background:"linear-gradient(135deg,rgba(239,68,68,0.1),rgba(168,85,247,0.08))", border:"1px solid rgba(239,68,68,0.2)", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:900, color:C.red }}>{cfg.year}</div>
        <div>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:C.text }}>{cfg.name}</div>
          <div style={{ fontSize:11, color:C.dim, fontFamily:"monospace" }}>{cfg.description}</div>
        </div>
      </div>

      {/* Match info */}
      <SectionHead label="MATCH INFO" color={C.red} />
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap:10, marginBottom:4 }}>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>TEAM #</div>
          <input type="number" inputMode="numeric" placeholder="4550" value={form.team_number} onChange={e => set("team_number", e.target.value)}
            style={{ ...inputStyle, textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:20, fontWeight:700, padding:"10px 8px" }} />
        </div>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>MATCH #</div>
          <input type="number" inputMode="numeric" placeholder="1" value={form.match_number} onChange={e => set("match_number", e.target.value)}
            style={{ ...inputStyle, textAlign:"center", fontFamily:"'Orbitron',sans-serif", fontSize:20, fontWeight:700, padding:"10px 8px" }} />
        </div>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>ALLIANCE</div>
          <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}`, height:44 }}>
            {["Red","Blue"].map(a => (
              <button key={a} type="button" onClick={() => set("alliance", a)} style={{ flex:1, border:"none", cursor:"pointer", fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, background:form.alliance===a?(a==="Red"?"rgba(239,68,68,0.4)":"rgba(59,130,246,0.4)"):"rgba(255,255,255,0.03)", color:form.alliance===a?(a==="Red"?"#fca5a5":"#93c5fd"):C.dim }}>
                {a.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>SCOUTER</div>
          <input placeholder="Name" value={form.scouter_name} onChange={e => set("scouter_name", e.target.value)} style={{ ...inputStyle, height:44, padding:"10px 10px" }} />
        </div>
      </div>

      {/* AUTO */}
      <SectionHead label={`AUTONOMOUS (0-20s) — ${cfg.name}`} color={C.amber} />
      <div style={{ background:"rgba(245,158,11,0.06)", border:`1px solid rgba(245,158,11,0.2)`, borderRadius:12, padding:"16px 16px", display:"flex", flexDirection:"column", gap:14 }}>
        <Counter value={form.auto_fuel} onChange={v => set("auto_fuel", v)} label={`${cfg.gamepiece} → Hub (+1 each)`} color={C.amber} />
        <Toggle value={form.auto_climb} onChange={v => set("auto_climb", v)} label={`Tower L1 Climb Auto (+${cfg.scoring.auto_tower_l1.pts} pts, max 2 robots)`} />
        <div style={{ fontSize:11, color:C.amber, fontFamily:"monospace", paddingTop:4, borderTop:`1px solid rgba(245,158,11,0.15)` }}>
          💡 Hub is ACTIVE for both alliances during Auto. Shift determined by Auto Fuel score.
        </div>
      </div>

      {/* TELEOP */}
      <SectionHead label={`TELEOP (20s–2:40) — Active Hub Only`} color={C.blue} />
      <div style={{ background:"rgba(59,130,246,0.06)", border:`1px solid rgba(59,130,246,0.2)`, borderRadius:12, padding:"16px 16px", display:"flex", flexDirection:"column", gap:14 }}>
        <Counter value={form.teleop_fuel} onChange={v => set("teleop_fuel", v)} label={`${cfg.gamepiece} → Active Hub (+1 each)`} color={C.blue} />
        <div style={{ fontSize:11, color:C.blue, fontFamily:"monospace" }}>
          💡 Hubs alternate active/inactive. Points only score in your ACTIVE Hub.
        </div>
        {/* RP tracker */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", paddingTop:8, borderTop:`1px solid rgba(59,130,246,0.15)` }}>
          {[
            { label:"ENERGIZED", val: totalFuel, threshold:100, color:C.amber },
            { label:"SUPERCHARGED", val: totalFuel, threshold:360, color:C.purple },
          ].map(rp => (
            <div key={rp.label} style={{ display:"flex", alignItems:"center", gap:6, background:`${rp.val >= rp.threshold ? rp.color : "#334155"}18`, border:`1px solid ${rp.val >= rp.threshold ? rp.color : "#334155"}`, borderRadius:8, padding:"4px 10px" }}>
              <span style={{ fontSize:10, color: rp.val >= rp.threshold ? rp.color : C.dim, fontFamily:"monospace", fontWeight:700 }}>
                {rp.label} {rp.val}/{rp.threshold}
              </span>
              {rp.val >= rp.threshold && <span style={{ color:C.green, fontSize:12 }}>✓ +1RP</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ENDGAME */}
      <SectionHead label="ENDGAME — TOWER CLIMB" color={C.purple} />
      <div style={{ background:"rgba(168,85,247,0.06)", border:`1px solid rgba(168,85,247,0.2)`, borderRadius:12, padding:"16px 16px" }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
          {["None", ...cfg.climb_options].map(opt => {
            const pts = cfg.climb_pts[opt] || 0;
            return (
              <button key={opt} type="button" onClick={() => set("endgame", opt)} style={{ padding:"10px 14px", borderRadius:8, border:`1px solid ${form.endgame===opt?C.purple:C.border}`, background:form.endgame===opt?"rgba(168,85,247,0.25)":"rgba(255,255,255,0.03)", color:form.endgame===opt?"#c084fc":C.muted, cursor:"pointer", fontFamily:"'Orbitron',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1, touchAction:"manipulation" }}>
                {opt === "None" ? "None" : opt.split("(")[0].trim()}{pts > 0 ? ` +${pts}` : ""}
              </button>
            );
          })}
        </div>
        {/* TRAVERSAL RP check */}
        {(() => { const tp = cfg.climb_pts[form.endgame] || 0; return tp >= cfg.rp.traversal.threshold ? (
          <div style={{ fontSize:11, color:C.green, fontFamily:"monospace" }}>✓ TRAVERSAL RP earned (+1RP, tower pts ≥50)</div>
        ) : (
          <div style={{ fontSize:11, color:C.dim, fontFamily:"monospace" }}>TRAVERSAL needs {cfg.rp.traversal.threshold}+ tower pts</div>
        ); })()}
        <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginTop:14, paddingTop:14, borderTop:`1px solid rgba(168,85,247,0.15)` }}>
          <Toggle value={form.defense} onChange={v => set("defense", v)} label="Played Defense" />
          <Toggle value={form.defended} onChange={v => set("defended", v)} label="Was Defended" />
          <Toggle value={form.died} onChange={v => set("died", v)} label="Robot Died" />
        </div>
      </div>

      {/* Notes */}
      <SectionHead label="NOTES" color={C.dim} />
      <textarea placeholder="Driver skill, strategy, observations..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...inputStyle, minHeight:64, resize:"vertical" }} />

      {/* Score + RP preview */}
      <div style={{ display:"flex", gap:12, marginTop:18, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"10px 16px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:C.dim, fontFamily:"monospace", letterSpacing:2 }}>EST. SCORE</div>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:28, fontWeight:900, color:C.red, lineHeight:1 }}>{score}</div>
          </div>
          <div style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.3)", borderRadius:10, padding:"10px 16px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:C.dim, fontFamily:"monospace", letterSpacing:2 }}>EST. RP</div>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:28, fontWeight:900, color:C.purple, lineHeight:1 }}>{rp}</div>
          </div>
        </div>
        <button type="button" onClick={submit} disabled={saving || !form.team_number || !form.match_number}
          style={{ ...addBtnStyle, padding:"13px 28px", fontSize:14, fontFamily:"'Orbitron',sans-serif", letterSpacing:2, opacity:(!form.team_number||!form.match_number)?0.5:1 }}>
          {saving ? "SUBMITTING..." : "SUBMIT MATCH →"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PIT SCOUT TAB
// ─────────────────────────────────────────────────────────
const EMPTY_PIT = { team_number:"", team_name:"", drivetrain:"Swerve", weight_lbs:"", auto_capabilities:"", teleop_capabilities:"", climb_type:"None", notes:"", scouter_name:"", can_score_auto_climb:false, can_score_fuel_near:false, can_score_fuel_far:false };

function PitScout({ onSubmit, username, isMobile }) {
  const [form, setForm] = useState({ ...EMPTY_PIT, scouter_name: username||"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  async function submit() {
    if (!form.team_number) return;
    setSaving(true);
    await sbFetch("scouting_pits", { method:"POST", body:JSON.stringify({...form, team_number:parseInt(form.team_number)}) });
    setSaving(false);
    setForm({...EMPTY_PIT, scouter_name:form.scouter_name});
    onSubmit?.();
  }

  const Check = ({ k, label }) => (
    <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"6px 0", fontSize:13, color:form[k]?C.text:C.muted, fontFamily:"monospace", userSelect:"none" }} onClick={() => set(k,!form[k])}>
      <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${form[k]?C.green:C.border}`, background:form[k]?C.green:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s" }}>
        {form[k] && <span style={{ color:"#fff", fontSize:11, fontWeight:700, lineHeight:1 }}>✓</span>}
      </div>
      {label}
    </label>
  );

  return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <SectionHead label="TEAM INFO" color={C.blue} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10, marginBottom:10 }}>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>TEAM #</div>
          <input type="number" inputMode="numeric" placeholder="4550" value={form.team_number} onChange={e => set("team_number",e.target.value)} style={{ ...inputStyle, fontFamily:"'Orbitron',sans-serif", fontSize:18, fontWeight:700, padding:"10px 8px", textAlign:"center" }} />
        </div>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>TEAM NAME</div>
          <input placeholder="Team name" value={form.team_name} onChange={e => set("team_name",e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr", gap:10 }}>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>DRIVETRAIN</div>
          <select value={form.drivetrain} onChange={e => set("drivetrain",e.target.value)} style={selectStyle}>
            {["Swerve","Tank","West Coast","Mecanum","Other"].map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>WEIGHT (lbs)</div>
          <input type="number" inputMode="decimal" placeholder="125" value={form.weight_lbs} onChange={e => set("weight_lbs",e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>BEST CLIMB</div>
          <select value={form.climb_type} onChange={e => set("climb_type",e.target.value)} style={selectStyle}>
            {["None","Level 1","Level 2","Level 3"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <SectionHead label="REBUILT CAPABILITIES" color={C.amber} />
      <div style={{ background:"rgba(245,158,11,0.06)", border:`1px solid rgba(245,158,11,0.15)`, borderRadius:12, padding:"14px 16px" }}>
        <Check k="can_score_auto_climb" label="Can climb Tower in Auto (L1)" />
        <Check k="can_score_fuel_near" label="Can score Fuel from near (short range)" />
        <Check k="can_score_fuel_far" label="Can score Fuel from far (long range)" />
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:6 }}>AUTO CAPABILITIES</div>
          <textarea placeholder="e.g. 12-piece auto, high auto Fuel, consistent L1 auto climb..." value={form.auto_capabilities} onChange={e => set("auto_capabilities",e.target.value)} style={{ ...inputStyle, minHeight:50, resize:"vertical" }} />
        </div>
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", marginBottom:6 }}>TELEOP CAPABILITIES</div>
          <textarea placeholder="e.g. Fast Fuel cycle, L3 climber, can play defense..." value={form.teleop_capabilities} onChange={e => set("teleop_capabilities",e.target.value)} style={{ ...inputStyle, minHeight:50, resize:"vertical" }} />
        </div>
      </div>

      <SectionHead label="NOTES" color={C.dim} />
      <textarea placeholder="Robot quirks, driver skill, strategy observations..." value={form.notes} onChange={e => set("notes",e.target.value)} style={{ ...inputStyle, minHeight:64, resize:"vertical" }} />
      <div style={{ display:"flex", gap:10, marginTop:10, flexWrap:"wrap" }}>
        <input placeholder="Scouter name" value={form.scouter_name} onChange={e => set("scouter_name",e.target.value)} style={{ ...inputStyle, flex:1 }} />
        <button type="button" onClick={submit} disabled={saving||!form.team_number} style={{ ...addBtnStyle, opacity:!form.team_number?0.5:1, fontFamily:"'Orbitron',sans-serif", letterSpacing:1 }}>
          {saving?"SAVING...":"SUBMIT PIT →"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TEAM ANALYTICS TAB (via TBA API)
// ─────────────────────────────────────────────────────────
function TeamStatsAnalysis({ competitions = [] }) {
  const [team, setTeam] = useState("");
  const [comp, setComp] = useState(competitions.find(c => c.attending)?.id || "");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const tbaKey = localStorage.getItem("tba_key"); // Assuming you store it here

  async function fetchStats() {
    if (!team || !comp) return;
    setLoading(true);
    setStats(null);
    const selected = competitions.find(c => c.id === comp);
    try {
      const res = await fetch(`https://www.thebluealliance.com/api/v3/team/frc${team}/event/${selected.event_key}/status`, {
        headers: { "X-TBA-Auth-Key": tbaKey }
      });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <div style={ { fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: C.blue, marginBottom: 16 } }>TEAM ANALYTICS (TBA)</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input type="number" placeholder="Team #" value={team} onChange={e => setTeam(e.target.value)} style={inputStyle} />
        <select value={comp} onChange={e => setComp(e.target.value)} style={selectStyle}>
          {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={fetchStats} style={addBtnStyle}>Fetch</button>
      </div>
      {loading && <div>Loading...</div>}
      {stats && (
        <pre style={{ background: C.surface, padding: 10, fontSize: 12, color: C.text, overflow: "auto" }}>
          {JSON.stringify(stats.qual?.ranking?.sort_order_info, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// TEAM DATA TAB
// ─────────────────────────────────────────────────────────
function TeamData({ matches, pits, cfg = DEFAULT_GAME_CONFIG, isMobile }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("avg_score");
  const [expanded, setExpanded] = useState(null);

  const teams = {};
  matches.forEach(m => {
    const t = m.team_number;
    if (!teams[t]) teams[t] = { team_number:t, matches:[], pit:null };
    teams[t].matches.push(m);
  });
  pits.forEach(p => {
    const t = p.team_number;
    if (!teams[t]) teams[t] = { team_number:t, matches:[], pit:null };
    teams[t].pit = p;
  });

  const teamList = Object.values(teams).map(t => {
    const scores = t.matches.map(m => calcScore(m, cfg));
    const avg = scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const avgFuel = t.matches.length ? t.matches.reduce((s,m)=>(s+(m.auto_fuel||0)+(m.teleop_fuel||0)),0)/t.matches.length : 0;
    const deep = t.matches.filter(m=>m.endgame==="Level 3 (30)").length;
    return { ...t, avg_score:Math.round(avg*10)/10, max_score:max, avg_fuel:Math.round(avgFuel*10)/10, deep_climbs:deep };
  });

  const filtered = teamList
    .filter(t => !search || String(t.team_number).includes(search) || t.pit?.team_name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sort==="avg_score"?b.avg_score-a.avg_score:sort==="max"?b.max_score-a.max_score:sort==="fuel"?b.avg_fuel-a.avg_fuel:a.team_number-b.team_number);

  const maxScore = Math.max(...filtered.map(t=>t.avg_score), 1);

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap" }}>
        <input placeholder="Search team # or name..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex:1, minWidth:160 }} />
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ ...selectStyle, width:"auto", flex:"none" }}>
          <option value="avg_score">Sort: Avg Score</option>
          <option value="max">Sort: Max Score</option>
          <option value="fuel">Sort: Avg Fuel</option>
          <option value="num">Sort: Team #</option>
        </select>
      </div>
      {filtered.length === 0 && <div style={{ textAlign:"center", color:C.dim, padding:"60px 0", fontFamily:"monospace" }}>No scouting data yet.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map((t, idx) => {
          const isExp = expanded === t.team_number;
          return (
            <div key={t.team_number} style={{ background:C.surface, border:`1px solid ${isExp?"rgba(239,68,68,0.35)":C.border}`, borderRadius:10, overflow:"hidden", cursor:"pointer", transition:"all 0.15s" }} onClick={() => setExpanded(isExp?null:t.team_number)}>
              <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:10, color:idx<3?[C.amber,C.muted,"#b45309"][idx]:C.dim, minWidth:20, textAlign:"center" }}>#{idx+1}</div>
                <div style={{ minWidth:isMobile?60:80 }}>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?14:16, fontWeight:700, color:C.text }}>{t.team_number}</div>
                  {t.pit?.team_name && <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace" }}>{t.pit.team_name}</div>}
                </div>
                <div style={{ flex:1, minWidth:80 }}>
                  <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(t.avg_score/maxScore)*100}%`, background:`linear-gradient(90deg,${C.red},${C.amber})`, borderRadius:3 }} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:isMobile?10:16, flexWrap:"wrap" }}>
                  {[{l:"AVG",v:t.avg_score,c:C.red},{l:"MAX",v:t.max_score,c:C.amber},{l:"FUEL",v:t.avg_fuel,c:C.blue},{l:`${t.matches.length}m`,v:t.matches.length,c:C.dim}].map(s=>(
                    <div key={s.l} style={{ textAlign:"center" }}>
                      <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?13:15, fontWeight:700, color:s.c }}>{s.v}</div>
                      <div style={{ fontSize:9, color:C.dim, fontFamily:"monospace" }}>{s.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize:12, color:C.dim }}>▾</div>
              </div>
              {isExp && (
                <div style={{ borderTop:`1px solid ${C.border}`, padding:"14px", background:"rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
                    <div>
                      <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", letterSpacing:2, marginBottom:8 }}>MATCH HISTORY</div>
                      {t.matches.slice(0,6).map(m=>(
                        <div key={m.id} style={{ display:"flex", gap:10, marginBottom:6, fontSize:12, color:C.muted, fontFamily:"monospace", alignItems:"center" }}>
                          <span style={{ color:m.alliance==="Red"?"#fca5a5":"#93c5fd", minWidth:22 }}>M{m.match_number}</span>
                          <span style={{ color:C.red, fontWeight:700, minWidth:32 }}>{calcScore(m,cfg)}pt</span>
                          <span style={{ color:C.amber, fontSize:10 }}>⚽{(m.auto_fuel||0)+(m.teleop_fuel||0)}</span>
                          <span style={{ color:C.purple, fontSize:10 }}>{m.endgame!=="None"?m.endgame.split(" ")[0]:""}</span>
                          {m.died&&<span style={{ color:C.red }}>💀</span>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", letterSpacing:2, marginBottom:8 }}>PIT DATA</div>
                      {!t.pit?<div style={{ color:C.dim, fontSize:12, fontFamily:"monospace" }}>No pit data.</div>:(
                        <div style={{ fontSize:12, color:C.muted, fontFamily:"monospace", display:"flex", flexDirection:"column", gap:4 }}>
                          {t.pit.drivetrain&&<div>🦾 {t.pit.drivetrain}</div>}
                          {t.pit.weight_lbs&&<div>⚖️ {t.pit.weight_lbs} lbs</div>}
                          {t.pit.climb_type&&t.pit.climb_type!=="None"&&<div>🏗️ Best: {t.pit.climb_type}</div>}
                          {t.pit.auto_capabilities&&<div style={{ color:C.dim }}>🤖 {t.pit.auto_capabilities}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PICKLIST TAB
// ─────────────────────────────────────────────────────────
function Picklist({ matches, picklist, onReload, cfg = DEFAULT_GAME_CONFIG, isMobile }) {
  const [list, setList] = useState([]);
  const [addTeam, setAddTeam] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const teams = {};
  matches.forEach(m => {
    if (!teams[m.team_number]) teams[m.team_number] = [];
    teams[m.team_number].push(calcScore(m, cfg));
  });
  const teamStats = Object.entries(teams).map(([num,scores]) => ({
    num: parseInt(num),
    avg: Math.round(scores.reduce((a,b)=>a+b,0)/scores.length * 10)/10,
  }));

  useEffect(() => { setList(picklist.map(p=>p.team_number)); }, [picklist]);

  async function saveList() {
    setSaving(true);
    // Delete all then reinsert
    const existing = await sbFetch("scouting_picklist?select=id");
    if (existing?.length) {
      for (const e of existing) await sbFetch(`scouting_picklist?id=eq.${e.id}`, { method:"DELETE" });
    }
    if (list.length) await sbFetch("scouting_picklist", { method:"POST", body:JSON.stringify(list.map((t,i)=>({team_number:t,rank:i+1}))) });
    setSaving(false); onReload?.();
  }

  function drop(targetIdx) {
    if (dragIdx===null||dragIdx===targetIdx) return;
    const n=[...list]; const [m]=n.splice(dragIdx,1); n.splice(targetIdx,0,m);
    setList(n); setDragIdx(null); setDragOverIdx(null);
  }

  const getStats = num => teamStats.find(t=>t.num===num);

  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <input type="number" inputMode="numeric" placeholder="Add team number..." value={addTeam} onChange={e=>setAddTeam(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(list.includes(parseInt(addTeam))||setList(l=>[...l,parseInt(addTeam)]),setAddTeam(""))} style={{ ...inputStyle, flex:1, fontFamily:"'Orbitron',sans-serif", fontSize:16, minWidth:140 }} />
        <button type="button" onClick={()=>{const n=parseInt(addTeam);if(n&&!list.includes(n)){setList(l=>[...l,n]);setAddTeam("");}}} style={addBtnStyle}>+ ADD</button>
        <button type="button" onClick={saveList} disabled={saving} style={{ ...addBtnStyle, background:C.green, opacity:saving?0.6:1 }}>{saving?"SAVING...":"💾 SAVE"}</button>
      </div>

      {teamStats.length>0&&(
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", letterSpacing:2, marginBottom:10 }}>SUGGESTED FROM DATA (by avg score)</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {[...teamStats].sort((a,b)=>b.avg-a.avg).slice(0,12).map(t=>(
              <button key={t.num} type="button" onClick={()=>{if(!list.includes(t.num))setList(l=>[...l,t.num]);}} style={{ background:list.includes(t.num)?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.04)", border:`1px solid ${list.includes(t.num)?C.green:C.border}`, borderRadius:6, padding:"6px 11px", cursor:"pointer", fontFamily:"monospace", fontSize:12, color:list.includes(t.num)?C.green:C.muted }}>
                {t.num} <span style={{ color:C.dim, fontSize:10 }}>{t.avg}pt</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize:10, color:C.dim, fontFamily:"monospace", letterSpacing:2, marginBottom:10 }}>PICKLIST — drag to reorder</div>
      {list.length===0&&(
        <div style={{ textAlign:"center", color:C.dim, padding:"40px 0", fontFamily:"monospace", border:`2px dashed ${C.border}`, borderRadius:10 }}>Add teams above to build your picklist.</div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {list.map((num,idx)=>{
          const st=getStats(num);
          const isDrag=dragIdx===idx, isDragOver=dragOverIdx===idx&&dragIdx!==idx;
          return (
            <div key={num} draggable onDragStart={()=>setDragIdx(idx)} onDragOver={e=>{e.preventDefault();setDragOverIdx(idx);}} onDrop={()=>drop(idx)} onDragEnd={()=>{setDragIdx(null);setDragOverIdx(null);}}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", background:isDragOver?"rgba(239,68,68,0.08)":C.surface, border:`1px solid ${isDragOver?"rgba(239,68,68,0.4)":C.border}`, borderRadius:8, cursor:"grab", opacity:isDrag?0.4:1 }}>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:10, color:idx<3?[C.amber,C.muted,"#b45309"][idx]:C.dim, minWidth:20 }}>#{idx+1}</div>
              <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:700, color:C.text, flex:1 }}>{num}</div>
              {st&&<div style={{ fontFamily:"monospace", fontSize:12, color:C.red }}>{st.avg}pt avg</div>}
              <button type="button" onClick={()=>setList(l=>l.filter((_,i)=>i!==idx))} style={{ background:"transparent", border:"none", color:C.dim, cursor:"pointer", fontSize:16, padding:"0 4px" }}>✕</button>
            </div>
          );
        })}
      </div>

      {list.length>=3&&(
        <div style={{ marginTop:20, padding:"14px 16px", background:"rgba(239,68,68,0.06)", border:`1px solid rgba(239,68,68,0.2)`, borderRadius:10 }}>
          <div style={{ fontSize:10, color:C.red, fontFamily:"monospace", letterSpacing:2, marginBottom:10 }}>TOP 3 ALLIANCE PREVIEW</div>
          <div style={{ display:"flex", gap:10 }}>
            {list.slice(0,3).map((num,i)=>{
              const st=getStats(num);
              return (
                <div key={num} style={{ flex:1, textAlign:"center", background:"rgba(255,255,255,0.04)", borderRadius:8, padding:10 }}>
                  <div style={{ fontSize:9, color:C.dim, fontFamily:"monospace", marginBottom:4 }}>{["CAPTAIN","1ST PICK","2ND PICK"][i]}</div>
                  <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:18, fontWeight:900, color:C.red }}>{num}</div>
                  {st&&<div style={{ fontSize:11, color:C.muted, fontFamily:"monospace" }}>{st.avg}pt</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RAW DATA TAB
// ─────────────────────────────────────────────────────────
function RawData({ matches, onDelete, cfg = DEFAULT_GAME_CONFIG, isMobile }) {
  const [filter, setFilter] = useState("");
  const filtered = matches.filter(m => !filter || String(m.team_number).includes(filter) || String(m.match_number).includes(filter));
  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <input placeholder="Filter team or match #..." value={filter} onChange={e=>setFilter(e.target.value)} style={{ ...inputStyle, flex:1 }} />
        <div style={{ fontFamily:"monospace", fontSize:12, color:C.dim, padding:"11px 0", flexShrink:0 }}>{filtered.length} entries</div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"monospace", fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}` }}>
              {["M#","Team","Alliance","Score","AutoFuel","TeleFuel","Endgame","Scout","Del"].map(h=>(
                <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:C.dim, fontSize:10, letterSpacing:1, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m=>(
              <tr key={m.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding:"8px 10px", color:C.muted }}>M{m.match_number}</td>
                <td style={{ padding:"8px 10px", color:C.text, fontFamily:"'Orbitron',sans-serif", fontWeight:700 }}>{m.team_number}</td>
                <td style={{ padding:"8px 10px", color:m.alliance==="Red"?"#fca5a5":"#93c5fd" }}>{m.alliance}</td>
                <td style={{ padding:"8px 10px", color:C.red, fontWeight:700, fontFamily:"'Orbitron',sans-serif" }}>{calcScore(m,cfg)}</td>
                <td style={{ padding:"8px 10px", color:C.amber }}>{m.auto_fuel||0}</td>
                <td style={{ padding:"8px 10px", color:C.blue }}>{m.teleop_fuel||0}</td>
                <td style={{ padding:"8px 10px", color:C.purple, fontSize:10 }}>{m.endgame||"None"}</td>
                <td style={{ padding:"8px 10px", color:C.dim }}>{m.scouter_name||"—"}</td>
                <td style={{ padding:"8px 10px" }}>
                  <button type="button" onClick={()=>onDelete(m.id)} style={{ background:"transparent", border:"none", color:C.dim, cursor:"pointer", fontSize:14, touchAction:"manipulation" }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div style={{ textAlign:"center", color:C.dim, padding:"40px 0", fontFamily:"monospace" }}>No match data.</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAPS VIEW — Pit Maps & Venue Maps
// ─────────────────────────────────────────────────────────
function MapsView({ competitions, pits, matches, cfg, isMobile }) {
  const [selectedComp, setSelectedComp] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const attending = competitions.filter(c => c.attending);
  const teamsAtComp = selectedComp ? [...new Set(matches.filter(m => m.event_key === selectedComp.event_key).map(m => m.team_number))] : [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, color: C.red, marginBottom: 12 }}>Competition Maps</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {attending.map(c => (
            <button key={c.id} onClick={() => setSelectedComp(c)} style={{ padding: "10px 16px", border: `1px solid ${selectedComp?.id === c.id ? C.red : C.border}`, background: selectedComp?.id === c.id ? `${C.red}18` : "rgba(255,255,255,0.05)", color: selectedComp?.id === c.id ? C.red : C.text, borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {selectedComp && (
        <div>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, color: C.blue, marginBottom: 16 }}>{selectedComp.name} Maps</h3>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20 }}>
            {selectedComp.venue_map_url && (
              <div>
                <h4 style={{ fontSize: 14, color: C.text, marginBottom: 8 }}>Venue Map</h4>
                <img src={selectedComp.venue_map_url} alt="Venue Map" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}` }} />
              </div>
            )}
            {selectedComp.pit_map_url && (
              <div>
                <h4 style={{ fontSize: 14, color: C.text, marginBottom: 8 }}>Pit Map</h4>
                <div style={{ position: "relative" }}>
                  <img src={selectedComp.pit_map_url} alt="Pit Map" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}` }} />
                  {teamsAtComp.map(team => {
                    const pit = pits.find(p => p.team_number === team);
                    if (!pit) return null;
                    // Assume pit map has clickable areas, but for now, overlay buttons
                    return (
                      <button key={team} onClick={() => setSelectedTeam(team)} style={{ position: "absolute", top: Math.random() * 200, left: Math.random() * 300, width: 40, height: 40, borderRadius: "50%", background: C.red, color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        {team}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTeam && (
        <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
          <h4 style={{ fontSize: 16, color: C.amber, marginBottom: 12 }}>Team {selectedTeam} Stats</h4>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <div>
              <h5 style={{ fontSize: 14, color: C.text }}>Pit Report</h5>
              {(() => {
                const pit = pits.find(p => p.team_number === selectedTeam);
                return pit ? (
                  <div style={{ fontSize: 12, color: C.dim }}>
                    <div>Drivetrain: {pit.drivetrain}</div>
                    <div>Weight: {pit.weight_lbs} lbs</div>
                    <div>Auto: {pit.auto_capabilities}</div>
                    <div>Teleop: {pit.teleop_capabilities}</div>
                  </div>
                ) : <div style={{ color: C.muted }}>No pit report</div>;
              })()}
            </div>
            <div>
              <h5 style={{ fontSize: 14, color: C.text }}>Match Averages</h5>
              {(() => {
                const teamMatches = matches.filter(m => m.team_number === selectedTeam);
                if (!teamMatches.length) return <div style={{ color: C.muted }}>No matches</div>;
                const avgFuel = teamMatches.reduce((s, m) => s + (m.auto_fuel || 0) + (m.teleop_fuel || 0), 0) / teamMatches.length;
                const avgClimb = teamMatches.filter(m => m.endgame !== "None").length / teamMatches.length * 100;
                return (
                  <div style={{ fontSize: 12, color: C.dim }}>
                    <div>Avg Fuel: {avgFuel.toFixed(1)}</div>
                    <div>Climb %: {avgClimb.toFixed(0)}%</div>
                  </div>
                );
              })()}
            </div>
          </div>
          <button onClick={() => setSelectedTeam(null)} style={{ marginTop: 12, padding: "6px 12px", border: `1px solid ${C.border}`, background: "transparent", color: C.muted, borderRadius: 4, cursor: "pointer" }}>Close</button>
        </div>
      )}
    </div>
  );
}

function MapsView2({ competitions, pits, matches, cfg, isMobile }) {
  const attending = competitions.filter(c => c.attending);
  const [selectedCompId, setSelectedCompId] = useState(attending[0]?.id || "");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const selectedComp = attending.find(c => c.id === selectedCompId) || attending[0];
  const teams = [...new Set([
    ...pits.map(p => p.team_number).filter(Boolean),
    ...matches.map(m => m.team_number).filter(Boolean),
  ])].sort((a, b) => a - b);
  const compTeams = selectedComp ? teams : [];

  useEffect(() => {
    if (!selectedCompId && attending[0]?.id) setSelectedCompId(attending[0].id);
  }, [attending.length, selectedCompId]);

  function teamSummary(team) {
    const pit = pits.find(p => p.team_number === team);
    const humanMatches = matches.filter(m => m.team_number === team && !m.source?.includes("ai"));
    const aiMatches = matches.filter(m => m.team_number === team && m.source?.includes("ai"));
    const all = matches.filter(m => m.team_number === team);
    const avg = all.length ? all.reduce((s, m) => s + calcScore(m, cfg), 0) / all.length : 0;
    const fuel = all.length ? all.reduce((s, m) => s + (m.auto_fuel || 0) + (m.teleop_fuel || 0), 0) / all.length : 0;
    const climbPct = all.length ? (all.filter(m => m.endgame && m.endgame !== "None").length / all.length) * 100 : 0;
    return { pit, humanMatches, aiMatches, all, avg, fuel, climbPct };
  }

  const selected = selectedTeam ? teamSummary(selectedTeam) : null;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, color: C.red, marginBottom: 12 }}>Competition Maps</h2>
        {attending.length === 0 ? (
          <div style={{ color: C.dim, fontFamily: "monospace", border: `1px dashed ${C.border}`, borderRadius: 10, padding: 18 }}>No attending competitions selected yet. Add them from the admin Competitions page.</div>
        ) : (
          <select value={selectedComp?.id || ""} onChange={e => { setSelectedCompId(e.target.value); setSelectedTeam(null); }} style={selectStyle}>
            {attending.map(c => <option key={c.id} value={c.id}>{c.name} - {c.start_date}</option>)}
          </select>
        )}
      </div>

      {selectedComp && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", gap: 16, alignItems: "start" }}>
          <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 13, color: C.text }}>{selectedComp.name}</div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "monospace" }}>{selectedComp.location}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {selectedComp.venue_map_url && <a href={selectedComp.venue_map_url} target="_blank" rel="noreferrer" style={ghostBtn}>Venue</a>}
                {selectedComp.pit_map_url && <a href={selectedComp.pit_map_url} target="_blank" rel="noreferrer" style={ghostBtn}>Pit</a>}
              </div>
            </div>

            <div style={{ position: "relative", minHeight: isMobile ? 260 : 420, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              {selectedComp.pit_map_url ? (
                <img src={selectedComp.pit_map_url} alt="Pit map" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "transparent" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontFamily: "monospace", textAlign: "center", padding: 20 }}>
                  Pit maps are usually posted shortly before the event. Track the latest status in Admin {'>'} Competitions.
                </div>
              )}
              <div style={{ position: "absolute", inset: 0, padding: 12, display: "grid", gridTemplateColumns: isMobile ? "repeat(3,1fr)" : "repeat(5,1fr)", gap: 8, alignContent: "start", pointerEvents: "none" }}>
                {compTeams.slice(0, isMobile ? 30 : 60).map(team => {
                  const summary = teamSummary(team);
                  return (
                    <button key={team} type="button" onClick={() => setSelectedTeam(team)} style={{ pointerEvents: "auto", background: selectedTeam === team ? C.red : "rgba(8,10,15,0.78)", border: `1px solid ${selectedTeam === team ? C.red : C.border}`, borderRadius: 8, color: "#fff", cursor: "pointer", padding: "7px 6px", fontFamily: "'Orbitron',sans-serif", fontSize: 11, boxShadow: "0 8px 22px rgba(0,0,0,0.35)" }}>
                      {team}
                      <div style={{ fontFamily: "monospace", fontSize: 9, color: selectedTeam === team ? "#fff" : C.dim }}>{summary.all.length ? `${summary.avg.toFixed(0)} avg` : "no data"}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 12, color: C.amber, marginBottom: 12 }}>Team Details</div>
            {!selectedTeam && <div style={{ color: C.dim, fontSize: 13, fontFamily: "monospace" }}>Tap a team on the pit map overlay to compare human scouting and AI-derived results.</div>}
            {selectedTeam && selected && (
              <div>
                <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 24, color: C.text, marginBottom: 6 }}>Team {selectedTeam}</div>
                {selected.pit?.team_name && <div style={{ color: C.muted, marginBottom: 12 }}>{selected.pit.team_name}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[["Avg score", selected.avg.toFixed(1), C.red], ["Avg fuel", selected.fuel.toFixed(1), C.blue], ["Climb rate", `${selected.climbPct.toFixed(0)}%`, C.purple], ["Reports", selected.all.length, C.green]].map(([l, v, color]) => (
                    <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
                      <div style={{ color, fontFamily: "'Orbitron',sans-serif", fontSize: 18 }}>{v}</div>
                      <div style={{ color: C.dim, fontSize: 10, fontFamily: "monospace" }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7, fontFamily: "monospace" }}>
                  <div>Human entries: {selected.humanMatches.length}</div>
                  <div>AI entries: {selected.aiMatches.length}</div>
                  <div>Drivetrain: {selected.pit?.drivetrain || "No pit report"}</div>
                  <div>Best climb: {selected.pit?.climb_type || "Unknown"}</div>
                  {selected.pit?.auto_capabilities && <div>Auto: {selected.pit.auto_capabilities}</div>}
                  {selected.pit?.teleop_capabilities && <div>Teleop: {selected.pit.teleop_capabilities}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────
const TABS = [
  { id:"match", label:"🎯 Match Scout" },
  { id:"pit", label:"🔧 Pit Scout" },
  { id:"maps", label:"🗺️ Maps" },
  { id:"stream", label:"📊 Team Stats" },
  { id:"data", label:"📊 Team Data" },
  { id:"picklist", label:"🏆 Picklist" },
  { id:"raw", label:"📋 Raw Data" },
];

export default function HubScouting() {
  const [authed] = useState(isAuthed());
  const [tab, setTab] = useState(window.location.pathname.includes("venuemap") ? "maps" : "match");
  const [matches, setMatches] = useState([]);
  const [pits, setPits] = useState([]);
  const [picklist, setPicklist] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [toast, setToast] = useState("");
  const [gameConfig, setGameConfig] = useState(DEFAULT_GAME_CONFIG);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const username = localStorage.getItem("hub_username") || "";

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => {
    if (!authed) { window.location.href = "/member-hub"; return; }
    document.title = "Scouting · Team 4550";
    loadAll();
    loadGameConfig();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(""),3000); };

  async function loadGameConfig() {
    // Try to get custom game config from site_config
    const r = await sbFetch("site_config?key=eq.game_config_2026&select=value");
    if (r?.[0]?.value) {
      try { setGameConfig({...DEFAULT_GAME_CONFIG, ...JSON.parse(r[0].value)}); } catch {}
    }
  }

  async function loadAll() {
    const [m, p, pk, comp] = await Promise.all([
      sbFetch("scouting_matches?select=*&order=created_at.desc") || [],
      sbFetch("scouting_pits?select=*&order=team_number.asc") || [],
      sbFetch("scouting_picklist?select=*&order=rank.asc") || [],
      sbFetch("competitions?select=*&order=start_date.asc") || [],
    ]);
    setMatches(m||[]); setPits(p||[]); setPicklist(pk||[]); setCompetitions(comp||[]);
  }

  async function deleteMatch(id) {
    if (!confirm("Delete this entry?")) return;
    await sbFetch(`scouting_matches?id=eq.${id}`, { method:"DELETE" });
    loadAll(); showToast("Deleted.");
  }

  if (!authed) return null;

  const totalTeams = [...new Set(matches.map(m=>m.team_number))].length;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Exo 2',sans-serif", position:"relative" }}>
      <HubBackground density={11500} opacity={0.3} />
      <style>{FONTS}</style>
      {toast && <div style={toastStyle}>{toast}</div>}
      <HubHeader title="🔭 Scouting" />

      {/* Stats bar */}
      <div style={{ background:"rgba(13,17,23,0.9)", borderBottom:`1px solid ${C.border}`, padding:"10px 16px", display:"flex", gap:isMobile?14:24, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?11:13, color:C.red, letterSpacing:isMobile?1:2, fontWeight:700 }}>{gameConfig.year} {gameConfig.name}</div>
        {[{l:"MATCHES",v:matches.length,c:C.red},{l:"TEAMS",v:totalTeams,c:C.blue},{l:"PIT REPORTS",v:pits.length,c:C.amber}].map(s=>(
          <div key={s.l} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?14:18, fontWeight:700, color:s.c }}>{s.v}</div>
            <div style={{ fontSize:9, color:C.dim, fontFamily:"monospace", letterSpacing:1 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom:`1px solid ${C.border}`, background:"rgba(8,10,15,0.8)", display:"flex", overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        {TABS.map(t=>(
          <button key={t.id} type="button" onClick={()=>setTab(t.id)} style={{ padding: isMobile?"11px 12px":"13px 18px", border:"none", borderBottom:`2px solid ${tab===t.id?C.red:"transparent"}`, background:"transparent", color:tab===t.id?C.text:C.dim, cursor:"pointer", fontFamily:"'Orbitron',sans-serif", fontSize:isMobile?9:11, fontWeight:700, letterSpacing:1, whiteSpace:"nowrap", transition:"all 0.15s", touchAction:"manipulation", flexShrink:0 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth:900, margin:"0 auto", padding: isMobile?"18px 14px":"28px 20px", position:"relative", zIndex:1 }}>
        {tab==="match" && <MatchScout onSubmit={()=>{loadAll();showToast("✅ Match submitted!");}} username={username} cfg={gameConfig} isMobile={isMobile} />}
        {tab==="pit" && <PitScout onSubmit={()=>{loadAll();showToast("✅ Pit report saved!");}} username={username} isMobile={isMobile} />}
        {tab==="maps" && <MapsView2 competitions={competitions} pits={pits} matches={matches} cfg={gameConfig} isMobile={isMobile} />}
        {tab==="teamstats" && <TeamStatsAnalysis competitions={competitions} />}
        {tab==="data" && <TeamData matches={matches} pits={pits} cfg={gameConfig} isMobile={isMobile} />}
        {tab==="picklist" && <Picklist matches={matches} picklist={picklist} onReload={loadAll} cfg={gameConfig} isMobile={isMobile} />}
        {tab==="raw" && <RawData matches={matches} onDelete={deleteMatch} cfg={gameConfig} isMobile={isMobile} />}
      </div>
    </div>
  );
}
