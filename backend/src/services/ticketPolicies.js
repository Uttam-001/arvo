import { HttpError } from '../lib/errors.js';

export const PRIORITIES = ['URGENT', 'MEDIUM', 'LOW'];
export const STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED'];
export const ACTIVE = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'];

export function assertManager(ticket, user) {
  if (user.role !== 'SUPPORT_LEAD' && ticket.assignedAgentId !== user.id) {
    throw new HttpError(403, 'Claim this ticket before editing it, or ask your lead to assign it.');
  }
}
export function assertActive(ticket, now = new Date()) {
  if (!ACTIVE.includes(ticket.status)) throw new HttpError(409, 'Ticket is resolved or closed. Reopen within the permitted window or create a new ticket.');
  if (ticket.status === 'WAITING_ON_CUSTOMER' && ticket.autoCloseDueAt && new Date(ticket.autoCloseDueAt) <= now) {
    throw new HttpError(409, 'Customer waiting period expired. This ticket must close and a new ticket must be created.');
  }
}
export function canReopen(ticket, now = new Date()) {
  return ticket.status === 'RESOLVED' && ticket.reopenUntil && new Date(ticket.reopenUntil) >= now;
}
export function assertCanReopen(ticket, now = new Date()) {
  if (!canReopen(ticket, now)) throw new HttpError(409, 'Only resolved tickets within one working week can reopen. Closed or expired tickets require a new ticket.');
}
