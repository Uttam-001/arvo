import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { route, requiredText, HttpError } from '../lib/errors.js';
import { requireAuth, requireLead } from '../middleware/agentAuth.js';
export const holidayRouter = Router();
holidayRouter.use(requireAuth);
holidayRouter.get('/', route(async (_req, res) => {
  const holidays = await prisma.holiday.findMany({ orderBy: { holidayDate: 'asc' } });
  res.json({ holidays });
}));
holidayRouter.post('/', requireLead, route(async (req, res) => {
  const name = requiredText(req.body?.name, 'Holiday name', 191);
  const date = requiredText(req.body?.date, 'Holiday date', 10);
  if (!/^\d{4}-\d\d-\d\d$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new HttpError(422, 'Date must be YYYY-MM-DD.');
  const holiday = await prisma.holiday.create({ data: { name, holidayDate: new Date(`${date}T00:00:00.000Z`) } });
  res.status(201).json(holiday);
}));
