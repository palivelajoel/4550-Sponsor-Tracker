import { d1SelectOne, d1Insert } from './_gateway.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { formId, answers } = req.body || {};
    if (!formId || !answers) return res.status(400).json({ error: 'Missing formId or answers' });

    // Verify form exists and is public
    const form = await d1SelectOne('hub_forms', { filters: [{ col: 'id', op: 'eq', value: Number(formId) }] });
    if (!form) return res.status(404).json({ error: 'Form not found' });
    if (form.visibility !== 'public') return res.status(403).json({ error: 'This form is not public' });

    // Insert submission
    const { id } = await d1Insert('hub_form_submissions', { form_id: Number(formId), submitted_by: 'public', answers });
    return res.status(200).json({ ok: true, data: [{ id }] });
  } catch (err) {
    console.error('Public form submit error:', err);
    return res.status(500).json({ error: err.message || 'Submit failed' });
  }
}
