import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

/** Tabs shown across the dispatcher's screens. */
export const ADMIN_NAV = [
  { to: '/admin/dispatch', label: 'Dispatch' },
  { to: '/admin/bookings', label: 'Requests' },
  { to: '/admin/drivers', label: 'Drivers' },
  { to: '/admin/hospitals', label: 'Hospitals' },
  { to: '/admin/records', label: 'Records' },
  { to: '/admin/reviews', label: 'Reviews' },
  { to: '/admin/staff', label: 'Staff' },
];

const BOOKING_COLUMNS =
  'id, status, contact_name, contact_phone, notes, pickup_lat, pickup_lng, pickup_address, ' +
  'driver_id, created_at, assigned_at, arrived_at, departed_at, completed_at, cancelled_at, ' +
  'cancel_reason, hospital:hospitals(id, name, address, lat, lng), ' +
  // The foreign key is named because bookings also reach drivers through booking_declines.
  'driver:drivers!bookings_driver_id_fkey(id, ambulance_number, license_plate, ' +
  'profile:profiles(full_name, phone))';

const DRIVER_COLUMNS =
  'id, ambulance_number, license_plate, approval_status, approval_note, availability, ' +
  'last_seen_at, created_at, profile:profiles(full_name, phone), ' +
  'location:driver_locations(lat, lng, updated_at)';

/** A one-to-one embed can arrive as an object or a one-item list; always hand back the object. */
const one = (value) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

const tidyDriver = (row) => ({ ...row, profile: one(row.profile), location: one(row.location) });
const tidyBooking = (row) => ({
  ...row,
  hospital: one(row.hospital),
  driver: row.driver ? { ...one(row.driver), profile: one(one(row.driver)?.profile) } : null,
});

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------------ reading

/** Refreshes every request list whenever any request changes. */
function useBookingChanges() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'drivers'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Requests that are not finished, oldest first. Realtime, with polling as a safety net. */
export function useLiveBookings() {
  useBookingChanges();
  return useQuery({
    queryKey: ['admin', 'bookings', 'live'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .not('status', 'in', '(completed,cancelled)')
        .order('created_at');
      if (error) throw error;
      return data.map(tidyBooking);
    },
    refetchInterval: 10_000,
  });
}

export const HISTORY_FILTERS = {
  all: { label: 'All', statuses: null },
  live: {
    label: 'In progress',
    statuses: ['pending', 'assigned', 'arrived_at_patient', 'en_route_to_hospital'],
  },
  completed: { label: 'Completed', statuses: ['completed'] },
  cancelled: { label: 'Cancelled', statuses: ['cancelled'] },
};

/** The most recent requests, newest first. */
export function useBookingHistory(filter) {
  return useQuery({
    queryKey: ['admin', 'bookings', 'history', filter],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(100);
      const statuses = HISTORY_FILTERS[filter]?.statuses;
      if (statuses) query = query.in('status', statuses);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(tidyBooking);
    },
    refetchInterval: 30_000,
  });
}

/** One request and everything that has happened to it. */
export function useBookingDetail(bookingId) {
  return useQuery({
    queryKey: ['admin', 'bookings', 'detail', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      const [booking, events] = await Promise.all([
        supabase.from('bookings').select(BOOKING_COLUMNS).eq('id', bookingId).maybeSingle(),
        supabase
          .from('booking_events')
          .select('id, from_status, to_status, note, created_at, actor:profiles(full_name, role)')
          .eq('booking_id', bookingId)
          .order('created_at'),
      ]);
      if (booking.error) throw booking.error;
      if (events.error) throw events.error;
      if (!booking.data) return null;
      return {
        booking: tidyBooking(booking.data),
        events: events.data.map((event) => ({ ...event, actor: one(event.actor) })),
      };
    },
    refetchInterval: 15_000,
  });
}

/** Every driver, with their last known position. Polled: driver rows are not sent in realtime. */
export function useDrivers() {
  return useQuery({
    queryKey: ['admin', 'drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select(DRIVER_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(tidyDriver);
    },
    refetchInterval: 10_000,
  });
}

/** Free, approved drivers closest to a request's pickup point. */
export function useNearestDrivers(bookingId) {
  return useQuery({
    queryKey: ['admin', 'drivers', 'nearest', bookingId],
    enabled: Boolean(bookingId),
    queryFn: () => rpc('nearest_drivers', { p_booking_id: bookingId, p_max: 5 }),
    refetchInterval: 10_000,
  });
}

