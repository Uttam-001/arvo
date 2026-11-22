# Frontdesk Remake — Full-stack hiring assignment

A redesigned ticket-support platform for Arvo Systems, rebuilt using **React + Vite**, **Node.js + Express**, **Prisma ORM**, and **MySQL 8+**. It includes an agent dashboard, a private activity log, a secure customer conversation view, and a working-hours SLA engine.

This is a **fresh MySQL implementation**, not an automatic PostgreSQL-to-MySQL data migration. Export/import old tickets separately if you need their history.

See [SUBMISSION_NOTES.md](SUBMISSION_NOTES.md) for the deployment status and verification results.

## Technology

| Layer | Stack |
| --- | --- |
| Web | React 19, Vite, custom responsive CSS |
| API | Node.js 24, Express 4, same-origin HTTP endpoints |
| ORM | Prisma 6 with migrations |
| DB | MySQL 8+, InnoDB and SQL triggers |
| Dates | Luxon, default business time zone `Asia/Kolkata` |
| Auth | Demo agent sessions in HttpOnly SameSite=Lax cookies + CSRF token |
| Jobs | 60-second auto-close timer, startup sweep, sweep on inbox/portal reads |

**No Docker is required.** The API serves the built SPA on the same origin when deployed, avoiding split-domain cookie/CSRF problems.

## Run locally (Windows PowerShell + VS Code terminal)

1. Install Node.js 24 LTS and MySQL 8+. Start MySQL locally.
2. Open the `Frontdesk-Remake` folder in VS Code.
3. In a MySQL terminal, run:

   ```sql
   CREATE DATABASE frontdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'frontdesk'@'127.0.0.1' IDENTIFIED BY 'change_this_password';
   GRANT ALL PRIVILEGES ON frontdesk.* TO 'frontdesk'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```

   For development you can also use an existing MySQL user with permission to create tables and **triggers**. Keep this demo account restricted to localhost.

   If MySQL reports error 1419 during migration, ask your MySQL administrator to enable `log_bin_trust_function_creators` for the dedicated demo instance or apply the migration using an administrative account. Use a clean schema after a failed first migration on a fresh install, since MySQL may already have committed some DDL.

4. Copy `backend/.env.example` to `backend/.env` and replace the password with your actual MySQL password:

   ```env
   DATABASE_URL="mysql://frontdesk:change_this_password@127.0.0.1:3306/frontdesk"
   PORT=4000
   NODE_ENV=development
   BUSINESS_TIMEZONE=Asia/Kolkata
   DEMO_MODE_ENABLED=true
   ```

   URL-encode any special characters in the password (for example, `@` → `%40`).

5. Install both sets of dependencies in separate terminals or sequentially:

   ```powershell
   npm ci --prefix backend
   npm ci --prefix frontend
   ```

6. Generate Prisma Client, apply the MySQL migration, and create demo users/customers:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   **Do not replace the checked-in migration with `prisma db push`**, as `db push` will not install the important immutable-history SQL triggers.

7. Open two terminals. Run the API in one and Vite in the other:

   ```powershell
   npm run dev:api
   ```

   ```powershell
   npm run dev:web
   ```

8. Open **http://localhost:5173**. Select *Meera Iyer* (support lead) or an agent in the demo login. The nine agents and support lead are already seeded. The API health check is **http://localhost:4000/health**.

### Production build, locally

```powershell
npm run build
npm start
```

Then visit **http://localhost:4000**. Express serves the frontend's `dist` folder; no separate frontend hostname is necessary.

## What the application does

- Lets agents create, claim, assign, prioritize, respond to, resolve, and reopen tickets.
- Lets agents distinguish **public replies** (customer-visible) from **internal notes** (agent-only) in the conversation.
- Displays pending, assigned, waiting, overdue, and resolved tickets, with SLA indicators and paginated lists (50 tickets per page).
- Tracks urgency-dependent response and resolution deadlines using **Monday–Friday, 9:30 AM–6:30 PM, configured holiday dates**.
- Freezes SLA timers when a ticket waits for its customer; resumes by extending deadlines by exactly the business minutes waited.
- Keeps the timer paused when an agent sends a reminder. A customer reply returns the ticket to in progress.
- Closes a waiting ticket after **45 working hours**, unless a customer replies before the deadline.
- Allows reopening **only** from `RESOLVED` during the following **45 working hours**. Closed or expired tickets must be replaced with a new ticket.
- Uses an atomic MySQL update so two agents **cannot both claim** the same unassigned ticket.
- Uses MySQL UPDATE/DELETE triggers to make messages and audit events immutable. Every event logs the action, time, and actor snapshot.
- Supports a customer-facing conversation page protected by an unguessable per-ticket token. It returns an allowlisted set of ticket fields and **only `PUBLIC` messages**. Token links are copied by the agent after creation; no outbound email service is included.
- Lets a lead see agent workload and maintain the holiday calendar.

## SLA rules and interpretations

| Priority | First public response | Resolution |
| --- | --- | --- |
| Urgent | 2 business hours | End of the same (or next if created after hours) business day |
| Medium | Half a working day (4.5 hours) | 3 working days (27 working hours) |
| Low | One working day (9 hours) | One working week (45 working hours) |

**Policy for changes to priority:** The assignment intentionally leaves this ambiguous. This implementation **recalculates remaining SLA deadlines from the moment the priority changes**. It retains any already credited first public response. If the ticket is waiting on a customer, the newly calculated deadlines stay paused and resume when a reply arrives. An immutable `PRIORITY_CHANGED` audit event records the old and new priority, deadline values, and this policy.

