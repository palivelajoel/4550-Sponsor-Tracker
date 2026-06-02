import { createClient } from '@supabase/supabase-js';
import { verifyToken, getTokenFromRequest, hashPassword } from './_shared.js';

const ADMIN_TABLES = ['sponsors', 'captains', 'site_config', 'members', 'hub_tasks', 'suggestions', 'hub_calendar', 'inventory_items', 'articles'];
const HUB_TABLES = ['hub_tasks', 'inventory_items', 'inventory_transactions', 'hub_announcements', 'hub_media', 'hub_resources', 'sponsors', 'sponsor_notes', 'hub_forms', 'hub_form_submissions', 'articles'];

export default async function handler(req, res) {
  try {
    const token = getTokenFromRequest(req) || req.body?.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized: missing token' });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

    const path = req.url.split('/').pop().split('?')[0];
    const isAdmin = path === 'admin-proxy';
    const isHub = path === 'hub-proxy';

    if (isAdmin && payload.role !== 'Admin') return res.status(403).json({ error: 'Forbidden: admin role required' });
    if (isHub && !['Captain', 'Admin'].includes(payload.role)) return res.status(403).json({ error: 'Forbidden: captain or admin role required' });

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

    const { table, action, payload: bodyPayload } = req.body || {};
    if (!table) return res.status(400).json({ error: 'Missing table' });

    const allowedTables = isAdmin ? ADMIN_TABLES : HUB_TABLES;
    if (!allowedTables.includes(table)) return res.status(400).json({ error: 'Invalid table' });

    if (isAdmin && table === 'members' && action === 'update_member') {
      const { id, updates } = bodyPayload || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const pw = updates?.password;
      const upd = { ...(updates || {}) };
      if (pw) {
        upd.password_hash = hashPassword(pw);
      }
      delete upd.password;
      const { data: upData, error: upErr } = await supabase.from('members').update(upd).eq('id', id).select();
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.status(200).json({ data: upData });
    }

    if (!['select', 'insert', 'update', 'delete', 'upsert'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    if (action === 'select') {
      const { filters, order, limit: selLimit } = bodyPayload || {};
      let query = supabase.from(table).select('*');
      if (filters && typeof filters === 'object') {
        Object.entries(filters).forEach(([k, v]) => { query = query.eq(k, v); });
      }
      if (order) query = query.order(order.column || 'created_at', { ascending: order.ascending ?? false });
      if (selLimit) query = query.limit(selLimit);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'insert') {
      let dataPayload = bodyPayload;
      if (table === 'members' && bodyPayload?.password) {
        dataPayload = { ...bodyPayload, password_hash: hashPassword(bodyPayload.password) };
        delete dataPayload.password;
      }
      if (isHub && dataPayload.added_by === undefined && table === 'inventory_items') {
        dataPayload = { ...dataPayload, added_by: payload.userId };
      }
      const { data, error } = await supabase.from(table).insert(dataPayload).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'update') {
      const { id, updates } = bodyPayload || {};
      if (!id || !updates) return res.status(400).json({ error: 'Missing id or updates' });
      const { data, error } = await supabase.from(table).update(updates).eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'delete') {
      const { id } = bodyPayload || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const { data, error } = await supabase.from(table).delete().eq('id', id).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    if (action === 'upsert') {
      const { key, value } = bodyPayload || {};
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const { data: existing, error: selErr } = await supabase.from(table).select('key').eq('key', key).maybeSingle();
      if (selErr) return res.status(500).json({ error: selErr.message });
      if (existing) {
        const { data, error } = await supabase.from(table).update({ value }).eq('key', key).select();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ data });
      }
      const { data, error } = await supabase.from(table).insert({ key, value }).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'Unsupported' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
