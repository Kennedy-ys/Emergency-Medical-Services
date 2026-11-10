import { useEffect, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classifyError, ensureSession, supabase } from '../../lib/supabase';
import { clearPending, getPending, setPending, subscribe } from '../../lib/outbox';
import { isOnTrip } from '../../lib/status';

const BOOKING_COLUMNS =
  'id, status, contact_name, contact_phone, notes, pickup_lat, pickup_lng, pickup_address, ' +
  'driver_id, hospital_id, created_at, assigned_at, arrived_at, departed_at, completed_at, ' +
  'cancelled_at, hospital:hospitals(id, name, address, phone, lat, lng)';

// ------------------------------------------------------------------ sending

let inFlight = null;

async function send(request) {
  await ensureSession();
  const { data, error } = await supabase.rpc('request_booking', {
    p_client_request_id: request.clientRequestId,
    p_contact_name: request.contactName,
    p_contact_phone: request.contactPhone,
    p_pickup_lat: request.pickup.lat,
    p_pickup_lng: request.pickup.lng,
    p_hospital_id: request.hospitalId ?? null,
    p_notes: request.notes ?? null,
  });
  if (error) throw error;
  return data;
}

/**
 * Tries to deliver the request held in the outbox. Safe to call from several
 * places at once: concurrent calls share one attempt.
 *
 * @returns {Promise<{ status: 'empty' } | { status: 'sent', booking: object }
 *   | { status: 'queued' } | { status: 'rejected', code: string }>}
 */
export function flushPendingRequest() {
  if (inFlight) return inFlight;
  const request = getPending();
  if (!request) return Promise.resolve({ status: 'empty' });

  inFlight = send(request)
    .then((booking) => {
      clearPending();
      return { status: 'sent', booking };
    })
    .catch((error) => {
      const { kind, code } = classifyError(error);
      if (kind === 'business') {
        // The server answered and said no; retrying the same request cannot help.
        clearPending();
        return { status: 'rejected', code };
      }
      return { status: 'queued' };
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Saves a new request on the device, then tries to send it.
 * @param {{ contactName: string, contactPhone: string, notes?: string,
 *           pickup: {lat:number,lng:number}, hospitalId?: string|null }} details
 */
export function submitRequest(details) {
  const request = { ...details, clientRequestId: crypto.randomUUID(), savedAt: Date.now() };
  if (setPending(request)) return flushPendingRequest();

  // The device would not store it, so it cannot be queued: one direct attempt.
  return send(request)
    .then((booking) => ({ status: 'sent', booking }))
    .catch((error) => {
      const { kind, code } = classifyError(error);
      return kind === 'business' ? { status: 'rejected', code } : { status: 'failed' };
    });
}

export function discardPendingRequest() {
  clearPending();
}

/** The request waiting on this device to be sent, or null. */
export function usePendingRequest() {
  return useSyncExternalStore(subscribe, getPending, () => null);
}

// ------------------------------------------------------------------ reading

/** The signed-in patient's request that is still in progress, or null. */
export function useActiveBooking(userId) {
  return useQuery({
    queryKey: ['bookings', 'active', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('patient_id', userId)
        .not('status', 'in', '(completed,cancelled)')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** One request, kept current by realtime with polling as a safety net. */
export function useBooking(bookingId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!bookingId) return undefined;
    const channel = supabase
      .channel(`booking-${bookingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bookings', bookingId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, queryClient]);

  return useQuery({
    queryKey: ['bookings', bookingId],
    enabled: Boolean(bookingId),
    queryFn: async () => {
      // A request made on this device belongs to its (possibly anonymous) session.
      await ensureSession();
      const { data, error } = await supabase
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .eq('id', bookingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && status !== 'completed' && status !== 'cancelled' ? 10_000 : false;
    },
  });
}

/** Name, phone and vehicle of the driver on a live trip. Hidden by the database afterwards. */
export function useTripDriver(booking) {
  const driverId = booking?.driver_id;
  const live = isOnTrip(booking?.status);
  return useQuery({
    queryKey: ['drivers', driverId, 'card'],
    enabled: Boolean(driverId) && live,
    queryFn: async () => {
      const [profile, driver] = await Promise.all([
        supabase.from('profiles').select('full_name, phone').eq('id', driverId).maybeSingle(),
        supabase
          .from('drivers')
          .select('ambulance_number, license_plate')
          .eq('id', driverId)
          .maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (driver.error) throw driver.error;
      return { ...profile.data, ...driver.data };
    },
    staleTime: 60_000,
  });
}

/** The driver's latest position during a live trip. */
export function useDriverLocation(booking) {
  const driverId = booking?.driver_id;
  const live = isOnTrip(booking?.status);
  const queryClient = useQueryClient();
  const enabled = Boolean(driverId) && live;

  useEffect(() => {
    if (!enabled) return undefined;
    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.new?.lat != null) {
            queryClient.setQueryData(['driver_locations', driverId], payload.new);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, driverId, queryClient]);

  return useQuery({
    queryKey: ['driver_locations', driverId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('lat, lng, heading, updated_at')
        .eq('driver_id', driverId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });
}

// ------------------------------------------------------------------ changing

export function useCancelBooking(bookingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reason) => {
      const { error } = await supabase.rpc('cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });
}
