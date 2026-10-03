# Coach Copilot V3.4.3 — coaching workflow

V3.4.1 is a targeted patch to V3.4, which was built from the known-good V3.3.5 baseline. The V3.3.5 onboarding, authentication, client activation, programme delivery, workout completion and history sync flow is retained.

## V3.4 changes

- **Coach-only Quick Build:** write/paste a programme in normal PT shorthand, preview the parsed structure, edit it, then create a new programme or add sessions to the current week.
- Quick Build is deterministic and local until approval: **nothing is written to Supabase when you press Build preview.**
- Supports common shorthand including `4x5 @70kg`, `70kg 4x5`, `3x8-10 @26kg`, RIR and coaching notes.
- Multiple sessions can be entered with `Session: Upper A`, `Session: Lower A`, etc.
- **Coach snapshot:** current programme, weekly completion, total completed sessions, latest sleep and last workout.
- **Client workout shortcut:** Complete prescribed fills and marks all prescribed sets for an exercise; the client can still edit individual values.
- **Workout review:** client notes are surfaced and simple historical weight/rep PRs are flagged in History.
- **Client weekly summary:** current weekly completion is shown above the workout.

## Deployment

Upload the root static files to GitHub Pages exactly as for V3.3.5.

**No new Supabase SQL or Edge Function deployment is required for V3.4.** Keep the existing V3.3.5 `invite-client` Edge Function and the `activate_my_client_relationship()` RPC.

## Quick Build examples

Single session:

    Upper A

    Bench press 4x5 @70kg 2 RIR
    Pull ups 3x8
    Incline DB press 3x8-10 @26kg
    Chest supported row 3x10 @70kg
    Lateral raise 3x12 @10kg

    Bench press: 3 min rest, pause first rep

Multiple sessions:

    Programme: 3 Day Strength
    Week: Week 1
    Session: Upper A
    Bench press 4x5 @70kg 2 RIR
    Pull ups 3x8

    Session: Lower A
    Leg press 3x10 @200kg
    RDL 3x8 @80kg

Rep ranges currently use the lower number as the structured rep target and preserve the full range in coach notes (for example `8-10` becomes target reps `8` plus note `Target rep range 8–10`). This avoids a database schema change in V3.4.


## V3.4.1 patch

- Quick Build now generates UUIDs locally for programmes, weeks, sessions, exercises and prescribed sets.
- Quick Build no longer chains `.select('id').single()` onto newly inserted sessions/exercises, avoiding the RLS failure seen when the new row was immediately returned through the SELECT policy.
- Failed Quick Build saves now perform a best-effort child-to-parent cleanup of rows created by that attempt.
- No Supabase policy, SQL, or Edge Function changes are required for this patch.

## V3.4.2 onboarding fix
Client onboarding now checks the authenticated client's own coach_clients relationship status. If it is still `invited`, the app forces Finish account setup even when Supabase delivers the email link as a normal SIGNED_IN session rather than PASSWORD_RECOVERY. Run `supabase/v3.4.2-onboarding-status.sql` once in Supabase before deploying this build.


## V3.4.3 Create Next Week fix

- `Create Next Week` now derives the target from the selected source week and checks Supabase before writing.
- Existing empty/orphaned next weeks from failed copies are re-used instead of creating duplicates. This allows the empty Week 2 / Week 3 state from the pilot test to be repaired progressively.
- A populated next week is never overwritten.
- Week, session and exercise IDs are generated locally; the copy path no longer uses `insert(...).select(...).single()` on newly created rows.
- The button is disabled while a copy is running to prevent double submission.
- Failed copies perform best-effort child-to-parent rollback; a newly-created week is removed if its copy fails, while a pre-existing empty week is left intact.
- No new Supabase SQL, RLS or Edge Function changes are required for V3.4.3 beyond the V3.4.2 onboarding-status RPC already installed.
