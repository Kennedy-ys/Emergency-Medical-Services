# EMS Connect — Backend Schema

Version 1.0 · 2026-11-09 · Target: Supabase (Postgres 15+, PostGIS)

This is the design the migrations were built from. **The SQL in `supabase/migrations/` is now the source of truth**; where it differs from the snippets below, the migrations win. `npm run test:db` checks the rules as each kind of user.

Differences from this design, decided while implementing:

- **No PostGIS.** Distances use a plain `distance_m(lat, lng, lat, lng)` function and the `geog` columns are gone. With dozens of hospitals and drivers this is fast enough, and it removes an extension from the setup. Revisit if the service grows beyond one city.
- **Driver positions are written through `driver_heartbeat(lat, lng, …)`**, which also updates `last_seen_at`. Clients cannot write `driver_locations` directly.
- **Added `set_driver_approval(driver_id, status, note)`** for admins.
- **Policy helper functions** (`is_admin`, `is_approved_driver`, `shares_active_booking`, `owns_booking`, …) keep the policies from referring to each other's tables, which Postgres rejects as recursion.
- **A patient sees their driver's profile and position only while the trip is live**, not after it ends.

## 1. Entities

```
auth.users ─1:1─ profiles ─1:1─ drivers ─1:1─ driver_locations
                    │              │
                    │              └──────────┐
                    ├─1:n─ bookings ──n:1── hospitals
                    │         ├─1:n─ booking_events
                    │         ├─1:n─ booking_declines
                    │         └─1:n─ patient_records
                    ├─1:n─ conversations ─1:n─ messages
                    ├─1:n─ reviews
                    └─1:n─ push_subscriptions
```

## 2. Types

```sql
create extension if not exists postgis with schema extensions;

create type user_role          as enum ('patient', 'driver', 'technician', 'admin');
create type driver_approval    as enum ('pending', 'approved', 'suspended');
create type driver_availability as enum ('offline', 'available', 'busy');
create type booking_status     as enum ('pending', 'assigned', 'arrived_at_patient',
                                        'en_route_to_hospital', 'completed', 'cancelled');
create type review_status      as enum ('pending', 'approved', 'rejected');
create type conversation_status as enum ('open', 'closed');
create type message_kind       as enum ('text', 'image');
```

## 3. Tables

```sql
-- One row per signed-in user (including anonymous requesters).
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'patient',
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table drivers (
  id                uuid primary key references profiles(id) on delete cascade,
  ambulance_number  text not null,
  license_plate     text not null,
  approval_status   driver_approval not null default 'pending',
  approval_note     text,
  availability      driver_availability not null default 'offline',
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- Latest position only; one row per driver, overwritten.
create table driver_locations (
  driver_id   uuid primary key references drivers(id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  heading     real,
  speed       real,
  accuracy    real,
  geog        geography(Point, 4326) generated always as
              (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  updated_at  timestamptz not null default now()
);
create index driver_locations_geog_idx on driver_locations using gist (geog);

create table hospitals (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  lat         double precision not null,
  lng         double precision not null,
  geog        geography(Point, 4326) generated always as
              (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index hospitals_geog_idx on hospitals using gist (geog);

create table bookings (
  id                 uuid primary key default gen_random_uuid(),
  client_request_id  uuid not null unique,          -- made on the device; makes offline retries safe
  patient_id         uuid not null references profiles(id),
  contact_name       text not null,
  contact_phone      text not null,
  notes              text,
  pickup_lat         double precision not null,
  pickup_lng         double precision not null,
  pickup_address     text,
  pickup_geog        geography(Point, 4326) generated always as
                     (st_setsrid(st_makepoint(pickup_lng, pickup_lat), 4326)::geography) stored,
  hospital_id        uuid references hospitals(id),
  driver_id          uuid references drivers(id),
  status             booking_status not null default 'pending',
  created_at         timestamptz not null default now(),
  assigned_at        timestamptz,
  arrived_at         timestamptz,
  departed_at        timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  cancelled_by       uuid references profiles(id),
  cancel_reason      text,
  constraint driver_required_when_active check (
    status in ('pending', 'cancelled') or driver_id is not null
  )
);
create index bookings_status_idx  on bookings (status, created_at);
create index bookings_patient_idx on bookings (patient_id, created_at desc);
create index bookings_driver_idx  on bookings (driver_id, created_at desc);

-- A driver has at most one active trip; a patient at most one active request.
create unique index one_active_trip_per_driver on bookings (driver_id)
  where status in ('assigned', 'arrived_at_patient', 'en_route_to_hospital');
create unique index one_active_request_per_patient on bookings (patient_id)
  where status not in ('completed', 'cancelled');

-- Audit trail: written only by the functions in section 5.
create table booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references bookings(id) on delete cascade,
  actor_id    uuid references profiles(id),
  from_status booking_status,
  to_status   booking_status not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index booking_events_booking_idx on booking_events (booking_id, created_at);

-- Drivers who passed on or released a request; it is hidden from them afterwards.
create table booking_declines (
  booking_id  uuid not null references bookings(id) on delete cascade,
  driver_id   uuid not null references drivers(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (booking_id, driver_id)
);

-- Trip record filled by the crew (replaces the old public "patients" form).
create table patient_records (
  id                 uuid primary key default gen_random_uuid(),
  client_request_id  uuid not null unique,
  booking_id         uuid references bookings(id),
  recorded_by        uuid not null references profiles(id),
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

create table conversations (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references profiles(id),
  technician_id  uuid references profiles(id),
  booking_id     uuid references bookings(id),
  status         conversation_status not null default 'open',
  created_at     timestamptz not null default now(),
  closed_at      timestamptz
);
create index conversations_queue_idx on conversations (status, technician_id, created_at);

create table messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id),
  kind             message_kind not null default 'text',
  body             text,
  attachment_path  text,                              -- path in the chat-attachments bucket
  created_at       timestamptz not null default now(),
  read_at          timestamptz,
  constraint message_has_content check (
    (kind = 'text' and body is not null) or (kind = 'image' and attachment_path is not null)
  )
);
create index messages_conversation_idx on messages (conversation_id, created_at);

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references profiles(id),
  booking_id    uuid references bookings(id),
  display_name  text not null,
  rating        int not null check (rating between 1 and 5),
  comment       text not null,
  status        review_status not null default 'pending',
  moderated_by  uuid references profiles(id),
  moderated_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
```

