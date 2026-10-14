# Coach Copilot V3.4.4 staging and release checklist

## Safety boundaries
- Never point a staging build at the production Supabase URL.
- Never run `supabase/migrations/20261013_submit_workout_atomic.sql` on production until isolated integration tests and an iPhone test pass.
- Use separate test coach/client accounts and dummy programmes only.
- No production data copying, migrations, or direct writes during staging.
- `main` is not a test branch.

## Automated gates
- `node tests/reliability.test.cjs`: programme copy safeguards.
- `node tests/offline.test.cjs`: device queue, retry, idempotency and account isolation (simulated backend).
- `tests/sql/atomic.test.sql`: disposable PostgreSQL test of actual RPC SQL, RLS and rollback.
- `tests/browser.spec.cjs`: mobile Chromium browser test with a fake Supabase backend.
- GitHub Actions workflow: `.github/workflows/reliability.yml`.

## Separate staging backend
1. Provision a **separate** Supabase project or development branch after reviewing any cost.
2. Confirm schema/migrations match production **without copying personal/client data**.
3. Apply `supabase/migrations/20261013_submit_workout_atomic.sql` only to the staging database.
4. Create disposable coach/client accounts and programme.
5. Configure GitHub repository secrets `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_PUBLISHABLE_KEY`.
6. Run the manual `Build isolated staging package` GitHub workflow. It fails closed if credentials are absent or URL matches production.
7. Host the resulting `dist-staging` directory at a separate HTTPS origin; do not replace production Pages.

## iPhone manual test
- Start a workout; enter weight/reps, navigate between exercises, verify entries persist.
- Swap an exercise and confirm prescribed/performed names in coach history.
- Switch to Airplane Mode. Reload the installed app and verify cached workout is restored.
- Complete the workout offline. Verify **Pending sync** in History and no false synced status.
- Reconnect. Verify **Synced with coach** and one completed workout, correct sets and feedback.
- Reconnect/reload again. Verify no duplicate workout, sets or feedback.
- Repeat for a failed/slow network response and with two different test clients.

## Release gate
Require all CI jobs green, staging RPC installed and verified, mobile manual pass, and no unexpected changes to live data. Only then review the PR for merging and a controlled production migration.
