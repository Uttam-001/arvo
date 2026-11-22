import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { addBusinessMinutes, businessMinutesBetween, getSlaDeadlines, workingWeekMinutes } from './sla.js';
import { recordEvent } from './audit.js';
import { assertManager, assertActive, assertCanReopen } from './ticketPolicies.js';

export const hashAccessToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const holidayDates = (db = prisma) => db.holiday.findMany({ select: { holidayDate: true } });
export const ticketAgent = { select: { id: true, name: true, email: true } };

async function lockedTicket(tx, id) {
  // Explicit row lock prevents lost updates to status, deadlines, messages, and audit history.
  const rows = await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new HttpError(404, 'Ticket not found.');
  return tx.ticket.findUnique({ where: { id } });
}
const ticketView = (tx, id) => tx.ticket.findUnique({ where: { id }, include: { assignedAgent: ticketAgent } });

export async function createTicket(input, user) {
  const now = new Date();
  const holidays = await holidayDates();
  const deadlines = getSlaDeadlines(input.priority || 'MEDIUM', now, holidays);
  const accessToken = crypto.randomBytes(32).toString('base64url');
  const number = `FD-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const customer = input.customerId ? await prisma.customer.findUnique({ where: { id: input.customerId } }) : null;
  if (input.customerId && !customer) throw new HttpError(422, 'Customer not found.');
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({ data: {
      ticketNumber: number, customerName: customer?.name || input.customerName,
      customerEmail: (customer?.email || input.customerEmail).toLowerCase(),
      customerReference: input.customerReference || customer?.company || null,
      customerId: customer?.id || null, customerTokenHash: hashAccessToken(accessToken),
      title: input.title, description: input.description, priority: input.priority || 'MEDIUM',
      slaFirstResponseDueAt: deadlines.firstResponseDueAt, slaResolutionDueAt: deadlines.resolutionDueAt,
      createdAt: now
    } });
    await recordEvent(tx, created.id, user, 'TICKET_CREATED', { ticketNumber: number, title: input.title, description: input.description, customerEmail: created.customerEmail, priority: created.priority, responseDueAt: deadlines.firstResponseDueAt, resolutionDueAt: deadlines.resolutionDueAt });
    return ticketView(tx, created.id);
  });
  return { ticket, accessToken }; // Only returned once to the creating agent; DB retains the SHA-256 hash.
}

export async function claimTicket(id, user) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.ticket.updateMany({ where: { id, assignedAgentId: null, status: { in: ['OPEN', 'IN_PROGRESS'] } }, data: { assignedAgentId: user.id, status: 'IN_PROGRESS' } });
    if (count.count !== 1) throw new HttpError(409, 'Ticket is already claimed or cannot be claimed.');
    await recordEvent(tx, id, user, 'TICKET_CLAIMED', { agentId: user.id });
    await recordEvent(tx, id, user, 'STATUS_CHANGED', { to: 'IN_PROGRESS', reason: 'claim' });
    return ticketView(tx, id);
  });
}

export async function assignTicket(id, assigneeId, user) {
  if (user.role !== 'SUPPORT_LEAD') throw new HttpError(403, 'Only the support lead can reassign tickets.');
  return prisma.$transaction(async (tx) => {
    const ticket = await lockedTicket(tx, id);
    assertActive(ticket);
    const agent = await tx.agent.findFirst({ where: { id: assigneeId, isActive: true }, select: { id: true } });
    if (!agent) throw new HttpError(422, 'Assignee must be an active agent.');
    await tx.ticket.update({ where: { id }, data: { assignedAgentId: assigneeId, status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status } });
    await recordEvent(tx, id, user, 'ASSIGNMENT_CHANGED', { from: ticket.assignedAgentId, to: assigneeId });
    if (ticket.status === 'OPEN') await recordEvent(tx, id, user, 'STATUS_CHANGED', { from: 'OPEN', to: 'IN_PROGRESS' });
    return ticketView(tx, id);
  });
}

async function pauseSla(tx, ticket, user, now, holidays) {
  if (ticket.slaPausedAt) return ticket;
  const due = addBusinessMinutes(now, workingWeekMinutes, holidays);
  await tx.ticketSlaPause.create({ data: { ticketId: ticket.id, startedAt: now, reason: 'Waiting for customer reply' } });
  await recordEvent(tx, ticket.id, user, 'SLA_PAUSED', { pauseStartedAt: now, autoCloseDueAt: due });
  return tx.ticket.update({ where: { id: ticket.id }, data: { slaPausedAt: now, waitingSince: now, autoCloseDueAt: due } });
}

async function resumeSla(tx, ticket, user, now, holidays, label = null) {
  if (!ticket.slaPausedAt) return ticket;
  const elapsed = businessMinutesBetween(ticket.slaPausedAt, now, holidays);
  await tx.ticketSlaPause.updateMany({ where: { ticketId: ticket.id, endedAt: null }, data: { endedAt: now } });
  const data = { slaPausedAt: null, waitingSince: null, autoCloseDueAt: null, slaPausedMinutes: { increment: elapsed },
    slaResolutionDueAt: addBusinessMinutes(ticket.slaResolutionDueAt, elapsed, holidays),
    ...(!ticket.firstResponseAt && { slaFirstResponseDueAt: addBusinessMinutes(ticket.slaFirstResponseDueAt, elapsed, holidays) })
  };
  await recordEvent(tx, ticket.id, user, 'SLA_RESUMED', { waitingBusinessMinutes: elapsed }, label);
  return tx.ticket.update({ where: { id: ticket.id }, data });
}

export async function updateTicket(id, changes, user) {
  const now = new Date(); const holidays = await holidayDates();
  return prisma.$transaction(async (tx) => {
    let ticket = await lockedTicket(tx, id);
    assertManager(ticket, user); assertActive(ticket);
    if (changes.priority && changes.priority !== ticket.priority) {
      const previous = ticket.priority;
      const deadlines = getSlaDeadlines(changes.priority, now, holidays);
      if (ticket.slaPausedAt) {
        // Preserve the waiting clock but start a fresh paused SLA from this priority change.
        const elapsed = businessMinutesBetween(ticket.slaPausedAt, now, holidays);
        await tx.ticketSlaPause.updateMany({ where: { ticketId: id, endedAt: null }, data: { endedAt: now } });
        await tx.ticketSlaPause.create({ data: { ticketId: id, startedAt: now, reason: 'Priority recalculation during customer wait' } });
        ticket = await tx.ticket.update({ where: { id }, data: { slaPausedAt: now, slaPausedMinutes: { increment: elapsed } } });
      }
      ticket = await tx.ticket.update({ where: { id }, data: { priority: changes.priority,
        ...(!ticket.firstResponseAt && { slaFirstResponseDueAt: deadlines.firstResponseDueAt }),
        slaResolutionDueAt: deadlines.resolutionDueAt
      } });
      await recordEvent(tx, id, user, 'PRIORITY_CHANGED', { from: previous, to: changes.priority,
        policy: 'SLA resets from change instant; existing first reply remains credited; if waiting, new SLA stays paused',
        responseDueAt: !ticket.firstResponseAt ? deadlines.firstResponseDueAt : null, resolutionDueAt: deadlines.resolutionDueAt });
    }
    if (changes.status && changes.status !== ticket.status) {
      if (!['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'].includes(changes.status)) throw new HttpError(422, 'Use resolve/reopen workflow for terminal states.');
      const previous = ticket.status;
      if (changes.status === 'WAITING_ON_CUSTOMER') ticket = await pauseSla(tx, ticket, user, now, holidays);
      else if (previous === 'WAITING_ON_CUSTOMER') ticket = await resumeSla(tx, ticket, user, now, holidays);
      ticket = await tx.ticket.update({ where: { id }, data: { status: changes.status } });
      await recordEvent(tx, id, user, 'STATUS_CHANGED', { from: previous, to: changes.status });
    }
    return ticketView(tx, id);
  });
}

export async function addAgentMessage(id, user, { body, visibility }) {
  const now = new Date(); const holidays = await holidayDates();
  return prisma.$transaction(async (tx) => {
    const ticket = await lockedTicket(tx, id);
    assertManager(ticket, user); assertActive(ticket);
    const kind = visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC';
    const message = await tx.message.create({ data: { ticketId: id, authorId: user.id, senderType: 'AGENT', visibility: kind, body, createdAt: now },
      include: { author: { select: { name: true } } } });
    if (kind === 'PUBLIC' && !ticket.firstResponseAt) {
      const wait = ticket.slaPausedAt ? businessMinutesBetween(ticket.slaPausedAt, now, holidays) : 0;
      await tx.ticket.update({ where: { id }, data: {
        firstResponseAt: now,
        slaFirstResponseDueAt: addBusinessMinutes(ticket.slaFirstResponseDueAt, wait, holidays),
        ...(ticket.status === 'OPEN' && { status: 'IN_PROGRESS' })
      } });
      if (ticket.status === 'OPEN') await recordEvent(tx, id, user, 'STATUS_CHANGED', { from: 'OPEN', to: 'IN_PROGRESS', reason: 'first public reply' });
    }
    await recordEvent(tx, id, user, kind === 'INTERNAL' ? 'INTERNAL_NOTE_POSTED' : 'PUBLIC_REPLY_POSTED', { messageId: message.id });
    return message;
  });
}

export async function resolveTicket(id, user) {
  const now = new Date(); const holidays = await holidayDates();
  return prisma.$transaction(async (tx) => {
    const ticket = await lockedTicket(tx, id);
    assertManager(ticket, user); assertActive(ticket);
    if (ticket.slaPausedAt) await resumeSla(tx, ticket, user, now, holidays);
    const reopenUntil = addBusinessMinutes(now, workingWeekMinutes, holidays);
    await tx.ticket.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: now, reopenUntil, closedAt: null, slaPausedAt: null, waitingSince: null, autoCloseDueAt: null } });
    await recordEvent(tx, id, user, 'TICKET_RESOLVED', { reopenUntil, previousStatus: ticket.status });
    return ticketView(tx, id);
  });
}

export async function reopenTicket(id, user = null, customerLabel = null) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const ticket = await lockedTicket(tx, id);
    if (user) assertManager(ticket, user);
    assertCanReopen(ticket, now);
    await tx.ticket.update({ where: { id }, data: { status: 'IN_PROGRESS', resolvedAt: null, closedAt: null, reopenUntil: null } });
    await recordEvent(tx, id, user, 'TICKET_REOPENED', { from: 'RESOLVED', to: 'IN_PROGRESS' }, customerLabel);
    return ticketView(tx, id);
  });
}

export async function addCustomerReply(ticketId, body, label) {
  const now = new Date(); const holidays = await holidayDates();
  return prisma.$transaction(async (tx) => {
    let ticket = await lockedTicket(tx, ticketId);
    assertActive(ticket); // resolved tickets must explicitly reopen; closed tickets never reopen.
    if (ticket.status === 'WAITING_ON_CUSTOMER' && ticket.autoCloseDueAt && ticket.autoCloseDueAt <= now) {
      throw new HttpError(409, 'The customer reply window has expired. Contact support to create a new ticket.');
    }
    if (ticket.status === 'WAITING_ON_CUSTOMER') ticket = await resumeSla(tx, ticket, null, now, holidays, label);
    const message = await tx.message.create({ data: { ticketId, body, senderType: 'CUSTOMER', visibility: 'PUBLIC', createdAt: now } });
    if (ticket.status !== 'IN_PROGRESS') {
      await tx.ticket.update({ where: { id: ticketId }, data: { status: 'IN_PROGRESS' } });
      await recordEvent(tx, ticketId, null, 'STATUS_CHANGED', { from: ticket.status, to: 'IN_PROGRESS', reason: 'customer replied' }, label);
    }
    await recordEvent(tx, ticketId, null, 'CUSTOMER_REPLIED', { messageId: message.id }, label);
    return message;
  });
}

export async function autoCloseWaitingTickets(now = new Date()) {
  const candidates = await prisma.ticket.findMany({ where: { status: 'WAITING_ON_CUSTOMER', autoCloseDueAt: { lte: now } }, select: { id: true } });
  let count = 0;
  for (const candidate of candidates) {
    count += await prisma.$transaction(async (tx) => {
      const ticket = await lockedTicket(tx, candidate.id);
      if (ticket.status !== 'WAITING_ON_CUSTOMER' || !ticket.autoCloseDueAt || ticket.autoCloseDueAt > now) return 0;
      await tx.ticketSlaPause.updateMany({ where: { ticketId: ticket.id, endedAt: null }, data: { endedAt: now } });
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED', closedAt: now, slaPausedAt: null, autoCloseDueAt: null, waitingSince: null } });
      await recordEvent(tx, ticket.id, null, 'TICKET_AUTO_CLOSED', { reason: 'No reply after 45 working hours', dueAt: ticket.autoCloseDueAt });
      return 1;
    });
  }
  return count;
}
