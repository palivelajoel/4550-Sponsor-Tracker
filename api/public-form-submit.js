import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { formId, answers } = req.body || {};
    if (!formId || !answers) return res.status(400).json({ error: 'Missing formId or answers' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

    // Verify form exists and is public
    const { data: form, error: formErr } = await supabase
      .from('hub_forms')
      .select('id, visibility')
      .eq('id', formId)
      .maybeSingle();

    if (formErr || !form) return res.status(404).json({ error: 'Form not found' });
    if (form.visibility !== 'public') return res.status(403).json({ error: 'This form is not public' });

    // Insert submission
    const { data, error } = await supabase
      .from('hub_form_submissions')
      .insert({ form_id: formId, submitted_by: 'public', answers })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('Public form submit error:', err);
    return res.status(500).json({ error: err.message || 'Submit failed' });
  }
}
