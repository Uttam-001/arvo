import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { autoCloseWaitingTickets } from './services/ticketCommands.js';

async function start() {
  await connectDatabase();
  await autoCloseWaitingTickets();
  const timer = setInterval(() => autoCloseWaitingTickets().catch((error) => console.error('Auto-close job:', error)), 60_000);
  timer.unref();
  const server = app.listen(env.port, () => console.log(`Frontdesk Remake running on http://localhost:${env.port}`));
  const shutdown = () => server.close(async () => { clearInterval(timer); await disconnectDatabase(); });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
start().catch((error) => { console.error('Startup failed:', error); process.exitCode = 1; });
