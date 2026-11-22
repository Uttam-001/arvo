import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { ticketSlaState } from './sla.js';
import { canReopen } from './ticketPolicies.js';
import { ticketAgent } from './ticketCommands.js';

export function presentTicket(ticket) {
  if (!ticket) return null;
  const { customerTokenHash, ...safe } = ticket; // Never return even the hash to an API caller.
  return { ...safe, sla: ticketSlaState(ticket), canReopen: !!canReopen(ticket) };
}

export async function listTickets(query, user) {
  const { q, status, priority, scope, overdue } = query;
  const page = Math.max(1, Math.min(100000, Number.parseInt(query.page, 10) || 1));
  const pageSize = 50;
  const where = {};
  if (['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'].includes(status)) where.status = status;
  if (['URGENT', 'MEDIUM', 'LOW'].includes(priority)) where.priority = priority;
  if (scope === 'mine') where.assignedAgentId = user.id;
  if (scope === 'unassigned') where.assignedAgentId = null;
  if (scope === 'waiting') where.status = 'WAITING_ON_CUSTOMER';
  if (typeof q === 'string' && q.trim()) {
    const search = q.trim().slice(0, 120);
    where.OR = ['ticketNumber', 'title', 'customerName', 'customerEmail'].map((key) => ({ [key]: { contains: search } }));
  }
  if (scope === 'overdue' || overdue === 'true') {
    where.AND = [{ status: { notIn: ['RESOLVED', 'CLOSED'] } }, { slaPausedAt: null },
      { OR: [{ firstResponseAt: null, slaFirstResponseDueAt: { lt: new Date() } }, { slaResolutionDueAt: { lt: new Date() } }] }];
  }
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], include: { assignedAgent: ticketAgent } }),
    prisma.ticket.count({ where })
  ]);
  return { tickets: tickets.map(presentTicket), total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getTicket(id) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: {
    assignedAgent: ticketAgent,
    messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true } } } },
    events: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
    slaPauses: { orderBy: { startedAt: 'asc' } }
  } });
  if (!ticket) throw new HttpError(404, 'Ticket not found.');
  return presentTicket(ticket);
}

export async function getStats(user) {
  const all = await prisma.ticket.findMany({ select: { status: true, assignedAgentId: true, slaPausedAt: true, firstResponseAt: true, slaFirstResponseDueAt: true, slaResolutionDueAt: true, resolvedAt: true } });
  const now = new Date();
  const overdue = (ticket) => !ticket.slaPausedAt && !['RESOLVED', 'CLOSED'].includes(ticket.status) && ((!ticket.firstResponseAt && ticket.slaFirstResponseDueAt < now) || ticket.slaResolutionDueAt < now);
  const resolved = all.filter((t) => t.resolvedAt);
  return {
    total: all.length, open: all.filter((t) => t.status === 'OPEN').length,
    inProgress: all.filter((t) => t.status === 'IN_PROGRESS').length,
    mine: all.filter((t) => t.assignedAgentId === user.id && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
    waiting: all.filter((t) => t.status === 'WAITING_ON_CUSTOMER').length,
    resolved: all.filter((t) => t.status === 'RESOLVED').length,
    closed: all.filter((t) => t.status === 'CLOSED').length,
    overdue: all.filter(overdue).length,
    slaCompliance: resolved.length ? Math.round(resolved.filter((t) => t.resolvedAt <= t.slaResolutionDueAt).length / resolved.length * 100) : null
  };
}
