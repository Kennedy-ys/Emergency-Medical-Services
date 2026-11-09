-- EMS Connect: server functions.
-- Every change to a booking goes through these, so the status rules and the
-- audit trail cannot be skipped by a client. Error messages are stable codes
-- the app maps to user-facing text.

-- ---------------------------------------------------------------- role helpers
-- security definer so they can be used inside row-level security policies
-- without the policies recursing into each other.

create function public.auth_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create function public.is_approved_driver()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.drivers
    where id = (select auth.uid()) and approval_status = 'approved'
  )
$$;

-- True while the caller and the other user are patient and driver on a live trip.
create function public.shares_active_booking(p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.status in ('assigned', 'arrived_at_patient', 'en_route_to_hospital')
      and ((b.patient_id = (select auth.uid()) and b.driver_id = p_other)
        or (b.driver_id = (select auth.uid()) and b.patient_id = p_other))
  )
$$;

create function public.in_conversation_with(p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where (c.patient_id = (select auth.uid()) and c.technician_id = p_other)
       or (c.technician_id = (select auth.uid()) and c.patient_id = p_other)
  )
$$;

create function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (select auth.uid()) in (c.patient_id, c.technician_id)
  )
$$;

create function public.can_post_to_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.status = 'open'
      and (select auth.uid()) in (c.patient_id, c.technician_id)
  )
$$;

create function public.owns_booking(p_booking_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id and b.patient_id = (select auth.uid())
  )
$$;

