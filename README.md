# Coach Copilot V3.3 — client onboarding

This build adds coach-side client onboarding without exposing Supabase admin credentials in the PWA.

## Static app
Upload the normal root files to GitHub Pages as before.

## One-time Supabase setup
V3.3 also contains:
- `supabase/functions/invite-client/index.ts` — privileged invitation function. Deploy this as a Supabase Edge Function named `invite-client`.
- `supabase/v3.3-activate-invited-client.sql` — run once in SQL Editor.

The Edge Function uses Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY` environment secret. Never put that key in `index.html` or GitHub Pages.

## Flow
Coach clicks + Add Client → name/email → Edge Function sends Supabase invitation and creates a pending relationship → client accepts invite → relationship becomes active → client appears as active in Coach Copilot.

Deactivation changes `coach_clients.status` to `inactive`; it does not delete training history.
