-- Every minute, drivers who have stopped sending their position are taken off
-- duty, so a request is never offered to a phone that has gone quiet.
--
-- Uses pg_cron, which Supabase provides. Where it is not installed (the local
-- test database) the job is skipped and mark_stale_drivers() must be run by
-- some other scheduler.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- Scheduling under an existing name replaces that job, so this is safe to re-run.
    perform cron.schedule(
      'mark-stale-drivers',
      '* * * * *',
      'select public.mark_stale_drivers()'
    );
  else
    raise notice 'pg_cron is not available: the stale-driver job was not scheduled';
  end if;
end;
$$;