-- True for the technician who claimed a chat linked to this request.
create function public.is_technician_for_booking(p_booking_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.booking_id = p_booking_id and c.technician_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------- bookings

create function public.request_booking(
  p_client_request_id uuid,
  p_contact_name      text,
  p_contact_phone     text,
  p_pickup_lat        double precision,
  p_pickup_lng        double precision,
  p_hospital_id       uuid default null,
  p_notes             text default null,
  p_pickup_address    text default null
)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  b     public.bookings;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- A retry of a request that already arrived returns the original.
  select * into b from public.bookings where client_request_id = p_client_request_id;
  if found then
    if b.patient_id <> v_uid then
      raise exception 'not_allowed';
    end if;
    return b;
  end if;

  if p_hospital_id is not null and not exists (
    select 1 from public.hospitals where id = p_hospital_id and not is_archived
  ) then
    raise exception 'hospital_not_found';
  end if;

  begin
    insert into public.bookings (client_request_id, patient_id, contact_name, contact_phone,
                                 notes, pickup_lat, pickup_lng, pickup_address, hospital_id)
    values (p_client_request_id, v_uid, trim(p_contact_name), trim(p_contact_phone),
            nullif(trim(p_notes), ''), p_pickup_lat, p_pickup_lng,
            nullif(trim(p_pickup_address), ''), p_hospital_id)
    returning * into b;
  exception when unique_violation then
    select * into b from public.bookings
     where client_request_id = p_client_request_id and patient_id = v_uid;
    if found then
      return b;
    end if;
    raise exception 'active_request_exists';
  end;

  -- Remember the contact details for next time.
  update public.profiles
     set full_name = coalesce(full_name, b.contact_name),
         phone     = coalesce(phone, b.contact_phone)
   where id = v_uid;

  insert into public.booking_events (booking_id, actor_id, to_status)
  values (b.id, v_uid, 'pending');

  return b;
end;
$$;

create function public.accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  b     public.bookings;
begin
  if not exists (
    select 1 from public.drivers
    where id = v_uid and approval_status = 'approved' and availability = 'available'
  ) then
    raise exception 'driver_not_available';
  end if;

  -- The status check inside the update is what lets only one driver win.
  update public.bookings
     set driver_id = v_uid, status = 'assigned', assigned_at = now()
   where id = p_booking_id and status = 'pending'
  returning * into b;

  if not found then
    raise exception 'booking_already_taken';
  end if;

  update public.drivers set availability = 'busy', last_seen_at = now() where id = v_uid;

  insert into public.booking_events (booking_id, actor_id, from_status, to_status)
  values (b.id, v_uid, 'pending', 'assigned');

  return b;
end;
$$;

create function public.decline_booking(p_booking_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_approved_driver() then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.bookings where id = p_booking_id and status = 'pending') then
    raise exception 'not_allowed';
  end if;

  insert into public.booking_declines (booking_id, driver_id, reason)
  values (p_booking_id, v_uid, nullif(trim(p_reason), ''))
  on conflict do nothing;
end;
$$;

create function public.release_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  b     public.bookings;
begin
  update public.bookings
     set driver_id = null, status = 'pending', assigned_at = null
   where id = p_booking_id and driver_id = v_uid and status = 'assigned'
  returning * into b;

  if not found then
    raise exception 'not_allowed';
  end if;

  update public.drivers set availability = 'available' where id = v_uid;

  insert into public.booking_declines (booking_id, driver_id, reason)
  values (b.id, v_uid, nullif(trim(p_reason), ''))
  on conflict do nothing;

  insert into public.booking_events (booking_id, actor_id, from_status, to_status, note)
  values (b.id, v_uid, 'assigned', 'pending', nullif(trim(p_reason), ''));

  return b;
end;
$$;

-- Moves the caller's trip one step forward:
-- assigned -> arrived_at_patient -> en_route_to_hospital -> completed
create function public.advance_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_from public.booking_status;
  b      public.bookings;
begin
  select * into b from public.bookings
   where id = p_booking_id and driver_id = v_uid
     for update;

  if not found then
    raise exception 'not_allowed';
  end if;

  v_from := b.status;

  if v_from = 'assigned' then
    update public.bookings set status = 'arrived_at_patient', arrived_at = now()
     where id = b.id returning * into b;
  elsif v_from = 'arrived_at_patient' then
    update public.bookings set status = 'en_route_to_hospital', departed_at = now()
     where id = b.id returning * into b;
  elsif v_from = 'en_route_to_hospital' then
    update public.bookings set status = 'completed', completed_at = now()
     where id = b.id returning * into b;
    update public.drivers set availability = 'available' where id = v_uid;
  else
    raise exception 'invalid_transition';
  end if;

  insert into public.booking_events (booking_id, actor_id, from_status, to_status)
  values (b.id, v_uid, v_from, b.status);

  return b;
end;
$$;

-- Patients may cancel until the ambulance arrives; admins until completion.
create function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_from public.booking_status;
  b      public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;

  if not found then
    raise exception 'not_allowed';
  end if;

  v_from := b.status;

  if public.is_admin() then
    if v_from in ('completed', 'cancelled') then
      raise exception 'invalid_transition';
    end if;
  elsif b.patient_id = v_uid then
    if v_from not in ('pending', 'assigned') then
      raise exception 'invalid_transition';
    end if;
  else
    raise exception 'not_allowed';
  end if;

  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid,
         cancel_reason = nullif(trim(p_reason), '')
   where id = b.id
  returning * into b;

  if b.driver_id is not null then
    update public.drivers set availability = 'available'
     where id = b.driver_id and availability = 'busy';
  end if;

  insert into public.booking_events (booking_id, actor_id, from_status, to_status, note)
  values (b.id, v_uid, v_from, 'cancelled', b.cancel_reason);

  return b;
end;
$$;

-- Dispatcher assigns or reassigns a request.
create function public.assign_booking(p_booking_id uuid, p_driver_id uuid)
returns public.bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_from       public.booking_status;
  v_old_driver uuid;
  b            public.bookings;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  select * into b from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;
  if b.status not in ('pending', 'assigned') then
    raise exception 'invalid_transition';
  end if;

  v_from := b.status;
  v_old_driver := b.driver_id;

  if v_old_driver is not distinct from p_driver_id then
    return b;
  end if;

  -- Claim the new driver first; fails if they are not free.
  update public.drivers set availability = 'busy'
   where id = p_driver_id and approval_status = 'approved' and availability = 'available';
  if not found then
    raise exception 'driver_not_available';
  end if;

  update public.bookings
     set driver_id = p_driver_id, status = 'assigned', assigned_at = now()
   where id = b.id
  returning * into b;

  if v_old_driver is not null then
    update public.drivers set availability = 'available'
     where id = v_old_driver and availability = 'busy';
  end if;

  insert into public.booking_events (booking_id, actor_id, from_status, to_status, note)
  values (b.id, v_uid, v_from, 'assigned', 'assigned by dispatcher');

  return b;
end;
$$;

-- ---------------------------------------------------------------- drivers

create function public.register_driver(
  p_full_name        text,
  p_phone            text,
  p_ambulance_number text,
  p_license_plate    text
)
returns public.drivers
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d     public.drivers;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'verified_account_required';
  end if;
  if public.auth_role() is distinct from 'patient' then
    raise exception 'already_registered';
  end if;

  update public.profiles
     set role = 'driver', full_name = trim(p_full_name), phone = trim(p_phone)
   where id = v_uid;

  insert into public.drivers (id, ambulance_number, license_plate)
  values (v_uid, trim(p_ambulance_number), trim(p_license_plate))
  returning * into d;

  return d;
end;
$$;

create function public.set_driver_approval(
  p_driver_id uuid,
  p_status    public.driver_approval,
  p_note      text default null
)
returns public.drivers
language plpgsql security definer set search_path = ''
as $$
declare
  d public.drivers;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  update public.drivers
     set approval_status = p_status,
         approval_note   = nullif(trim(p_note), ''),
         -- A driver who is no longer approved stops receiving requests,
         -- but a trip already under way is left alone.
         availability    = case
                             when p_status <> 'approved' and availability = 'available' then 'offline'
                             else availability
                           end
   where id = p_driver_id
  returning * into d;

  if not found then
    raise exception 'not_allowed';
  end if;

  return d;
end;
$$;

create function public.set_availability(p_available boolean)
returns public.drivers
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  d     public.drivers;
begin
  if not public.is_approved_driver() then
    raise exception 'not_approved';
  end if;
  if exists (
    select 1 from public.bookings
    where driver_id = v_uid
      and status in ('assigned', 'arrived_at_patient', 'en_route_to_hospital')
  ) then
    raise exception 'on_active_trip';
  end if;

  update public.drivers
     set availability = case when p_available then 'available' else 'offline' end::public.driver_availability,
         last_seen_at = now()
   where id = v_uid
  returning * into d;

  return d;
end;
$$;

-- Called by the driver app every few seconds while available or on a trip.
create function public.driver_heartbeat(
  p_lat      double precision,
  p_lng      double precision,
  p_heading  real default null,
  p_speed    real default null,
  p_accuracy real default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.drivers set last_seen_at = now()
   where id = v_uid and approval_status = 'approved' and availability <> 'offline';
  if not found then
    raise exception 'driver_offline';
  end if;

  insert into public.driver_locations (driver_id, lat, lng, heading, speed, accuracy, updated_at)
  values (v_uid, p_lat, p_lng, p_heading, p_speed, p_accuracy, now())
  on conflict (driver_id) do update
    set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
        speed = excluded.speed, accuracy = excluded.accuracy, updated_at = excluded.updated_at;
end;
$$;

-- For a scheduled job: drivers who stopped sending heartbeats go offline.
-- Drivers on a trip are left alone.
create function public.mark_stale_drivers()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.drivers set availability = 'offline'
   where availability = 'available'
     and (last_seen_at is null or last_seen_at < now() - interval '2 minutes');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------- distance queries

create function public.nearest_hospitals(
  p_lat double precision,
  p_lng double precision,
  p_max integer default 10
)
returns table (id uuid, name text, address text, phone text,
               lat double precision, lng double precision, distance_m double precision)
language sql stable set search_path = ''
as $$
  select h.id, h.name, h.address, h.phone, h.lat, h.lng,
         public.distance_m(p_lat, p_lng, h.lat, h.lng)
    from public.hospitals h
   where not h.is_archived
   order by 7
   limit greatest(1, least(p_max, 50))
$$;

create function public.nearest_drivers(p_booking_id uuid, p_max integer default 5)
returns table (driver_id uuid, full_name text, phone text, ambulance_number text,
               license_plate text, lat double precision, lng double precision,
               distance_m double precision, location_updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  return query
  select d.id, p.full_name, p.phone, d.ambulance_number, d.license_plate, l.lat, l.lng,
         public.distance_m(b.pickup_lat, b.pickup_lng, l.lat, l.lng), l.updated_at
    from public.bookings b
    join public.drivers d on d.approval_status = 'approved' and d.availability = 'available'
    join public.driver_locations l on l.driver_id = d.id
    join public.profiles p on p.id = d.id
   where b.id = p_booking_id
   order by 8
   limit greatest(1, least(p_max, 20));
end;
$$;

-- ---------------------------------------------------------------- chat

create function public.claim_conversation(p_conversation_id uuid)
returns public.conversations
language plpgsql security definer set search_path = ''
as $$
declare
  c public.conversations;
begin
  if public.auth_role() is distinct from 'technician' then
    raise exception 'not_allowed';
  end if;

  update public.conversations set technician_id = auth.uid()
   where id = p_conversation_id and technician_id is null and status = 'open'
  returning * into c;

  if not found then
    raise exception 'conversation_already_claimed';
  end if;

  return c;
end;
$$;

create function public.close_conversation(p_conversation_id uuid)
returns public.conversations
language plpgsql security definer set search_path = ''
as $$
declare
  c public.conversations;
begin
  update public.conversations set status = 'closed', closed_at = now()
   where id = p_conversation_id and status = 'open'
     and (auth.uid() in (patient_id, technician_id) or public.is_admin())
  returning * into c;

  if not found then
    raise exception 'not_allowed';
  end if;

  return c;
end;
$$;