/** Every hospital, including archived ones. */
export function useAllHospitals() {
  return useQuery({
    queryKey: ['admin', 'hospitals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hospitals')
        .select('id, name, address, phone, lat, lng, is_archived')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export const REVIEW_FILTERS = {
  pending: 'Waiting',
  approved: 'Published',
  rejected: 'Rejected',
};

/** Reviews in one moderation state, newest first. */
export function useReviews(status) {
  return useQuery({
    queryKey: ['admin', 'reviews', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, display_name, rating, comment, status, created_at, moderated_at')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

/** Trip records written by ambulance crews, newest first. */
export function usePatientRecords(archived) {
  return useQuery({
    queryKey: ['admin', 'records', archived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_records')
        .select(
          'id, booking_id, full_name, age, gender, address, phone, notes, is_archived, ' +
            'created_at, recorder:profiles(full_name)'
        )
        .eq('is_archived', archived)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data.map((row) => ({ ...row, recorder: one(row.recorder) }));
    },
  });
}

/** Dispatchers and technicians. Drivers have their own screen. */
export function useStaff() {
  return useQuery({
    queryKey: ['admin', 'staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, phone, created_at')
        .in('role', ['admin', 'technician'])
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

// ------------------------------------------------------------------ changing

function useAdminAction(mutationFn, keys = [['admin']]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Refresh on failure too: a refusal usually means the screen was out of date.
    onSettled: () => keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey })),
  });
}

export const useAssignDriver = () =>
  useAdminAction(({ bookingId, driverId }) =>
    rpc('assign_booking', { p_booking_id: bookingId, p_driver_id: driverId })
  );

export const useCancelRequest = () =>
  useAdminAction(({ bookingId, reason }) =>
    rpc('cancel_booking', { p_booking_id: bookingId, p_reason: reason })
  );

export const useSetDriverApproval = () =>
  useAdminAction(({ driverId, status, note }) =>
    rpc('set_driver_approval', { p_driver_id: driverId, p_status: status, p_note: note ?? null })
  );

/** Adds a hospital, or updates the one with the given id. */
export const useSaveHospital = () =>
  useAdminAction(
    async ({ id, ...fields }) => {
      const query = id
        ? supabase.from('hospitals').update(fields).eq('id', id)
        : supabase.from('hospitals').insert(fields);
      const { error } = await query;
      if (error) throw error;
    },
    [['admin', 'hospitals'], ['hospitals']]
  );

/** Hides a hospital from the public list, or brings it back. Past requests keep their link to it. */
export const useArchiveHospital = () =>
  useAdminAction(
    async ({ id, archived }) => {
      const { error } = await supabase
        .from('hospitals')
        .update({ is_archived: archived })
        .eq('id', id);
      if (error) throw error;
    },
    [['admin', 'hospitals'], ['hospitals']]
  );

/** Publishes or rejects a review, recording who decided. */
export const useModerateReview = () =>
  useAdminAction(
    async ({ id, status }) => {
      const { data } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('reviews')
        .update({
          status,
          moderated_by: data.session?.user.id ?? null,
          moderated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    [['admin', 'reviews'], ['reviews']]
  );

/** Moves a trip record out of, or back into, the current list. Nothing is deleted. */
export const useArchiveRecord = () =>
  useAdminAction(
    async ({ id, archived }) => {
      const { error } = await supabase
        .from('patient_records')
        .update({ is_archived: archived })
        .eq('id', id);
      if (error) throw error;
    },
    [['admin', 'records']]
  );

const INVITE_ERRORS = {
  already_registered: 'Someone with this email already has an account.',
  not_admin: 'Only a dispatcher can invite staff.',
  invalid_input: 'Check the name and email address and try again.',
};

/** Words for a failed invitation. */
export function inviteErrorMessage(error) {
  return (
    INVITE_ERRORS[error?.code] ??
    'Could not send the invitation. Check your connection and try again.'
  );
}

/** Emails an invitation; the account is created with the chosen role by the invite-staff function. */
export const useInviteStaff = () =>
  useAdminAction(
    async ({ email, fullName, role }) => {
      const { error } = await supabase.functions.invoke('invite-staff', {
        body: { email, full_name: fullName, role },
      });
      if (!error) return;
      // The function answers refusals with { error: 'code' }.
      let code = null;
      try {
        code = (await error.context?.json())?.error ?? null;
      } catch {
        // Not a JSON answer: treat as a connection problem.
      }
      throw Object.assign(new Error('invite_failed'), { code });
    },
    [['admin', 'staff']]
  );
