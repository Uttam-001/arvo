import { Router } from 'express';
import { route, HttpError, requiredText, permitted } from '../lib/errors.js';
import { requireAuth, requireLead } from '../middleware/agentAuth.js';
import { PRIORITIES } from '../services/ticketPolicies.js';
import { createTicket, claimTicket, assignTicket, updateTicket, addAgentMessage, resolveTicket, reopenTicket, autoCloseWaitingTickets } from '../services/ticketCommands.js';
import { getStats, getTicket, listTickets, presentTicket } from '../services/ticketQueries.js';

export const ticketRouter = Router();
ticketRouter.use(requireAuth);

ticketRouter.get('/', route(async (req, res) => {
  await autoCloseWaitingTickets(); // Catch up after hosting sleeps or restarts.
  res.json(await listTickets(req.query, req.user));
}));
ticketRouter.get('/stats/overview', route(async (req, res) => { await autoCloseWaitingTickets(); res.json(await getStats(req.user)); }));
ticketRouter.get('/:id', route(async (req, res) => res.json(await getTicket(req.params.id))));
ticketRouter.post('/', route(async (req, res) => {
  const { customerId } = req.body || {};
  const input = { title: requiredText(req.body?.title, 'Title', 255), description: requiredText(req.body?.description, 'Description'),
    priority: permitted(req.body?.priority || 'MEDIUM', PRIORITIES, 'priority'), customerId: customerId || null,
    customerReference: req.body?.customerReference || null,
    customerName: customerId ? '' : requiredText(req.body?.customerName, 'Customer name', 120),
    customerEmail: customerId ? '' : requiredText(req.body?.customerEmail, 'Customer email', 191) };
  if (!customerId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail)) throw new HttpError(422, 'Invalid customer email.');
  const created = await createTicket(input, req.user);
  res.status(201).json({ ...presentTicket(created.ticket), customerAccessToken: created.accessToken });
}));
ticketRouter.post('/:id/claim', route(async (req, res) => res.json(presentTicket(await claimTicket(req.params.id, req.user)))));
ticketRouter.patch('/:id/assignment', requireLead, route(async (req, res) => res.json(presentTicket(await assignTicket(req.params.id, requiredText(req.body?.agentId, 'Agent ID', 36), req.user)))));
ticketRouter.patch('/:id', route(async (req, res) => {
  const changes = {};
  if (req.body?.priority !== undefined) changes.priority = permitted(req.body.priority, PRIORITIES, 'priority');
  if (req.body?.status !== undefined) changes.status = permitted(req.body.status, ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'], 'status');
  if (!Object.keys(changes).length) throw new HttpError(422, 'Provide status or priority.');
  res.json(presentTicket(await updateTicket(req.params.id, changes, req.user)));
}));
ticketRouter.post('/:id/messages', route(async (req, res) => {
  const body = requiredText(req.body?.body, 'Message', 15000);
  const visibility = permitted(req.body?.visibility || 'PUBLIC', ['PUBLIC', 'INTERNAL'], 'visibility');
  res.status(201).json(await addAgentMessage(req.params.id, req.user, { body, visibility }));
}));
ticketRouter.post('/:id/resolve', route(async (req, res) => res.json(presentTicket(await resolveTicket(req.params.id, req.user)))));
ticketRouter.post('/:id/reopen', route(async (req, res) => res.json(presentTicket(await reopenTicket(req.params.id, req.user)))));
