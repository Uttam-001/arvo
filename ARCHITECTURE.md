# Architecture

The React frontend contains the agent workspace and customer portal. Express serves both workflows over a same-origin API, and Prisma stores ticket and session data in MySQL.

## Ticket ownership and history

Agents claim unassigned tickets through an atomic conditional update in a transaction. Support leads can assign tickets and manage the customer directory and holiday calendar. Removing a customer directory entry preserves the customer's tickets and activity history.

Ticket events store the actor, action, timestamp, and associated changes. The committed migration installs update and delete triggers on messages and ticket events to protect their history.

## Customer access

The customer portal uses a per-ticket token. The public API selects public messages and a limited set of ticket fields. Agents share customer links manually.

## SLA calculations

The SLA service uses the business timezone and excludes weekends and configured holidays. Priority changes recalculate outstanding deadlines from the change time and preserve the first reply if it has already been recorded. New holidays affect future deadline calculations. Only resolved tickets can reopen within the window described in the [README](README.md#sla-rules).