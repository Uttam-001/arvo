import crypto from 'node:crypto';
import { env } from '../config/env.js';

const options = () => ({ httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production', maxAge: env.sessionTtlHours * 3600_000, path: '/' });
const safeCompare = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function issueCsrfCookie(req, res, next) {
  req.csrfToken = req.cookies?.[env.csrfCookieName] || crypto.randomBytes(32).toString('base64url');
  if (!req.cookies?.[env.csrfCookieName]) res.cookie(env.csrfCookieName, req.csrfToken, options());
  next();
}
export function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!safeCompare(req.cookies?.[env.csrfCookieName], req.get('X-CSRF-Token'))) return res.status(403).json({ error: 'CSRF validation failed. Reload the page and try again.' });
  next();
}
