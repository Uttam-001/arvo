import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { route } from '../lib/errors.js';
import { requireAuth } from '../middleware/agentAuth.js';
import { createSession, endSession, publicUser } from '../services/sessionService.js';

export const authRouter = Router();
const demoLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: 'draft-7', legacyHeaders: false });
authRouter.get('/csrf', (req, res) => res.json({ csrfToken: req.csrfToken }));
authRouter.get('/demo-agents', route(async (_req, res) => {
  if (!env.demoModeEnabled) return res.status(403).json({ error: 'Demo mode disabled.' });
  const agents = await prisma.agent.findMany({ where: { isActive: true, isDemo: true }, select: { name: true, email: true, role: true }, orderBy: { name: 'asc' } });
  res.json({ agents });
}));
authRouter.post('/demo', demoLimiter, route(async (req, res) => {
  if (!env.demoModeEnabled) return res.status(403).json({ error: 'Demo mode disabled.' });
  const email = req.body?.email;
  if (typeof email !== 'string') return res.status(422).json({ error: 'Choose an agent.' });
  const agent = await prisma.agent.findFirst({ where: { email, isActive: true, isDemo: true } });
  if (!agent) return res.status(401).json({ error: 'Demo account not found.' });
  await endSession(req, res);
  res.json({ user: await createSession(agent, res) });
}));
authRouter.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
authRouter.post('/logout', route(async (req, res) => { await endSession(req, res); res.status(204).end(); }));
