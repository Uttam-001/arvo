# Arvo

Arvo is a customer support ticketing app with a shared agent inbox, a customer portal, and SLA tracking that follows working hours. Support teams can assign and claim tickets, send public replies, add private notes, and review each ticket's activity history.

Open the live demo and select **Meera** for the support lead view, or choose any of the nine support agents. [Arvo live demo](https://frontdesk-support.vercel.app/)

## Stack

- React, Vite, and custom CSS
- Node.js, Express, and a same-origin REST API
- MySQL 8 and Prisma ORM
- Luxon for business-hour calculations
- Node.js test runner and Supertest

## Prerequisites

- Node.js 24 and npm
- A local MySQL 8 server
- An empty `frontdesk` schema and a dedicated local MySQL account with schema-scoped permissions to run migrations and create triggers

## Local setup

1. As a MySQL administrator, create the schema and a dedicated account restricted to local connections. Substitute a unique password for the placeholder before running the SQL.

   ```sql
   CREATE DATABASE frontdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'frontdesk'@'127.0.0.1' IDENTIFIED BY 'REPLACE_WITH_A_UNIQUE_PASSWORD';
   GRANT ALL PRIVILEGES ON frontdesk.* TO 'frontdesk'@'127.0.0.1';
   ```

2. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` using your local account. URL-encode special characters in the password. Keep `backend/.env` out of Git, screenshots, and support messages.

3. From the repository root, install dependencies, generate Prisma Client, apply migrations, and seed the demo data.

   ```sh
   npm ci --prefix backend
   npm ci --prefix frontend
   npm run db:generate
   npm run db:prepare
   ```

4. Run `npm run dev:api` and `npm run dev:web` in separate terminals. Open [the app](http://localhost:5173) and select the support lead or an agent. The [health endpoint](http://localhost:4000/health) reports whether the API can reach MySQL.

On Windows PowerShell, use `npm.cmd` instead of `npm` if the shell blocks the npm PowerShell script.

To check the production build locally, stop the development API, run `npm run build` followed by `npm start`, and open [the bundled app](http://localhost:4000).

## Demo workflow

`npm run db:seed` creates one support lead, nine agents, 26 fictional customers, and sample holidays. The ticket queue starts empty. Run the seed only against a demo database because it upserts demo accounts and customers.

1. Sign in and create a ticket for a fictional customer. Claim it as an agent or assign it as **Meera**, the support lead.
2. Choose **Public reply** to respond to the customer or **Internal note** to record a team-only update. The two compose modes keep separate drafts.
3. Open the ticket customer link in a separate browser session to view public replies and respond as the customer. Check the **Activity log** in the agent workspace to see the ticket history.
4. Use **Log out** in the Arvo Support sidebar to switch demo roles.

## Database migrations

`npm run db:migrate` uses `prisma migrate deploy` to apply the committed MySQL migration. The schema covers agents, sessions, customers, tickets, messages, ticket events, SLA pauses, and holidays. The migration installs UPDATE and DELETE triggers on messages and ticket events. Use the committed migration to create those triggers.

If MySQL rejects trigger creation with error 1419, ask the database provider or administrator for a supported way to apply the migration with trigger permissions. If the initial migration partially applied to a new demo schema, retry on a separate empty schema after permissions are corrected.

## Authentication and API security

- **Support Lead** can assign tickets, manage the holiday calendar, view workload, remove customer directory entries, and perform ticket actions. Removing a directory entry preserves its existing tickets and audit history.
- **Support Agent** can view the shared inbox, claim an unassigned ticket, and edit tickets assigned to them. Claiming uses an atomic update to prevent two agents taking the same ticket.
- **Sessions** use opaque tokens stored as hashes in MySQL. Both the session and CSRF cookies use `HttpOnly` and `SameSite=Lax`, with `Secure` in production. The frontend gets its CSRF token from `/api/auth/csrf` and sends it in `X-CSRF-Token` for state-changing requests. The server checks it against the cookie.
- **Same-origin requests** use the Vite proxy locally. The Vercel configuration serves the frontend and API on the same origin.
- **Customer access** requires a per-ticket token and ticket number. The app generates customer links with the token in the URL fragment and sends it to the API in `X-Ticket-Token`. The customer API returns public messages and selected ticket fields. Treat customer links as credentials and keep them out of docs, issue trackers, and logs.
- **Demo sign-in** lets anyone who can reach the app select a seeded identity, including the support lead. Use a dedicated demo deployment and database with fictional data only. A real support deployment requires individual authentication and explicit access controls.

## SLA rules

Business hours are 09:30 to 18:30, Monday through Friday, in `Asia/Kolkata` by default. Configured holidays are excluded.

| Priority | First public reply | Resolution |
| --- | --- | --- |
| Urgent | 2 working hours | End of the working day when the SLA clock starts |
| Medium | 4.5 working hours | 27 working hours |
| Low | 9 working hours | 45 working hours |

Waiting for the customer pauses SLA deadlines. An agent reminder keeps the pause active. A customer reply resumes the ticket, and 45 working hours without a reply makes it eligible for auto-close. Resolved tickets can reopen within 45 working hours of resolution. Priority changes recalculate outstanding deadlines and preserve a first reply already recorded. Adding holidays affects future calculations.

## npm commands

Run these from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run dev:api` | Start Express with file watching |
| `npm run dev:web` | Start Vite |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply committed migrations |
| `npm run db:seed` | Seed demo accounts, customers, and holidays |
| `npm run db:prepare` | Apply migrations and seed demo data |
| `npm run build` | Build the frontend |
| `npm start` | Serve the API and built frontend locally |
| `npm test` | Run the test suite |

## Tests and test data

`npm test` runs the SLA and application tests. MySQL integration cases are skipped by default. The full suite covers concurrent claims, customer visibility, customer removal permissions and ticket retention, audit immutability, priority changes, waiting, auto-close, and reopening.

To include the integration cases, create a separate disposable MySQL database, give your test account access to that schema, and set `DATABASE_URL` to it in an isolated terminal using an environment variable or secret manager. Verify that the URL points to the disposable schema before running the commands.

```powershell
npm.cmd run db:prepare
$env:RUN_DB_TESTS = '1'
npm.cmd test
Remove-Item Env:RUN_DB_TESTS
```

Tests leave fixture records in the disposable database because the history triggers prevent ordinary deletion. Keep all integration runs separate from demo and production databases.

## Deployment preparation

1. Provision a dedicated hosted MySQL 8 demo database that requires TLS and supports the migration's triggers. Follow the provider's certificate verification instructions. Where supported, use a migration account with schema permissions and a separate, least-privileged runtime account.
2. From a trusted terminal, set `DATABASE_URL` to the hosted demo database and run `npm run db:prepare` using the provider's strict TLS settings. Store the runtime `DATABASE_URL` and a strong, randomly generated `CRON_SECRET` in Vercel's server-side environment settings. For Railway's generated MySQL certificate, the runtime can verify an authenticated copy of the provider's CA and pin the exact server certificate. Set `DATABASE_CA_PEM` and `DATABASE_TLS_FINGERPRINT` together using the CA PEM and SHA-256 certificate fingerprint obtained through the provider's authenticated dashboard or CLI. Refresh the pin after a certificate rotation. Keep database credentials out of Git and client-side `VITE_*` variables.
3. Import the repository root into Vercel. The checked-in configuration builds the frontend for the CDN and routes API requests to one Node.js function. Enable `DEMO_MODE_ENABLED=true` only for the isolated demo. Keep the deployment over HTTPS.
4. Verify `/health`, both demo roles, ticket creation, and customer access before sharing the public HTTPS URL.

## Project structure

- [frontend/](frontend/) contains the agent workspace and customer portal.
- [backend/src/](backend/src/) contains the Express API and ticket workflow.
- [backend/prisma/](backend/prisma/) contains the schema, migrations, and demo seed.
- [api/](api/) contains the Vercel API entry point.

See [Architecture](ARCHITECTURE.md) for implementation details and [Deployment checks](DEPLOYMENT_CHECKS.md) for the hosted demo checklist.

## Known limitations

- The demo uses an in-memory sign-in rate limiter. Limits are per instance when the API runs on multiple instances.
- The standalone server sweeps expired tickets at startup and every minute. Vercel is configured for a daily authenticated sweep. Inbox and customer-portal reads also process expired tickets, and late customer replies are rejected at the deadline.
- Agents share customer links manually. The app has no email delivery or link rotation workflow.
