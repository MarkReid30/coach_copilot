-- SECURITY HARDENING: never allow authenticated users to promote their own profile.
-- Deploy to staging first, run role and RLS regression tests, then production.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Profile role changes require a trusted server action'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger
before update on public.profiles
for each row execute function public.protect_profile_role();

-- Protect from accidental duplicate sessions during concurrent programme edits.
-- Review and deduplicate any existing conflicts before enabling:
-- create unique index concurrently sessions_unique_week_position on public.sessions(week_id, position);
-- create unique index concurrently programme_weeks_unique_number on public.programme_weeks(programme_id, week_number);
