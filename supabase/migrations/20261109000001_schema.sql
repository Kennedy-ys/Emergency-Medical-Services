-- EMS Connect: tables, types and triggers.
-- Design notes: docs/05-BACKEND-SCHEMA.md

-- ---------------------------------------------------------------- types

create type public.user_role           as enum ('patient', 'driver', 'technician', 'admin');
create type public.driver_approval     as enum ('pending', 'approved', 'suspended');
create type public.driver_availability as enum ('offline', 'available', 'busy');
create type public.booking_status      as enum ('pending', 'assigned', 'arrived_at_patient',
                                                'en_route_to_hospital', 'completed', 'cancelled');
create type public.review_status       as enum ('pending', 'approved', 'rejected');
create type public.conversation_status as enum ('open', 'closed');
create type public.message_kind        as enum ('text', 'image');

-- ---------------------------------------------------------------- helpers

-- Great-circle distance in metres. Accurate enough for a single city, and
-- avoids a PostGIS dependency while there are only dozens of rows to rank.
create function public.distance_m(lat1 double precision, lng1 double precision,
                                  lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe
as $$
  select 6371000 * 2 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- tables

-- One row per signed-in user, including anonymous requesters.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'patient',
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.drivers (
  id                uuid primary key references public.profiles (id) on delete cascade,
  ambulance_number  text not null,
  license_plate     text not null,
  approval_status   public.driver_approval not null default 'pending',
  approval_note     text,
  availability      public.driver_availability not null default 'offline',
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- Latest position only: one row per driver, overwritten.
create table public.driver_locations (
  driver_id   uuid primary key references public.drivers (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  heading     real,
  speed       real,
  accuracy    real,
  updated_at  timestamptz not null default now()
);

create table public.hospitals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger hospitals_touch before update on public.hospitals
  for each row execute function public.touch_updated_at();

create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  -- Generated on the device, so a request queued offline can be retried safely.
  client_request_id  uuid not null unique,
  patient_id         uuid not null references public.profiles (id),
  contact_name       text not null check (length(trim(contact_name)) > 0),
  contact_phone      text not null check (length(trim(contact_phone)) > 0),
  notes              text,
  pickup_lat         double precision not null check (pickup_lat between -90 and 90),
  pickup_lng         double precision not null check (pickup_lng between -180 and 180),
  pickup_address     text,
  hospital_id        uuid references public.hospitals (id),
  driver_id          uuid references public.drivers (id),
  status             public.booking_status not null default 'pending',
  created_at         timestamptz not null default now(),
  assigned_at        timestamptz,
  arrived_at         timestamptz,
  departed_at        timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  cancelled_by       uuid references public.profiles (id),
  cancel_reason      text,
  constraint driver_required_when_active check (
    status in ('pending', 'cancelled') or driver_id is not null
  )
);

create index bookings_status_idx  on public.bookings (status, created_at);
create index bookings_patient_idx on public.bookings (patient_id, created_at desc);
create index bookings_driver_idx  on public.bookings (driver_id, created_at desc);

-- A driver has at most one active trip; a patient at most one active request.
create unique index one_active_trip_per_driver on public.bookings (driver_id)
  where status in ('assigned', 'arrived_at_patient', 'en_route_to_hospital');
create unique index one_active_request_per_patient on public.bookings (patient_id)
  where status not in ('completed', 'cancelled');

-- Audit trail. Written only by the functions in the next migration.
create table public.booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  actor_id    uuid references public.profiles (id),
  from_status public.booking_status,
  to_status   public.booking_status not null,
  note        text,
  created_at  timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- Drivers who passed on or released a request; it is hidden from them afterwards.
create table public.booking_declines (
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (booking_id, driver_id)
);

-- Trip record filled in by the crew.
create table public.patient_records (
  id                 uuid primary key default gen_random_uuid(),
  client_request_id  uuid not null unique,
  booking_id         uuid references public.bookings (id),
  recorded_by        uuid not null references public.profiles (id),
  full_name          text not null,
  age                int check (age between 0 and 130),
  gender             text,
  address            text,
  phone              text,
  notes              text,
  lat                double precision,
  lng                double precision,
  is_archived        boolean not null default false,
  created_at         timestamptz not null default now()
);

create table public.conversations (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.profiles (id),
  technician_id  uuid references public.profiles (id),
  booking_id     uuid references public.bookings (id),
  status         public.conversation_status not null default 'open',
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);

create index conversations_queue_idx on public.conversations (status, technician_id, created_at);
create index conversations_patient_idx on public.conversations (patient_id, created_at desc);

create table public.messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id),
  kind             public.message_kind not null default 'text',
  body             text,
  -- Path inside the chat-attachments storage bucket.
  attachment_path  text,
  created_at       timestamptz not null default now(),
  read_at          timestamptz,
  constraint message_has_content check (
    (kind = 'text' and length(trim(body)) > 0) or (kind = 'image' and attachment_path is not null)
  )
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.reviews (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.profiles (id) on delete set null,
  booking_id    uuid references public.bookings (id),
  display_name  text not null check (length(trim(display_name)) > 0),
  rating        int not null check (rating between 1 and 5),
  comment       text not null check (length(trim(comment)) > 0),
  status        public.review_status not null default 'pending',
  moderated_by  uuid references public.profiles (id),
  moderated_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------- new users

-- Every auth user gets a profile, always starting as a patient.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- realtime

alter publication supabase_realtime
  add table public.bookings, public.driver_locations, public.conversations, public.messages;
