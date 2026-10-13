-- V1 ownership: one current coach per client, with historical inactive relationships preserved.
-- Partial unique index makes the rule race-safe under simultaneous invitations.
create unique index if not exists coach_clients_one_current_coach_per_client
on public.coach_clients (client_id)
where status in ('active','invited');

-- Coaches retain their own distinct clients; inactive relationships do not block reassignment.
-- Future shared coaching can replace this index with explicit permissions and migration.
