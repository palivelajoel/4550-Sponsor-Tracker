import { d1Select, d1SelectOne, d1Insert, d1InsertMany, d1Update, d1Delete, d1Upsert } from './_gateway.js';
import { verifyToken, getTokenFromRequest, hashPassword } from './_shared.js';

const ADMIN_TABLES = ['sponsors', 'sponsor_notes', 'captains', 'site_config', 'members', 'hub_tasks', 'suggestions', 'hub_calendar', 'inventory_items', 'inventory_transactions', 'articles', 'hub_media', 'hub_resources', 'hub_forms', 'hub_form_submissions', 'hub_announcements', 'competitions'];
const HUB_TABLES = ['hub_tasks', 'inventory_items', 'inventory_transactions', 'hub_announcements', 'hub_media', 'hub_resources', 'sponsors', 'sponsor_notes', 'hub_forms', 'hub_form_submissions', 'articles', 'site_config', 'hub_calendar', 'competitions'];

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

    const INVENTORY_TABLES = ['inventory_items', 'inventory_transactions'];
    const { table: reqTable } = req.body || {};
    const isInventoryTable = INVENTORY_TABLES.includes(reqTable);

    if (isHub && !['Captain', 'Admin'].includes(payload.role)) {
      if (payload.role === 'Member' && isInventoryTable) {
        const memberRow = await d1SelectOne('members', { filters: [{ col: 'id', op: 'eq', value: payload.userId }] });
        if (memberRow?.subteam !== 'Build') {
          return res.status(403).json({ error: 'Forbidden: build team membership required for inventory' });
        }
      } else {
        return res.status(403).json({ error: 'Forbidden: captain or admin role required' });
      }
    }

    const { table, action, payload: bodyPayload } = req.body || {};

    if (action === 'upload') {
      return res.status(400).json({ error: 'Uploads now go to /api/upload (GitHub)' });
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
      await d1Update('members', [{ col: 'id', op: 'eq', value: id }], upd);
      const upData = await d1SelectOne('members', { filters: [{ col: 'id', op: 'eq', value: id }] });
      return res.status(200).json({ data: upData ? [upData] : [] });
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
      const d1Filters = filters && typeof filters === 'object'
        ? Object.entries(filters).map(([k, v]) => ({ col: k, op: 'eq', value: v }))
        : [];
      const data = await d1Select(table, {
        filters: d1Filters,
        order: order ? [{ col: order.column || 'created_at', asc: !!order.ascending }] : undefined,
        limit: selLimit || undefined,
      });
      return res.status(200).json({ data });
    }

    if (action === 'insert') {
      let dataPayload = bodyPayload;
      if (table === 'members' && bodyPayload?.password) {
        dataPayload = { ...bodyPayload, password_hash: hashPassword(bodyPayload.password) };
        delete dataPayload.password;
      }
      if (isHub && !Array.isArray(dataPayload) && dataPayload.added_by === undefined && table === 'inventory_items') {
        dataPayload = { ...dataPayload, added_by: payload.userId };
      }
      if (Array.isArray(dataPayload)) {
        await d1InsertMany(table, dataPayload);
        return res.status(200).json({ data: [] });
      }
      const ins = await d1Insert(table, dataPayload);
      const row = ins?.id != null
        ? await d1SelectOne(table, { filters: [{ col: 'id', op: 'eq', value: ins.id }] })
        : null;
      return res.status(200).json({ data: row ? [row] : [] });
    }

    if (action === 'update') {
      const { id, updates } = bodyPayload || {};
      if (!id || !updates) return res.status(400).json({ error: 'Missing id or updates' });
      await d1Update(table, [{ col: 'id', op: 'eq', value: id }], updates);
      const data = await d1SelectOne(table, { filters: [{ col: 'id', op: 'eq', value: id }] });
      return res.status(200).json({ data: data ? [data] : [] });
    }

    if (action === 'delete') {
      const { id } = bodyPayload || {};
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await d1Delete(table, [{ col: 'id', op: 'eq', value: id }]);
      return res.status(200).json({ data: [{ id }] });
    }

    if (action === 'upsert') {
      const { key, value } = bodyPayload || {};
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const data = await d1Upsert(table, [{ col: 'key', op: 'eq', value: key }], { key, value });
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'Unsupported' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
