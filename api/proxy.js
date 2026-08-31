import { createClient } from '@supabase/supabase-js';
import { verifyToken, getTokenFromRequest, hashPassword } from './_shared.js';

const ADMIN_TABLES = ['sponsors', 'captains', 'site_config', 'members', 'hub_tasks', 'suggestions', 'hub_calendar', 'inventory_items', 'articles'];
const HUB_TABLES = ['hub_tasks', 'inventory_items', 'inventory_transactions', 'hub_announcements', 'hub_media', 'hub_resources', 'sponsors', 'sponsor_notes', 'hub_forms', 'hub_form_submissions', 'articles', 'site_config'];

const HUB_CONFIG_KEYS = ['media_folders'];

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

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

    const INVENTORY_TABLES = ['inventory_items', 'inventory_transactions'];
    const { table: reqTable } = req.body || {};
    const isInventoryTable = INVENTORY_TABLES.includes(reqTable);

    if (isHub && !['Captain', 'Admin'].includes(payload.role)) {
      if (payload.role === 'Member' && isInventoryTable) {
        const { data: memberRow } = await supabase.from('members').select('subteam').eq('id', payload.userId).maybeSingle();
        if (memberRow?.subteam !== 'Build') {
          return res.status(403).json({ error: 'Forbidden: build team membership required for inventory' });
        }
      } else {
        return res.status(403).json({ error: 'Forbidden: captain or admin role required' });
      }
    }

    const { table, action, payload: bodyPayload } = req.body || {};

    if (action === 'upload') {
      const { bucket, fileName, base64, contentType } = bodyPayload || {};
      if (!bucket || !fileName || !base64) return res.status(400).json({ error: 'Missing upload data' });
      if (!['team-assets', 'inventory-images', 'team-media'].includes(bucket)) return res.status(400).json({ error: 'Unsupported bucket' });
      const buf = Buffer.from(base64, 'base64');
      if (!buf.length) return res.status(400).json({ error: 'Empty file data' });
      const opts = { contentType: contentType || 'application/octet-stream', upsert: true };
      let { data, error } = await supabase.storage.from(bucket).upload(fileName, buf, opts);
      if (error && /bucket|not found|not exist/i.test(error.message)) {
        try { await supabase.storage.createBucket(bucket, { public: true }); } catch {}
        ({ data, error } = await supabase.storage.from(bucket).upload(fileName, buf, opts));
      }
      try { await supabase.storage.updateBucket(bucket, { public: true }); } catch {}
      if (error) return res.status(500).json({ error: error.message });
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data?.path || fileName);
      return res.status(200).json({ data: { url: pub.publicUrl } });
    }

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

    if (isHub && table === 'site_config' && action !== 'select') {
      const cfgKey = bodyPayload?.key || (action === 'upsert' ? bodyPayload?.key : null);
      if (!cfgKey || !HUB_CONFIG_KEYS.includes(cfgKey)) {
        return res.status(403).json({ error: 'Forbidden: cannot modify that config key' });
      }
    }
    if (isHub && table === 'site_config' && action === 'select' && bodyPayload?.key && !HUB_CONFIG_KEYS.includes(bodyPayload.key)) {
      return res.status(403).json({ error: 'Forbidden: cannot read that config key' });
    }

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
