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

    const { formTitle, questions, answers, submittedBy, timestamp } = req.body || {};
    if (!formTitle || !answers) return res.status(400).json({ error: 'Missing formTitle or answers' });

    const sheets = google.sheets({ version: 'v4', auth });

    // Build the row: Form, Submitter, Timestamp, then each question's answer
    const row = [
      formTitle,
      submittedBy || '',
      timestamp || new Date().toISOString(),
      ...questions.map(q => {
        const ans = answers[q.id];
        return Array.isArray(ans) ? ans.join(', ') : (ans || '');
      }),
    ];

    // Build header row if sheet is empty: Form, Submitter, Timestamp, Q1, Q2, ...
    const header = ['Form', 'Submitter', 'Timestamp', ...questions.map(q => q.label)];

    // Try to read first row to check if header exists
    let needsHeader = false;
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Form Submissions!A1:Z1',
      });
      if (!existing.data.values || existing.data.values.length === 0) {
        needsHeader = true;
      }
    } catch {
      // Sheet or tab doesn't exist yet — we'll create it with the header
      needsHeader = true;
    }

    const values = needsHeader ? [header, row] : [row];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Form Submissions!A:A',
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
