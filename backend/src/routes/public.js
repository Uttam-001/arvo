import { Router } from 'express';
import { route, requiredText } from '../lib/errors.js';
import { publicTicket, publicReply, publicReopen } from '../services/publicPortal.js';
import { autoCloseWaitingTickets } from '../services/ticketCommands.js';
export const publicRouter = Router();
// X-Ticket-Token is a secret capability, unlike guessable ticket number IDs.
const token = (req) => req.get('X-Ticket-Token');
publicRouter.get('/tickets/:number', route(async (req, res) => { await autoCloseWaitingTickets(); res.json(await publicTicket(req.params.number, token(req))); }));
publicRouter.post('/tickets/:number/replies', route(async (req, res) => {
  const result = await publicReply(req.params.number, token(req), requiredText(req.body?.body, 'Reply', 15000));
  res.status(201).json({ id: result.id, createdAt: result.createdAt });
}));
publicRouter.post('/tickets/:number/reopen', route(async (req, res) => res.json(await publicReopen(req.params.number, token(req)))));
