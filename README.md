# Frontdesk

Frontdesk is a full-stack customer support ticket manager built for a hiring assignment. It supports ticket ownership and assignment, public replies, private notes, immutable audit history, and business-hour SLA tracking.

**Demo data.** The seed creates fictional accounts and customers for reviewers. It leaves the ticket queue empty. Use fictional ticket subjects, messages, and contact details when trying the app.

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

## Fictional reviewer data

`npm run db:seed` creates one support lead, nine agents, 26 fictional customers, and sample holidays. The seed upserts demo accounts and customers, so rerun it only on a demo database. To try the full workflow, create a fictional ticket from the agent dashboard and open its customer link in a separate browser session.

## Database migrations

`npm run db:migrate` uses `prisma migrate deploy` to apply the committed MySQL migration. The schema covers agents, sessions, customers, tickets, messages, ticket events, SLA pauses, and holidays. The migration installs UPDATE and DELETE triggers on messages and ticket events. Use the committed migration to create those triggers.

If MySQL rejects trigger creation with error 1419, ask the database provider or administrator for a supported way to apply the migration with trigger permissions. If the initial migration partially applied to a new demo schema, retry on a separate empty schema after permissions are corrected.

## Authentication and API security

- **Support Lead** can assign tickets, manage the holiday calendar, view workload, and perform ticket actions.
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

`npm test` runs the SLA and application tests. MySQL integration cases are skipped by default. They cover concurrent claims, customer visibility, audit immutability, priority changes, waiting, auto-close, and reopening.

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
2. From a trusted terminal, set `DATABASE_URL` to the hosted demo database and run `npm run db:prepare`. Store the runtime `DATABASE_URL` and a strong, randomly generated `CRON_SECRET` in Vercel's server-side environment settings. Keep these values out of Git and client-side `VITE_*` variables.
3. Import the repository root into Vercel. The checked-in configuration builds the frontend for the CDN and routes API requests to one Node.js function. Enable `DEMO_MODE_ENABLED=true` only for the isolated reviewer demo. Keep the deployment over HTTPS.
4. Verify `/health`, both demo roles, ticket creation, and customer access before sharing the public HTTPS URL. Share only the application URL and keep the app and database available for one week after submission.

## Hiring test submission

- **Live URL** Pending Vercel deployment.
- **Repository** [Uttam-001/frontdesk-remake](https://github.com/Uttam-001/frontdesk-remake)
- **Completion note** [SUBMISSION_NOTES.md](SUBMISSION_NOTES.md)
- **Assessment coverage** [REQUIREMENTS_TRACE.md](REQUIREMENTS_TRACE.md)

## Known limitations

- The demo uses an in-memory sign-in rate limiter. Limits are per instance when the API runs on multiple instances.
- The standalone server sweeps expired tickets at startup and every minute. Vercel is configured for a daily authenticated sweep. Inbox and customer-portal reads also process expired tickets, and late customer replies are rejected at the deadline.
- Agents share customer links manually. The app has no email delivery or link rotation workflow.
