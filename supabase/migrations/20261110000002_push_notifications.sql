-- EMS Connect: push notifications.
--
-- Each change to a booking already writes a row to booking_events. A trigger on
-- that table now asks the push-notify Edge Function to tell the people
-- concerned (drivers on duty for a new request, the patient when an ambulance
-- is assigned, and so on).
--
-- The function is called with nothing but the id of the event. It works out
-- the rest from the database and marks the event as notified, so calling it
-- again, or calling it with a made-up id, sends nothing. That is why the call
-- needs no shared password.

-- Set when the push for this event has been taken on; makes delivery once-only.
alter table public.booking_events add column notified_at timestamptz;

-- ---------------------------------------------------------------- settings
-- Not reachable through the API: the schema is never exposed and no client
-- role is granted anything in it.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- One row holding the address of the push-notify function for this project.
-- While the row is missing no push is attempted, which is the case in local
-- tests. Set it once per project:
--   insert into private.push_config (function_url)
--   values ('https://<project-ref>.supabase.co/functions/v1/push-notify')
--   on conflict (id) do update set function_url = excluded.function_url;
create table private.push_config (
  id            boolean primary key default true check (id),
  function_url  text not null check (function_url ~ '^https://')
);

-- pg_net lets the database make the web request after the change is saved.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  else
    raise notice 'pg_net is not available: booking pushes will not be sent from this database';
  end if;
end;
$$;

create function private.queue_booking_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
begin
  select function_url into v_url from private.push_config;
  if v_url is null then
    return new;
  end if;
  -- A notification must never be the reason a booking change fails.
  begin
    perform net.http_post(
      url     := v_url,
      body    := jsonb_build_object('event_id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  exception when others then
    raise warning 'push for booking event % was not queued: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function private.queue_booking_push() from public;

create trigger booking_events_push
  after insert on public.booking_events
  for each row execute function private.queue_booking_push();

-- ---------------------------------------------------------------- devices
-- A browser's push address belongs to whoever is signed in on it now. When a
-- phone that asked for alerts as a patient is later used by a driver, the
-- address moves to the driver instead of being refused as a duplicate.
create function public.save_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2000
     or p_p256dh is null or length(p_p256dh) not between 20 and 200
     or p_auth is null or length(p_auth) not between 10 and 100 then
    raise exception 'invalid_input';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id    = excluded.user_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant  execute on function public.save_push_subscription(text, text, text, text) to authenticated;
