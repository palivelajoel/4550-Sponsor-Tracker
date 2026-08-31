import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { verifyToken, getTokenFromRequest } from './_shared.js';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) return null;
  return new google.auth.JWT(email, null, key, ['https://www.googleapis.com/auth/spreadsheets']);
}

// Trailing metadata columns written for every response so hub <-> sheet rows can be matched by id.
const META = ['Submission ID', 'Submitted By'];

// 1-based column number -> letters (1 -> A, 27 -> AA, ...)
function excelCol(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function tabName(formTitle) {
  return (formTitle || 'Form Submissions')
    .replace(/[:\\/?*[\]]/g, ' ')
    .trim()
    .slice(0, 100) || 'Form Submissions';
}

function canon(arr) {
  return JSON.stringify(arr.map(c => String(c ?? '')));
}

async function ensureTab(sheets, sheetId, tname) {
  try {
    const g = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${tname}'!A1:Z1` });
    return { created: false, firstRow: g.data.values?.[0] || null };
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tname } } }] },
    });
    return { created: true, firstRow: null };
  }
}

// Write the canonical header (Date, ...answer columns, Submission ID, Submitted By) unless
// the tab already has a matching/current header. Upgrades the old Date+answers header in place.
async function ensureHeader(sheets, sheetId, tname, header, qCount) {
  const { created, firstRow } = await ensureTab(sheets, sheetId, tname);
  const n = header.length;
  if (created || !firstRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tname}'!A1:${excelCol(n)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header] },
    });
    return;
  }
  const plainOld = firstRow.length === 1 + qCount && firstRow[0] === 'Date' && !firstRow.includes('Submission ID');
  if (plainOld) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `'${tname}'!A1:${excelCol(n)}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header] },
    });
  }
}

function answerCells(questions, answers) {
  return questions.map(q => {
    const a = answers?.[q.id];
    return Array.isArray(a) ? a.join(', ') : (a || '');
  });
}

async function fullSync(req, res, sheetId, sheets, body) {
  const token = getTokenFromRequest(req) || body.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized: missing token' });
  const payload = verifyToken(token);
  if (!payload || !['Captain', 'Admin'].includes(payload.role)) {
    return res.status(403).json({ error: 'Forbidden: captain or admin role required' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

  const { formId, questions: clientQuestions } = body;
  if (!formId) return res.status(400).json({ error: 'Missing formId' });

  const { data: form, error: fErr } = await supabase.from('hub_forms').select('*').eq('id', formId).maybeSingle();
  if (fErr) return res.status(500).json({ error: fErr.message });
  if (!form) return res.status(404).json({ error: 'Form not found' });

  const questions = Array.isArray(clientQuestions) && clientQuestions.length ? clientQuestions : (form.questions || []);
  const labels = questions.map(q => q.label);
  const header = ['Date', ...labels, ...META];
  const tname = tabName(form.title);

  const { data: subs, error: sErr } = await supabase
    .from('hub_form_submissions').select('*').eq('form_id', formId).order('created_at', { ascending: true });
  if (sErr) return res.status(500).json({ error: sErr.message });

  // Read the whole tab. If the tab doesn't exist yet, treat as empty.
  let allValues = [];
  try {
    const g = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `'${tname}'!A1:ZZ` });
    allValues = g.data.values || [];
  } catch { allValues = []; }

  let headers = [];
  const dataRows = []; // { rowIdx: 1-based sheet row, cells }
  if (allValues.length) {
    headers = allValues[0] || [];
    allValues.slice(1).forEach((cells, i) => dataRows.push({ rowIdx: i + 2, cells }));
  }

  let idCol = headers.indexOf('Submission ID');
  let byCol = headers.indexOf('Submitted By');
  if (idCol === -1) idCol = 1 + questions.length;
  if (byCol === -1) byCol = idCol + 1;

  const curIds = new Set();
  const contentMap = new Map(); // canonical answers -> first sheet row with that content
  for (const r of dataRows) {
    const id = String(r.cells[idCol] ?? '').trim();
    if (id) curIds.add(id);
    const key = canon(r.cells.slice(1, 1 + questions.length));
    if (!contentMap.has(key)) contentMap.set(key, r);
  }

  const stateKey = `sheet_sync_ids:${formId}`;
  let storedBaseline = new Set();
  const { data: stRows } = await supabase.from('site_config').select('value').eq('key', stateKey).maybeSingle();
  if (stRows?.value) {
    try { storedBaseline = new Set(JSON.parse(stRows.value)); } catch { storedBaseline = new Set(); }
  }

  // Merge stored baseline with current sheet IDs so first-sync deletions also work.
  // Anything currently in the sheet OR previously tracked is "known to have been mirrored".
  const prevIds = new Set([...storedBaseline, ...curIds]);

  const subCanon = s => canon(questions.map(q => String(s.answers?.[q.id] ?? '')));

  // 1) Propagate deletions: a hub submission is deleted only if it was previously mirrored
  //    (present in prevIds = stored baseline UNION current sheet ids) AND it no longer has
  //    either an id match OR an identical-content match in the CURRENT sheet.
  const removed = subs
    .filter(s => prevIds.has(s.id) && !curIds.has(s.id) && !contentMap.has(subCanon(s)))
    .map(s => s.id);
  if (removed.length) {
    const { error: dErr } = await supabase.from('hub_form_submissions').delete().in('id', removed);
    if (dErr) return res.status(500).json({ error: dErr.message });
  }
  const keptSubs = subs.filter(s => !removed.includes(s.id));

  // 2) Push submissions that are missing from the sheet (backfills legacy responses too).
  const toPush = keptSubs.filter(s => !curIds.has(s.id) && !contentMap.has(subCanon(s)));
  let pushed = 0;
  if (toPush.length) {
    await ensureHeader(sheets, sheetId, tname, header, questions.length);
    const rows = toPush.map(s => [
      String(s.created_at || '').slice(0, 10),
      ...answerCells(questions, s.answers),
      s.id,
      s.submitted_by || '',
    ]);
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${tname}'!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    });
    pushed = rows.length;
  }

  // 3) Import sheet rows added manually (no Submission ID) that don't match any hub submission.
  const curSubCanons = new Set(keptSubs.map(subCanon));
  const inserted = [];
  for (const r of dataRows) {
    const id = String(r.cells[idCol] ?? '').trim();
    if (id) continue;
    const key = canon(r.cells.slice(1, 1 + questions.length));
    if (curSubCanons.has(key)) continue;
    if (!r.cells.slice(1, 1 + questions.length).some(c => String(c ?? '').trim() !== '')) continue;
    const answers = {};
    questions.forEach((q, i) => { answers[q.id] = r.cells[1 + i] ?? ''; });
    const submittedBy = String(r.cells[byCol] ?? '').trim() || 'sheet-import';
    const { data: ins, error: inErr } = await supabase
      .from('hub_form_submissions')
      .insert({ form_id: formId, submitted_by: submittedBy, answers })
      .select('id');
    if (inErr) return res.status(500).json({ error: inErr.message });
    const newId = ins?.[0]?.id;
    if (newId) inserted.push({ newId, rowIdx: r.rowIdx });
  }
  if (inserted.length) {
    await ensureHeader(sheets, sheetId, tname, header, questions.length);
    const idRange = `'${tname}'!${excelCol(idCol + 1)}`;
    for (const { newId, rowIdx } of inserted) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${idRange}${rowIdx}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[newId]] },
      }).catch(() => {});
    }
  }

  // 4) Persist the now-known sheet ids as the deletion-detection baseline for the next sync.
  const nextIds = JSON.stringify([...curIds, ...toPush.map(s => s.id), ...inserted.map(x => x.newId)]);
  const { data: existingState } = await supabase.from('site_config').select('key').eq('key', stateKey).maybeSingle();
  if (existingState) {
    await supabase.from('site_config').update({ value: nextIds }).eq('key', stateKey);
  } else {
    await supabase.from('site_config').insert({ key: stateKey, value: nextIds });
  }

  return res.status(200).json({ ok: true, formId, total: keptSubs.length - removed.length + inserted.length, pushed, imported: inserted.length, removed: removed.length });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = getAuth();
    if (!auth) return res.status(500).json({ error: 'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY env vars.' });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEET_ID env var not set.' });

    const sheets = google.sheets({ version: 'v4', auth });
    const body = req.body || {};
    const { action, formTitle, questions, answers, submittedBy, timestamp, submissionId } = body;

    if (action === 'test') {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const tabs = meta.data.sheets.map(s => s.properties.title);
      return res.status(200).json({ ok: true, spreadsheet: meta.data.properties.title, tabs });
    }

    if (action === 'sync') return fullSync(req, res, sheetId, sheets, body);

    if (!formTitle || !answers) return res.status(400).json({ error: 'Missing formTitle or answers' });

    const tname = tabName(formTitle);
    const qs = Array.isArray(questions) ? questions : [];
    const header = ['Date', ...qs.map(q => q.label), ...META];

    const row = [
      new Date(timestamp || Date.now()).toISOString().slice(0, 10),
      ...answerCells(qs, answers),
      submissionId || '',
      submittedBy || '',
    ];

    await ensureHeader(sheets, sheetId, tname, header, qs.length);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${tname}'!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Sheets sync error:', err);
    return res.status(500).json({ error: err.message || 'Sheets sync failed' });
  }
}