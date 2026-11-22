# Completion note

- **Repository** [Uttam-001/frontdesk](https://github.com/Uttam-001/frontdesk)
- **Local setup** [README](README.md)
- **Live application** [Arvo on Vercel](https://frontdesk-support.vercel.app)

The frontend production build, MySQL migrations and seed, demo sign-in for both roles, and automated SLA and MySQL tests passed locally. The tests cover concurrent claims, protection of internal notes, immutable audit history, waiting and auto-close, and the customer reopening window.

The Vercel deployment was verified on 23 November 2026 against Railway MySQL over TLS. The deployed check covered database health, both demo roles, ticket creation, public replies, private note isolation, and resolution. The Railway schema was initialized from the checked-in migration SQL and its checksum was recorded. All four history triggers are installed.

The full one-week availability period remains to be observed after submission. Agents share customer links manually, and demo users sign in through a role picker.
