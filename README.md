# Coach Copilot V3.1 — cloud programme delivery

This build moves coach→client programme delivery to Supabase.

Cloud-backed now:
- Supabase authentication and profile role
- coach/client relationships
- programmes
- weeks
- sessions
- exercises
- individual prescribed sets

Still to migrate in the next build:
- workout completion/results
- session feedback
- history/PR/adherence

## Test goal
Link one dummy client to Mark in `coach_clients`, create a programme as Mark, then sign in as the dummy client and confirm the prescription is visible read-only.

The Supabase publishable key is intentionally client-side. Never add a service-role/secret key to this repository.
