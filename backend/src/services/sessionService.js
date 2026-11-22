import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

export const SESSION_COOKIE_NAME = env.sessionCookieName;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production', maxAge: env.sessionTtlHours * 60 * 60 * 1000, path: '/' });

export function publicUser(agent) { return { id: agent.id, name: agent.name, email: agent.email, role: agent.role, isDemo: agent.isDemo }; }

export async function createSession(agent, response) {
  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.session.create({ data: { tokenHash: hashToken(token), agentId: agent.id, expiresAt: new Date(Date.now() + env.sessionTtlHours * 60 * 60 * 1000) } });
  response.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
  return publicUser(agent);
}

export async function endSession(request, response) {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: env.nodeEnv === 'production', path: '/' });
}

export async function getSessionUser(request) {
  const token = request.cookies?.[SESSION_COOKIE_NAME];
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { agent: true } });
  if (!session || session.expiresAt <= new Date() || !session.agent.isActive) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return session.agent;
}
