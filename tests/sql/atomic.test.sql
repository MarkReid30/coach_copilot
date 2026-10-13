-- Run after fixture + migration, in a disposable PostgreSQL database.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare
  v_result jsonb;
  v_id uuid := '55555555-5555-4555-8555-555555555555';
  v_bad uuid := '66666666-6666-4666-8666-666666666666';
  v_sets jsonb := '[{"id":"77777777-7777-4777-8777-777777777777","prescribed_set_id":"44444444-4444-4444-8444-444444444444","exercise_name":"Bench","set_number":1,"load_kg":70,"reps":5,"rir":2,"completed":true,"substituted":false}]';
  v_failed boolean := false;
  v_feedback jsonb := '{"energy":"normal","sleep_hours_band":"6-7","sleep_quality":"normal","pain_reported":false,"pain_effect":"none"}';
begin
  v_result:=public.submit_workout_atomic(v_id,'33333333-3333-4333-8333-333333333333','2026-10-13 09:00Z','2026-10-13 10:00Z','test',v_sets,v_feedback);
  if v_result->>'status'<>'synced' then raise exception 'first submission failed: %',v_result;end if;
  v_result:=public.submit_workout_atomic(v_id,'33333333-3333-4333-8333-333333333333','2026-10-13 09:00Z','2026-10-13 10:00Z','test',v_sets,v_feedback);
  if v_result->>'status'<>'already_synced' then raise exception 'retry not idempotent: %',v_result;end if;
  if (select count(*) from public.completed_sets where workout_id=v_id)<>1 then raise exception 'duplicate completed set';end if;
  if (select count(*) from public.session_feedback where workout_id=v_id)<>1 then raise exception 'duplicate feedback';end if;
  if (select count(*) from public.workouts where id=v_id and status='completed')<>1 then raise exception 'workout not completed';end if;
  raise notice 'PASS: atomic submission and idempotent replay';

  begin
    perform public.submit_workout_atomic(v_bad,'33333333-3333-4333-8333-333333333333','2026-10-13 09:00Z','2026-10-13 10:00Z','test',
    '[{"id":"88888888-8888-4888-8888-888888888888","prescribed_set_id":"99999999-9999-4999-8999-999999999999","exercise_name":"Bench","set_number":1}]',v_feedback);
  exception when foreign_key_violation or insufficient_privilege or raise_exception then
    v_failed:=true;
  end;
  if not v_failed then raise exception 'invalid prescribed set unexpectedly accepted';end if;
  if (select count(*) from public.workouts where id=v_bad)<>0 then raise exception 'partial transaction persisted';end if;
  raise notice 'PASS: invalid set rolled back transaction';
end $$;
commit;
begin;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
declare v_result jsonb;v_failed boolean:=false;
begin
  begin
    v_result:=public.submit_workout_atomic(
      '55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333',
      '2026-10-13 09:00Z','2026-10-13 10:00Z','unauthorized','[]','{}');
  exception when insufficient_privilege or raise_exception then
    v_failed:=true;
  end;
  if not v_failed then raise exception 'foreign workout unexpectedly accepted';end if;
  raise notice 'PASS: foreign workout rejected';
end $$;
commit;
