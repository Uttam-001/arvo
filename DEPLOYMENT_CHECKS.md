# Deployment checks

The hosted demo runs on Vercel with Railway MySQL. See the [README](README.md#deployment-preparation) for environment and database setup.

After deploying, verify the following with fictional data.

- Confirm that the frontend loads and that the health endpoint reports a working MySQL connection.
- Sign in as an agent and as the support lead. Verify ticket claiming, lead assignment, and logout.
- Create and resolve a ticket. Send a public reply and add an internal note. Open the customer portal and confirm that the public reply is visible and the internal note stays in the agent workspace.
- Remove a demo customer directory entry and verify that the associated ticket and activity history remain accessible to agents.
- Verify that all four history triggers are installed and the authenticated auto-close job runs.