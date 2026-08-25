import { google } from 'googleapis';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) return null;
  return new google.auth.JWT(email, null, key, ['https://www.googleapis.com/auth/spreadsheets']);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = getAuth();
    if (!auth) return res.status(500).json({ error: 'Google Sheets not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY env vars.' });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) return res.status(500).json({ error: 'GOOGLE_SHEET_ID env var not set.' });

    const { formTitle, questions, answers, submittedBy, timestamp, action } = req.body || {};

    const sheets = google.sheets({ version: 'v4', auth });

    if (action === 'test') {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const tabs = meta.data.sheets.map(s => s.properties.title);
      return res.status(200).json({ ok: true, spreadsheet: meta.data.properties.title, tabs });
    }

    if (!formTitle || !answers) return res.status(400).json({ error: 'Missing formTitle or answers' });

    // Tab name = form title, sanitized for Google Sheets (max 100 chars, no : \ / ? * [ ])
    const tabName = (formTitle || 'Form Submissions')
      .replace(/[:\\/?*[\]]/g, ' ')
      .trim()
      .slice(0, 100) || 'Form Submissions';

    // Build the row: Submitter, Timestamp, then each question's answer
    const row = [
      submittedBy || '',
      timestamp || new Date().toISOString(),
      ...questions.map(q => {
        const ans = answers[q.id];
        return Array.isArray(ans) ? ans.join(', ') : (ans || '');
      }),
    ];

    // Build header row if tab is empty: Submitter, Timestamp, Q1, Q2, ...
    const header = ['Submitter', 'Timestamp', ...questions.map(q => q.label)];

    // Try to read first row to check if header exists
    let needsHeader = false;
    let tabExists = true;
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${tabName}'!A1:Z1`,
      });
      if (!existing.data.values || existing.data.values.length === 0) {
        needsHeader = true;
      }
    } catch {
      // Tab doesn't exist yet — create it below
      needsHeader = true;
      tabExists = false;
    }

    if (!tabExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });
    }

    const values = needsHeader ? [header, row] : [row];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${tabName}'!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Sheets sync error:', err);
    return res.status(500).json({ error: err.message || 'Sheets sync failed' });
  }
}
