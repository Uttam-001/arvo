import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError, route, requiredText } from '../lib/errors.js';
import { requireAuth } from '../middleware/agentAuth.js';
export const customerRouter = Router();
customerRouter.use(requireAuth);
customerRouter.get('/', route(async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const where = search ? { OR: ['name', 'email', 'company'].map((key) => ({ [key]: { contains: search } })) } : {};
  const customers = await prisma.customer.findMany({ where, take: 100, orderBy: { name: 'asc' } });
  res.json({ customers });
}));
customerRouter.post('/', route(async (req, res) => {
  const name = requiredText(req.body?.name, 'Name', 120);
  const email = requiredText(req.body?.email, 'Email', 191).toLowerCase();
  const company = requiredText(req.body?.company, 'Company', 191);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(422, 'Invalid email address.');
  const customer = await prisma.customer.create({ data: { name, email, company, phone: req.body?.phone || null } });
  res.status(201).json(customer);
}));
