# Hiring assignment — requirement traceability

Based on the supplied four-page hiring assessment dated 21 November 2026.

| Source | Requirement | Implemented in |
| --- | --- | --- |
| §2 | Replace spreadsheet with an agent-facing ticket system | React dashboard, Express tickets API, MySQL tables |
| §3 | Urgent reply in 2h; resolve same working day | `services/sla.js` (`URGENT`) |
| §3 | Medium reply in half a day; resolve ~3 days | `services/sla.js` (`MEDIUM`: 270m/1620m) |
| §3 | Low reply in one day; resolve ~one week | `services/sla.js` (`LOW`: 540m/2700m) |
| §3 | Working hours 9:30–18:30, weekdays, holidays | `services/sla.js`, `/api/holidays`, holidays table, lead UI |
| §3 | Waiting on customer pauses SLA | `ticketCommands.pauseSla` / `resumeSla`, pause log |
| §3 | Close after one working week of no reply | `autoCloseWaitingTickets`, server timer/startup/read sweep, 45h deadline |
| §3 | Reopen resolved ticket for one working week only | `ticketPolicies.assertCanReopen` + `reopenTicket`, agent/customer API |
| §3 | Single screen for agent tickets and overdue/waiting | Sidebar, filters, SLA pills, detail pane, dashboard metrics |
| §3 | Public reply vs team-only note | `visibility` column, compose tabs, public-only message projection |
| §3 | Changing priority during lifecycle | Explicit reset policy, `PRIORITY_CHANGED` immutable event |
| §4.1 | Two agents cannot both claim same ticket | `claimTicket`: atomic conditional InnoDB update and transaction |
| §4.2 | Private notes never visible to customer: UI/API/export/list | Public token-protected allowlist selects only `PUBLIC` messages; no customer-facing export or unrestricted endpoint |
| §4.3 | Who, what, when; cannot change activity history | `TicketEvent` actor snapshot + timestamp, MySQL immutability triggers; messages also immutable |
| §5 | Any frontend, Node/Python backend, MySQL/PostgreSQL | React + Express + MySQL + Prisma |
| §5 | App public online for one week | Deployment instructions in `README.md` and status in `SUBMISSION_NOTES.md` |
| §5–6 | Repo URL + README with local setup | `README.md` and `SUBMISSION_NOTES.md` |
| §5–6 | Short unfinished-work note | `SUBMISSION_NOTES.md` |

## Explicit decisions in cases where the story is ambiguous

- “About one week” is defined as five 9-hour business days = 45 business hours.
- A priority change resets SLA deadlines from the change time, with the existing first public response preserved.
- Only resolved tickets reopen. Waiting tickets that auto-closed must start a new ticket.
- User demo uses a support lead plus nine support agents, not nine plus nine.
- Customer access uses a secret per-ticket token. No note is ever returned from a customer route.
- Adding a festival holiday affects future deadlines, but existing stored deadlines are not retroactively recalculated.

## Local verification

Built the frontend, ran Prisma migrations and seeds on isolated MySQL 8 schemas, and passed the SLA and MySQL integration suite. The integration suite covers concurrent claims, the public customer route's response, immutable audit records, wait and resume, customer reopening, and auto-close. See the completion note for verification still pending.
