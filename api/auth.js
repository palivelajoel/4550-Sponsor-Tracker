import { d1SelectOne } from './_gateway.js';
import { createToken, verifyPassword, hashPassword } from './_shared.js';

export default async function handler(req, res) {
  const path = req.url.split('/').pop().split('?')[0];

  try {
    if (path === 'admin-logout') {
      res.setHeader('Set-Cookie', `admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const member = await d1SelectOne('members', { filters: [{ col: 'username', op: 'eq', value: username }] });

    if (!member) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!member.password_hash) return res.status(401).json({ error: 'Invalid credentials.' });

    if (path === 'admin-login' && member.role !== 'Admin') return res.status(403).json({ error: 'Forbidden: not an admin.' });

    if (!verifyPassword(password, member.password_hash)) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = createToken({ userId: member.id, role: member.role, username: member.username });
    return res.status(200).json({
      token,
      user: { id: member.id, username: member.username, role: member.role, full_name: member.full_name, subteam: member.subteam },
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
