import { createClient } from '@supabase/supabase-js';
import { verifyToken } from './_shared.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { table = 'sponsors', action, payload, token } = req.body || {};
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

  if (!['sponsors', 'sponsor_notes'].includes(table)) return res.status(400).json({ error: 'Invalid table' });

  try {
    if (action === 'insert') {
      const { data, error } = await supabase.from(table).insert(payload).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'update') {
      const { id, updates } = payload || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'delete') {
      const { id } = payload || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase.from(table).delete().eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