## 4. Access rules (row-level security)

RLS is enabled on every table. With RLS on and no policy, access is denied, so anything not listed here is forbidden. Roles are read with a helper:

```sql
create or replace function public.auth_role() returns user_role
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;
```

| Table | Patient | Driver | Technician | Admin |
|---|---|---|---|---|
| `profiles` | Read and edit own name, phone, avatar | Same, plus read the patient on own active trip | Same, plus read patients in own conversations | Read all; change role |
| `drivers` | Read the driver assigned to own active request | Read own; edit own vehicle fields and availability | — | Read all; set approval |
| `driver_locations` | Read the driver assigned to own active request | Upsert own, only while approved | — | Read all |
| `hospitals` | Read non-archived (also signed-out visitors) | Same | Same | Full |
| `bookings` | Read own; insert own as `pending` | Read `pending` (if approved and not declined) and own assigned | Read the one linked to own conversation | Read all |
| `booking_events` | Read for own requests | Read for own trips | — | Read all |
| `booking_declines` | — | Read own | — | Read all |
| `patient_records` | — | Insert; read own entries | — | Read, archive |
| `conversations` | Read own; insert own | — | Read unclaimed open ones and own | Read all |
| `messages` | Read and insert in own open conversations | — | Same, for conversations they claimed | Read all |
| `reviews` | Read `approved` (also signed-out); insert own as `pending` | Same | Same | Read all; set status |
| `push_subscriptions` | Own rows only | Own | Own | Own |

Additional guards:

- Clients cannot change `role`, `approval_status`, or any `bookings` column directly. Column privileges are revoked; those changes happen only through the functions below.
- A `handle_new_user` trigger on `auth.users` creates the `profiles` row with role `patient`. Driver registration calls `register_driver(...)`, which sets role `driver` and inserts a `drivers` row as `pending`. Technician and admin roles are granted only by an admin (via an Edge Function using the service key).
- Storage: `avatars` is public-read, owner-write. `chat-attachments` is private; read and write only for the two participants of the conversation named in the path (`{conversation_id}/{file}`).

## 5. Server functions (RPC)

All are `security definer`, check the caller's role, enforce the status diagram in [App Flow section 2](02-APP-FLOW.md), and append to `booking_events`.

| Function | Caller | Effect |
|---|---|---|
| `request_booking(client_request_id, contact_name, contact_phone, notes, pickup_lat, pickup_lng, hospital_id)` | Patient | Inserts a `pending` request. If `client_request_id` already exists, returns the existing row instead of failing |
| `accept_booking(booking_id)` | Approved, available driver | `pending → assigned`; driver becomes `busy`. Fails with `booking_already_taken` if someone else got it |
| `decline_booking(booking_id, reason)` | Driver | Records a decline; request stays `pending` |
| `release_booking(booking_id, reason)` | Assigned driver | `assigned → pending`; driver becomes `available`; records a decline |
| `advance_booking(booking_id)` | Assigned driver | Next step: `assigned → arrived_at_patient → en_route_to_hospital → completed`; sets the matching timestamp; on `completed` driver becomes `available` |
| `cancel_booking(booking_id, reason)` | Owner (while `pending` or `assigned`) or admin (any time before `completed`) | `→ cancelled`; frees the driver |
| `assign_booking(booking_id, driver_id)` | Admin | Assigns or reassigns; frees the previous driver |
| `set_availability(available boolean)` | Approved driver, not on a trip | `available` ⇄ `offline` |
| `nearest_drivers(booking_id, max int)` | Admin | Available drivers ordered by distance to pickup |
| `nearest_hospitals(lat, lng, max int)` | Anyone | Non-archived hospitals ordered by distance |
| `claim_conversation(conversation_id)` | Technician | Sets `technician_id` if still unclaimed |
| `close_conversation(conversation_id)` | Participant | `open → closed` |
| `register_driver(full_name, phone, ambulance_number, license_plate)` | New signed-in user | Creates the pending driver |

