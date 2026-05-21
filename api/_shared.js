import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
export function createToken(payload) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const data = { ...payload, iat: now };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64(header), p = b64(data);
  const s = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

export function verifyToken(token) {
  if (!JWT_SECRET) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, sig] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = crypto.scryptSync(password, salt, 64).toString('base64');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const idx = stored.indexOf(':');
  if (idx === -1) return false;
  const salt = stored.slice(0, idx);
  const hash = stored.slice(idx + 1);
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('base64');
  return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(hash));
}

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}
