import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';
import { hashAccessToken, addCustomerReply, reopenTicket } from './ticketCommands.js';

async function access(number, token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) throw new HttpError(401, 'Invalid customer ticket access token.');
  const ticket = await prisma.ticket.findUnique({ where: { ticketNumber: number }, select: { id: true, customerEmail: true, customerTokenHash: true } });
  // Do not distinguish invalid ticket numbers from invalid secret tokens.
  const known = ticket?.customerTokenHash || '0'.repeat(64);
  const supplied = hashAccessToken(token);
  if (!crypto.timingSafeEqual(Buffer.from(known), Buffer.from(supplied)) || !ticket) throw new HttpError(404, 'Ticket not found or access denied.');
  return ticket;
}

export async function publicTicket(number, token) {
  const ticket = await access(number, token);
  // Explicit allowlist: NEVER select visibility=INTERNAL or event details here.
  return prisma.ticket.findUnique({ where: { id: ticket.id }, select: {
    ticketNumber: true, title: true, description: true, customerName: true, status: true, priority: true, createdAt: true, reopenUntil: true,
    messages: { where: { visibility: 'PUBLIC' }, orderBy: { createdAt: 'asc' }, select: { id: true, body: true, senderType: true, createdAt: true, author: { select: { name: true } } } }
  } });
}
export async function publicReply(number, token, body) {
  const ticket = await access(number, token);
  return addCustomerReply(ticket.id, body, `Customer: ${ticket.customerEmail}`);
}
export async function publicReopen(number, token) {
  const ticket = await access(number, token);
  await reopenTicket(ticket.id, null, `Customer: ${ticket.customerEmail}`);
  return { status: 'IN_PROGRESS' };
}
