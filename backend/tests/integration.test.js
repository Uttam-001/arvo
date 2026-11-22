import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTicket, claimTicket, addAgentMessage, updateTicket, resolveTicket, reopenTicket, autoCloseWaitingTickets } from '../src/services/ticketCommands.js';
import { getTicket, presentTicket } from '../src/services/ticketQueries.js';

// Only use a dedicated disposable MySQL database (RUN_DB_TESTS=1). Audit triggers
// intentionally prevent cleanup by deleting historical messages/events.
test('concurrent claim, privacy, audit immutability, and state constraints', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const agents = await prisma.agent.findMany({ where: { role: 'SUPPORT_AGENT', isDemo: true }, take: 2 });
  assert.equal(agents.length, 2, 'Seed two demo agents first');
  const [first, second] = agents;
  const { ticket, accessToken } = await createTicket({ title: 'Concurrent claim test', description: 'This is an integration test', priority: 'MEDIUM', customerName: 'Test Customer', customerEmail: 'customer@example.test' }, first);
  assert.equal('customerTokenHash' in presentTicket(ticket), false);
  const claims = await Promise.allSettled([claimTicket(ticket.id, first), claimTicket(ticket.id, second)]);
  assert.equal(claims.filter((c) => c.status === 'fulfilled').length, 1, 'Only one agent may win');
  assert.equal(claims.filter((c) => c.status === 'rejected').length, 1);
  const winner = claims[0].status === 'fulfilled' ? first : second;
  await addAgentMessage(ticket.id, winner, { body: 'Never reveal the customer password.', visibility: 'INTERNAL' });
  await addAgentMessage(ticket.id, winner, { body: 'We are working on your case.', visibility: 'PUBLIC' });
  const path = `/api/public/tickets/${ticket.ticketNumber}`;
  await request(app).get(path).expect(401);
  await request(app).get(`/api/tickets/${ticket.id}`).expect(401);
  const portal = request.agent(app);
  const { body: customer } = await portal.get(path).set('X-Ticket-Token', accessToken).expect(200);
  assert.equal(customer.messages.length, 1, 'Customer sees only PUBLIC messages');
  assert.equal(JSON.stringify(customer).includes('Never reveal'), false);
  await updateTicket(ticket.id, { status: 'WAITING_ON_CUSTOMER' }, winner);
  const waiting = await getTicket(ticket.id);
  await addAgentMessage(ticket.id, winner, { body: 'A reminder while we wait.', visibility: 'PUBLIC' });
  const reminded = await getTicket(ticket.id);
  assert.equal(reminded.status, 'WAITING_ON_CUSTOMER');
  assert.deepEqual(reminded.autoCloseDueAt, waiting.autoCloseDueAt);
  const reprioritized = await updateTicket(ticket.id, { priority: 'URGENT' }, winner);
  assert.equal(reprioritized.priority, 'URGENT');
  assert.deepEqual(reprioritized.firstResponseAt, waiting.firstResponseAt);
  assert.deepEqual(reprioritized.autoCloseDueAt, waiting.autoCloseDueAt);
  const { body: { csrfToken } } = await portal.get('/api/auth/csrf').expect(200);
  await portal.post(`${path}/replies`)
    .set('X-Ticket-Token', accessToken)
    .set('X-CSRF-Token', csrfToken)
    .send({ body: 'Here is the information you requested.' })
    .expect(201);
  const after = await getTicket(ticket.id);
  assert.equal(after.status, 'IN_PROGRESS');
  assert.equal(after.slaPausedAt, null);
  assert(after.events.find((e) => e.action === 'PRIORITY_CHANGED' && e.details.from === 'MEDIUM' && e.details.to === 'URGENT'));
  assert(after.events.find((e) => e.action === 'CUSTOMER_REPLIED' && e.actorLabel.includes('customer@example.test')));
  await assert.rejects(() => prisma.$executeRaw`UPDATE ticket_events SET actor_label = 'tampered' WHERE ticket_id = ${ticket.id}`);
  await resolveTicket(ticket.id, winner);
  await assert.rejects(() => resolveTicket(ticket.id, winner), /resolved or closed/);
  await portal.post(`${path}/reopen`).set('X-Ticket-Token', accessToken).set('X-CSRF-Token', csrfToken).expect(200);
  await assert.rejects(() => reopenTicket(ticket.id, winner), /Only resolved tickets/);
});

test('waiting time-out auto-closes, rejects reopening', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const lead = await prisma.agent.findFirst({ where: { role: 'SUPPORT_LEAD', isDemo: true } });
  assert(lead, 'Seed lead first');
  const { ticket } = await createTicket({ title: 'Customer silence test', description: 'No reply for five business days', priority: 'LOW', customerName: 'Test Customer', customerEmail: 'customer@example.test' }, lead);
  await updateTicket(ticket.id, { status: 'WAITING_ON_CUSTOMER' }, lead);
  const due = (await getTicket(ticket.id)).autoCloseDueAt;
  await autoCloseWaitingTickets(new Date(due.getTime() - 1));
  assert.equal((await getTicket(ticket.id)).status, 'WAITING_ON_CUSTOMER');
  await autoCloseWaitingTickets(due);
  assert.equal((await getTicket(ticket.id)).status, 'CLOSED');
  await assert.rejects(() => reopenTicket(ticket.id, lead), /Only resolved tickets/);
});

test('a lead can remove a directory customer while linked tickets keep their history', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const lead = await prisma.agent.findFirstOrThrow({ where: { role: 'SUPPORT_LEAD', isDemo: true } });
  const agent = await prisma.agent.findFirstOrThrow({ where: { role: 'SUPPORT_AGENT', isDemo: true } });
  const customer = await prisma.customer.create({ data: {
    name: 'Directory removal test', email: `qa-${randomUUID()}@example.test`, company: 'Test Company'
  } });
  const { ticket } = await createTicket({ title: 'Customer removal test', description: 'Keep this history', customerId: customer.id }, lead);
  const path = `/api/customers/${customer.id}`;

  async function session(user) {
    const client = request.agent(app);
    const { body: { csrfToken } } = await client.get('/api/auth/csrf').expect(200);
    await client.post('/api/auth/demo').set('X-CSRF-Token', csrfToken).send({ email: user.email }).expect(200);
    return { client, csrfToken };
  }

  const agentSession = await session(agent);
  await agentSession.client.delete(path).set('X-CSRF-Token', agentSession.csrfToken).expect(403);
  const leadSession = await session(lead);
  await leadSession.client.delete(path).expect(403);
  await leadSession.client.delete(path).set('X-CSRF-Token', leadSession.csrfToken).expect(204);
  await leadSession.client.delete(path).set('X-CSRF-Token', leadSession.csrfToken).expect(404);
  const remainingTicket = await getTicket(ticket.id);
  assert.equal(remainingTicket.customerId, null);
  assert.equal(remainingTicket.customerEmail, customer.email);
  assert(remainingTicket.events.some(event => event.action === 'TICKET_CREATED'));
});

test('scheduled sweep requires its configured secret', async (t) => {
  const secret = process.env.CRON_SECRET;
  t.after(() => {
    if (secret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = secret;
  });
  process.env.CRON_SECRET = 'test-cron-secret';
  await request(app).get('/api/jobs/auto-close').expect(401);
  await request(app).get('/api/jobs/auto-close').set('Authorization', 'Bearer incorrect').expect(401);
});

test.after(async () => { await prisma.$disconnect(); });
