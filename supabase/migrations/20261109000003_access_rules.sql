-- EMS Connect: who can read and write what.
-- Two layers: table privileges (which operations and columns a client may
-- touch at all) and row-level security policies (which rows).
-- Anything not granted here is denied.

-- ---------------------------------------------------------------- privileges

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Signed-out visitors: public reference data only.
grant select on public.hospitals, public.reviews to anon;

grant select on public.profiles, public.drivers, public.driver_locations, public.hospitals,
                public.bookings, public.booking_events, public.booking_declines,
                public.patient_records, public.conversations, public.messages,
                public.reviews, public.push_subscriptions
  to authenticated;

-- Direct writes are limited to these columns. Role, approval, availability,
-- positions and everything on bookings change only through functions.
grant update (full_name, phone, avatar_url)        on public.profiles to authenticated;
grant update (ambulance_number, license_plate)     on public.drivers  to authenticated;
grant insert (name, address, phone, lat, lng),
      update (name, address, phone, lat, lng, is_archived)
                                                   on public.hospitals to authenticated;
grant insert (client_request_id, booking_id, recorded_by, full_name, age, gender,
              address, phone, notes, lat, lng),
      update (is_archived)                         on public.patient_records to authenticated;
grant insert (patient_id, booking_id)              on public.conversations to authenticated;
grant insert (conversation_id, sender_id, kind, body, attachment_path),
      update (read_at)                             on public.messages to authenticated;
grant insert (author_id, booking_id, display_name, rating, comment),
      update (status, moderated_by, moderated_at)  on public.reviews to authenticated;
grant insert (user_id, endpoint, p256dh, auth, user_agent), delete
                                                   on public.push_subscriptions to authenticated;

-- Functions clients may call.
-- is_admin is used by the hospitals and reviews policies, which signed-out
-- visitors are evaluated against too.
grant execute on function
  public.nearest_hospitals(double precision, double precision, integer),
  public.distance_m(double precision, double precision, double precision, double precision),
  public.is_admin()
  to anon, authenticated;

grant execute on function
  public.auth_role(),
  public.is_approved_driver(),
  public.shares_active_booking(uuid),
  public.in_conversation_with(uuid),
  public.is_conversation_participant(uuid),
  public.can_post_to_conversation(uuid),
  public.owns_booking(uuid),
  public.is_technician_for_booking(uuid),
  public.request_booking(uuid, text, text, double precision, double precision, uuid, text, text),
  public.accept_booking(uuid),
  public.decline_booking(uuid, text),
  public.release_booking(uuid, text),
  public.advance_booking(uuid),
  public.cancel_booking(uuid, text),
  public.assign_booking(uuid, uuid),
  public.register_driver(text, text, text, text),
  public.set_driver_approval(uuid, public.driver_approval, text),
  public.set_availability(boolean),
  public.driver_heartbeat(double precision, double precision, real, real, real),
  public.nearest_drivers(uuid, integer),
  public.claim_conversation(uuid),
  public.close_conversation(uuid)
  to authenticated;

-- mark_stale_drivers is for the scheduler only.
grant execute on function public.mark_stale_drivers() to service_role;

-- ---------------------------------------------------------------- row-level security

alter table public.profiles           enable row level security;
alter table public.drivers            enable row level security;
alter table public.driver_locations   enable row level security;
alter table public.hospitals          enable row level security;
alter table public.bookings           enable row level security;
alter table public.booking_events     enable row level security;
alter table public.booking_declines   enable row level security;
alter table public.patient_records    enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.reviews            enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: yourself, the other party on a live trip or in a chat, or admin.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
    or public.shares_active_booking(id)
    or public.in_conversation_with(id)
  );

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- drivers: yourself, the driver on your live request, or admin.
create policy drivers_select on public.drivers for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
    or public.shares_active_booking(id)
  );

create policy drivers_update_own on public.drivers for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy driver_locations_select on public.driver_locations for select to authenticated
  using (
    driver_id = (select auth.uid())
    or public.is_admin()
    or public.shares_active_booking(driver_id)
  );

-- hospitals: everyone reads the active list; admins manage it.
create policy hospitals_select on public.hospitals for select to anon, authenticated
  using (not is_archived or public.is_admin());

create policy hospitals_insert_admin on public.hospitals for insert to authenticated
  with check (public.is_admin());

create policy hospitals_update_admin on public.hospitals for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- bookings: your own request, your own trip, the open queue for approved
-- drivers (minus ones they passed on), the request linked to a chat you
-- claimed, or admin.
create policy bookings_select on public.bookings for select to authenticated
  using (
    patient_id = (select auth.uid())
    or driver_id = (select auth.uid())
    or public.is_admin()
    or (
      status = 'pending'
      and public.is_approved_driver()
      and not exists (
        select 1 from public.booking_declines d
        where d.booking_id = bookings.id and d.driver_id = (select auth.uid())
      )
    )
    or public.is_technician_for_booking(id)
  );

create policy booking_events_select on public.booking_events for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_events.booking_id
        and (select auth.uid()) in (b.patient_id, b.driver_id)
    )
  );

create policy booking_declines_select on public.booking_declines for select to authenticated
  using (driver_id = (select auth.uid()) or public.is_admin());

-- patient records: crew write their own; admins read and archive.
create policy patient_records_select on public.patient_records for select to authenticated
  using (recorded_by = (select auth.uid()) or public.is_admin());

create policy patient_records_insert on public.patient_records for insert to authenticated
  with check (
    recorded_by = (select auth.uid())
    and public.auth_role() in ('driver', 'admin')
  );

create policy patient_records_update_admin on public.patient_records for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- conversations: participants, technicians for the waiting queue, admin.
create policy conversations_select on public.conversations for select to authenticated
  using (
    patient_id = (select auth.uid())
    or technician_id = (select auth.uid())
    or public.is_admin()
    or (technician_id is null and status = 'open' and public.auth_role() = 'technician')
  );

create policy conversations_insert_own on public.conversations for insert to authenticated
  with check (
    patient_id = (select auth.uid())
    and (booking_id is null or public.owns_booking(booking_id))
  );

create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.is_admin());

create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_post_to_conversation(conversation_id)
  );

-- Marking a message read: only the participant who did not send it.
create policy messages_mark_read on public.messages for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and public.is_conversation_participant(conversation_id)
  )
  with check (
    sender_id <> (select auth.uid())
    and public.is_conversation_participant(conversation_id)
  );

-- reviews: the public sees approved ones; authors see their own; admins moderate.
create policy reviews_select on public.reviews for select to anon, authenticated
  using (
    status = 'approved'
    or author_id = (select auth.uid())
    or public.is_admin()
  );

create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy reviews_update_admin on public.reviews for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
