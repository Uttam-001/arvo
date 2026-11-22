import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from './lib/errors.js';
import { prisma } from './lib/prisma.js';
import { issueCsrfCookie, requireCsrf } from './middleware/csrf.js';
import { authRouter } from './routes/auth.js';
import { agentRouter } from './routes/agents.js';
import { customerRouter } from './routes/customers.js';
import { ticketRouter } from './routes/tickets.js';
import { publicRouter } from './routes/public.js';
import { holidayRouter } from './routes/holidays.js';
import { autoCloseWaitingTickets } from './services/ticketCommands.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway/Render usually terminate HTTPS at one reverse proxy.
app.use(express.json({ limit: '80kb' }));
app.use(cookieParser());
app.use('/api', issueCsrfCookie);
app.use('/api', requireCsrf);
app.get(['/health', '/api/health'], async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
});
app.get('/api/jobs/auto-close', route(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('Authorization') !== `Bearer ${secret}`) return res.sendStatus(401);
  res.json({ closed: await autoCloseWaitingTickets() });
}));
app.use('/api/auth', authRouter);
app.use('/api/agents', agentRouter);
app.use('/api/customers', customerRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/public', publicRouter);
app.use('/api/holidays', holidayRouter);

// Deploy as ONE origin: Express serves the built React SPA. Dev Vite proxies /api.
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../../frontend/dist');
app.use(express.static(dist, { index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health') return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => { if (err) next(err); });
});
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'P2002' ? 409 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error.' : err.message });
});
