import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { route } from '../lib/errors.js';
import { requireAuth, requireLead } from '../middleware/agentAuth.js';

export const agentRouter = Router();
agentRouter.use(requireAuth);
agentRouter.get('/', route(async (_req, res) => res.json({ agents: await prisma.agent.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } }) })));
agentRouter.get('/workload', requireLead, route(async (_req, res) => {
  const agents = await prisma.agent.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true,
    tickets: { select: { status: true, slaPausedAt: true, firstResponseAt: true, slaFirstResponseDueAt: true, slaResolutionDueAt: true } } }, orderBy: { name: 'asc' } });
  const now = new Date();
  res.json({ workload: agents.map((agent) => ({ id: agent.id, name: agent.name, role: agent.role,
    assigned: agent.tickets.filter((t) => !['CLOSED', 'RESOLVED'].includes(t.status)).length,
    resolved: agent.tickets.filter((t) => t.status === 'RESOLVED').length,
    overdue: agent.tickets.filter((t) => !t.slaPausedAt && !['RESOLVED', 'CLOSED'].includes(t.status) && ((!t.firstResponseAt && t.slaFirstResponseDueAt < now) || t.slaResolutionDueAt < now)).length
  })) });
}));
