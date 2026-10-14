-- Disposable PostgreSQL integration fixture. Never execute on a live Supabase database.
create schema auth;
create role authenticated;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.workouts(
 id uuid primary key,client_id uuid not null,session_id uuid not null,
 started_at timestamptz not null default now(),completed_at timestamptz,
 status text not null default 'in_progress',client_notes text
);
create table public.session_exercises(id uuid primary key,session_id uuid not null);
create table public.prescribed_sets(id uuid primary key,session_exercise_id uuid references public.session_exercises(id));
create table public.completed_sets(
 id uuid primary key,workout_id uuid not null references public.workouts(id),
 prescribed_set_id uuid references public.prescribed_sets(id),
 exercise_name text not null,set_number integer not null,
 load_kg numeric,reps integer,rir numeric,
 completed boolean not null default true,substituted boolean not null default false
);
create table public.session_feedback(
 id uuid primary key default gen_random_uuid(),workout_id uuid not null references public.workouts(id),
 energy text,sleep_hours_band text,sleep_quality text,pain_reported boolean not null default false,
 pain_location text,pain_severity integer,pain_effect text,notes text
);
insert into public.session_exercises values
 ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
insert into public.prescribed_sets values
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222');
grant select,insert,update on public.workouts to authenticated;
grant select,insert on public.completed_sets,public.session_feedback to authenticated;
grant select on public.prescribed_sets,public.session_exercises to authenticated;
alter table public.workouts enable row level security;
alter table public.completed_sets enable row level security;
alter table public.session_feedback enable row level security;
create policy workout_select on public.workouts for select to authenticated using (client_id=auth.uid());
create policy workout_insert on public.workouts for insert to authenticated with check(client_id=auth.uid() and session_id='33333333-3333-4333-8333-333333333333');
create policy workout_update on public.workouts for update to authenticated using(client_id=auth.uid()) with check(client_id=auth.uid());
create policy sets_select on public.completed_sets for select to authenticated using(exists(select 1 from public.workouts w where w.id=workout_id and w.client_id=auth.uid()));
create policy sets_insert on public.completed_sets for insert to authenticated with check(exists(select 1 from public.workouts w where w.id=workout_id and w.client_id=auth.uid()));
create policy feedback_select on public.session_feedback for select to authenticated using(exists(select 1 from public.workouts w where w.id=workout_id and w.client_id=auth.uid()));
create policy feedback_insert on public.session_feedback for insert to authenticated with check(exists(select 1 from public.workouts w where w.id=workout_id and w.client_id=auth.uid()));