**Customer wait and reopening period:** “About one working week” is defined as 45 business hours (5 × 9 hours), excluding configured holidays. A reply exactly at the auto-close boundary is treated as expired. `RESOLVED` may reopen until the computed deadline; `CLOSED` never reopens.

**Holiday updates:** Leads can add holidays via **Management → Holidays**. Dates configured later only affect new/recalculated future deadlines; this sample does **not** retroactively alter already stored SLA deadlines. Populate holidays before opening production tickets.

**Important nuance:** An urgent ticket opened late in a business day has a same-day resolution deadline that can occur before its two-hour response deadline. This mirrors the literal requirement; discuss with product leadership if the company wants a different policy.

## Architecture

```text
frontend/src/App.jsx           React dashboard, ticket actions, customer portal
frontend/src/api.js            Same-origin REST API client + CSRF token flow
frontend/src/index.css         New UI design and responsive layout
backend/src/app.js             Express app, session/CSRF middleware, SPA hosting
backend/src/routes/           Thin route controllers / request validation
backend/src/services/sla.js    Pure working-hour calculations
backend/src/services/ticketPolicies.js   State machine rules + ownership
backend/src/services/ticketCommands.js  Transactional ticket mutations
backend/src/services/ticketQueries.js   Ticket list, detail, stats + safe projections
backend/src/services/publicPortal.js    Secret-token auth + public-only projection
backend/src/services/audit.js  Immutable action-record writes
backend/prisma/schema.prisma   MySQL Prisma data model
backend/prisma/migrations/     MySQL CREATE TABLE and UPDATE/DELETE triggers
backend/prisma/seed.js         Demo lead, nine agents, customers, example holidays
backend/tests/                 SLA and opt-in MySQL integration tests
```

The rules are in the service layer, not duplicated in button handlers. Every mutating ticket command uses database transactions; edits to existing tickets lock the corresponding InnoDB row with `SELECT ... FOR UPDATE` before changing state. Claiming uses a single atomic conditional `UPDATE`.

## Automated tests

```powershell
npm test
```

The basic tests check business-hours arithmetic, weekends, holidays, and reopening constraints. Real-database integration tests are **opt-in** because they insert immutable records. Create a separate disposable MySQL database and grant your local user access. In the same PowerShell terminal:

```powershell
$env:DATABASE_URL = 'mysql://frontdesk:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:3306/frontdesk_test'
npm.cmd run db:prepare
$env:RUN_DB_TESTS = '1'
npm.cmd test
Remove-Item Env:RUN_DB_TESTS, Env:DATABASE_URL
```

Integration tests verify concurrent claims, internal-note privacy, customer action audit trail, immutable SQL triggers, resolution/reopen rules, and scheduled auto-close. **Do not run them against real customer data.**

## REST endpoints

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/health` | Public health check |
| GET | `/api/auth/csrf` | Issue CSRF token |
| GET / POST | `/api/auth/demo-agents`, `/api/auth/demo` | Demo users |
| GET / POST | `/api/auth/me`, `/api/auth/logout` | Agent session |
| GET / POST | `/api/tickets` | Agent tickets |
| GET | `/api/tickets/stats/overview` | Agent stats |
| GET | `/api/tickets/:id` | Agent detail, including internal notes/audit |
| POST | `/api/tickets/:id/claim` | Atomic agent claim |
| PATCH | `/api/tickets/:id/assignment` | Lead only |
| PATCH | `/api/tickets/:id` | Status/priority, owner/lead |
| POST | `/api/tickets/:id/messages` | Public or internal message, owner/lead |
| POST | `/api/tickets/:id/resolve` | Owner/lead |
| POST | `/api/tickets/:id/reopen` | Owner/lead, resolved window only |
| GET / POST | `/api/customers` | Agent directory |
| GET | `/api/agents`, `/api/agents/workload` | Agents / lead stats |
| GET / POST | `/api/holidays` | Agents read / leads add |
| GET | `/api/public/tickets/:number` | Customer token in `X-Ticket-Token` |
| POST | `/api/public/tickets/:number/replies` | Customer token in `X-Ticket-Token` |
| POST | `/api/public/tickets/:number/reopen` | Customer token, within reopening window |

Mutating routes require the CSRF token from `/api/auth/csrf` in `X-CSRF-Token`. The secure customer link uses the opaque token returned exactly once when the agent creates a ticket. It is stored in a URL fragment (never sent in the initial page request) and forwarded to the API only in the `X-Ticket-Token` header. Ticket number alone is **not** authentication.

## Deploy under one public URL on Vercel

1. Provision a hosted MySQL 8 database reachable from Vercel via TLS. Give the migration user permission to create tables and triggers.
2. Import the GitHub repository into Vercel using the repository root. Set `DATABASE_URL` and a random `CRON_SECRET` in the production environment settings. Use `BUSINESS_TIMEZONE=Asia/Kolkata` and `DEMO_MODE_ENABLED=true` for the hiring demo. Keep credentials in environment settings and use synthetic data with the selectable demo identities.
3. From a trusted terminal with the hosted database URL set as `DATABASE_URL`, run `npm run db:prepare` once before deployment. Repeat after adding migrations. The seed command creates demo users and customers without creating tickets.
4. Deploy and verify `/health`, both demo roles, ticket creation, and the token-protected customer conversation. `vercel.json` builds the Vite assets for Vercel's CDN and serves the API with one Node function.
5. Keep the Vercel deployment and database available for one week after submission. Vercel runs a daily auto-close sweep. The inbox and customer portal also process expired tickets when visited, and customer replies after the deadline are rejected even if the next sweep hasn't run.

See [REQUIREMENTS_TRACE.md](REQUIREMENTS_TRACE.md) for the full assignment-to-code mapping.