Reference implementation for the one where a race matters:

```sql
create or replace function public.accept_booking(p_booking_id uuid)
returns bookings
language plpgsql security definer set search_path = public
as $$
declare
  b bookings;
begin
  if not exists (
    select 1 from drivers
    where id = auth.uid() and approval_status = 'approved' and availability = 'available'
  ) then
    raise exception 'driver_not_available';
  end if;

  update bookings
     set driver_id = auth.uid(), status = 'assigned', assigned_at = now()
   where id = p_booking_id and status = 'pending'
  returning * into b;

  if not found then
    raise exception 'booking_already_taken';
  end if;

  update drivers set availability = 'busy' where id = auth.uid();

  insert into booking_events (booking_id, actor_id, from_status, to_status)
  values (b.id, auth.uid(), 'pending', 'assigned');

  return b;
end;
$$;
```

The single `update … where status = 'pending'` is what guarantees only one driver wins. The current code reads the list and then writes, so two drivers can both "accept".

## 6. Realtime

| Table | Subscribers | Notes |
|---|---|---|
| `bookings` | Owner (own row), drivers (pending list, own trip), admin (all) | Realtime respects the RLS policies above |
| `driver_locations` | Patient with that driver assigned; admin | Driver app upserts at most every 5 seconds, and only after moving about 15 metres. Move to Realtime Broadcast if the write volume ever matters |
| `messages`, `conversations` | Participants; technicians for the queue | |

## 7. Background jobs and Edge Functions

| Name | Trigger | Does |
|---|---|---|
| `notify-new-booking` | Database webhook on `bookings` insert | Web push to approved, available drivers |
| `notify-booking-change` | Webhook on `bookings` status change | Push to patient (assigned, arrived) and to driver (assigned by admin, cancelled) |
| `notify-new-conversation` | Webhook on `conversations` insert | Push to technicians |
| `mark-stale-drivers` | pg_cron every minute | Drivers with `last_seen_at` older than 2 minutes and not on a trip → `offline` |
| `auto-assign` (Should-have) | pg_cron every 30 seconds | `pending` longer than the configured wait → assign nearest available driver |
| `invite-staff` | Called by admin UI | Creates a technician or admin account |
| `send-sms` | Auth hook, only if a non-built-in SMS provider is chosen | Sends the login code |

Dead push subscriptions (HTTP 404 or 410 from the push service) are deleted by the notify functions.

## 8. Data retention and privacy

- `driver_locations` holds only the latest position; no movement history is kept in v1.
- Anonymous users with no requests are purged after 30 days.
- "Delete my data" removes the profile and anonymises contact fields on past requests while keeping the operational record. Retention periods need confirming against the Nigeria Data Protection Act before the pilot.
- Chat images are served through short-lived signed URLs.

## 9. Mapping from the current Firebase data

| Firebase path | New home | Migrate data? |
|---|---|---|
| `hospitals/*` | `hospitals` | Yes — export and import; `archived` → `is_archived`, string `lat`/`lng` → numbers |
| `reviews/*` | `reviews` | Approved ones |
| `patients/*`, `archivedPatients/*` | `patient_records` (`is_archived`) | Only if the records are real; otherwise start clean |
| `bookings/*` | `bookings` | No (test data). `AssignedDriverId` → `driver_id`; `location` → `pickup_lat/lng`; `hospitalLocation` → `hospital_id`; `timestamp` → `created_at` |
| `drivers/*` | `profiles` + `drivers` + `driver_locations` | No — drivers re-register and are approved |
| `drivers/*/connectionState`, `lastSeen` | `drivers.last_seen_at` | — |
| `ambulances/*`, `driverCount`, `ambulanceBookings`, `ambulanceTracking`, `ambulanceLocations` | Dropped with the old ambulance module | No |
| Admin custom claim | `profiles.role = 'admin'`, set once by SQL for the first admin | — |

Status values today are free text and inconsistent (`available`, `Unavailable`, `busy`, `offline`, `active`; `accepted`, `assigned`, `Arrived at Patient`, `En Route to Hospital`). The enums in section 2 are the only allowed values from now on.
