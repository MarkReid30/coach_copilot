-- Coach Copilot V3.4.4: stage and test before applying to any production project.
-- One RPC = one PostgreSQL transaction. Invoker permissions and existing RLS apply.
create or replace function public.submit_workout_atomic(
  p_workout_id uuid,
  p_session_id uuid,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_client_notes text,
  p_sets jsonb,
  p_feedback jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_client uuid := auth.uid();
  v_workout public.workouts%rowtype;
  v_set jsonb;
  v_prescribed uuid;
  v_count integer := 0;
begin
  if v_client is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_workout_id is null or p_session_id is null then
    raise exception 'Workout and session IDs are required';
  end if;
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets)>300 then
    raise exception 'Invalid completed sets payload';
  end if;
  if p_feedback is null or jsonb_typeof(p_feedback)<>'object' then
    raise exception 'Invalid feedback payload';
  end if;
  if p_completed_at is null or p_started_at is null or p_completed_at < p_started_at then
    raise exception 'Invalid workout timestamps';
  end if;

  select * into v_workout from public.workouts where id=p_workout_id for update;
  if found then
    if v_workout.client_id <> v_client or v_workout.session_id <> p_session_id then
      raise exception 'Workout ownership or session mismatch' using errcode='42501';
    end if;
    if v_workout.status='completed' then
      return jsonb_build_object('status','already_synced','workout_id',p_workout_id);
    end if;
    -- Never mix with a partially submitted legacy workout.
    if exists(select 1 from public.completed_sets where workout_id=p_workout_id)
       or exists(select 1 from public.session_feedback where workout_id=p_workout_id) then
      raise exception 'Existing partial workout requires manual reconciliation';
    end if;
  else
    insert into public.workouts(id,client_id,session_id,started_at,status)
    values(p_workout_id,v_client,p_session_id,p_started_at,'in_progress');
  end if;

  for v_set in select value from jsonb_array_elements(p_sets)
  loop
    if jsonb_typeof(v_set)<>'object'
       or nullif(trim(v_set->>'exercise_name'),'') is null
       or (v_set->>'set_number')::integer < 1 then
      raise exception 'Invalid completed set';
    end if;
    v_prescribed := nullif(v_set->>'prescribed_set_id','')::uuid;
    if v_prescribed is not null and not exists(
      select 1 from public.prescribed_sets ps
      join public.session_exercises se on se.id=ps.session_exercise_id
      where ps.id=v_prescribed and se.session_id=p_session_id
    ) then
      raise exception 'Prescribed set belongs to a different session' using errcode='42501';
    end if;
    insert into public.completed_sets(
      id,workout_id,prescribed_set_id,exercise_name,set_number,
      load_kg,reps,rir,completed,substituted
    ) values(
      (v_set->>'id')::uuid,p_workout_id,v_prescribed,v_set->>'exercise_name',
      (v_set->>'set_number')::integer,
      nullif(v_set->>'load_kg','')::numeric,
      nullif(v_set->>'reps','')::integer,
      nullif(v_set->>'rir','')::numeric,
      coalesce((v_set->>'completed')::boolean,false),
      coalesce((v_set->>'substituted')::boolean,false)
    );
    v_count := v_count+1;
  end loop;

  insert into public.session_feedback(
    workout_id,energy,sleep_hours_band,sleep_quality,pain_reported,
    pain_location,pain_severity,pain_effect,notes
  ) values(
    p_workout_id,p_feedback->>'energy',p_feedback->>'sleep_hours_band',
    p_feedback->>'sleep_quality',
    coalesce((p_feedback->>'pain_reported')::boolean,false),
    p_feedback->>'pain_location',
    nullif(p_feedback->>'pain_severity','')::integer,
    p_feedback->>'pain_effect',p_feedback->>'notes'
  );

  update public.workouts
  set status='completed',completed_at=p_completed_at,client_notes=p_client_notes
  where id=p_workout_id and client_id=v_client;

  return jsonb_build_object('status','synced','workout_id',p_workout_id,'sets',v_count);
end;
$$;
revoke all on function public.submit_workout_atomic(uuid,uuid,timestamptz,timestamptz,text,jsonb,jsonb) from public;
grant execute on function public.submit_workout_atomic(uuid,uuid,timestamptz,timestamptz,text,jsonb,jsonb) to authenticated;
