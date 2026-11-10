import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { TRIP_STATUSES } from '../../lib/status';

const TRIP_COLUMNS =
  'id, status, contact_name, contact_phone, notes, pickup_lat, pickup_lng, pickup_address, ' +
  'created_at, assigned_at, hospital:hospitals(id, name, address, phone, lat, lng)';

/** How often a driver's position is uploaded. Drivers silent for 2 minutes are taken off duty. */
export const HEARTBEAT_MS = 15_000;

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------------ reading

/** The signed-in driver's duty state. Polled, because the server can take a silent driver off duty. */
export function useMyDriver(userId) {
  return useQuery({
    queryKey: ['drivers', userId, 'me'],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drivers')
        .select('availability, approval_status, approval_note, ambulance_number, license_plate')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 20_000,
  });
}

/** Refreshes the driver's lists whenever any request they can see changes. */
function useBookingChanges(userId) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!userId) return undefined;
    const channel = supabase
      .channel(`driver-bookings-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        queryClient.invalidateQueries({ queryKey: ['drivers', userId, 'me'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

/** The trip this driver is on, or null. */
export function useMyTrip(userId) {
  useBookingChanges(userId);
  return useQuery({
    queryKey: ['bookings', 'trip', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(TRIP_COLUMNS)
        .eq('driver_id', userId)
        .in('status', TRIP_STATUSES)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15_000,
  });
}

/** Requests waiting for a driver, oldest first. The database hides ones this driver passed on. */
export function useOpenRequests(enabled) {
  return useQuery({
    queryKey: ['bookings', 'open'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(TRIP_COLUMNS)
        .eq('status', 'pending')
        .order('created_at');
      if (error) throw error;
      return data;
    },
    refetchInterval: 10_000,
  });
}

// ------------------------------------------------------------------ changing

function useDriverAction(mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Refresh on failure too: a refusal usually means the screen was out of date.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export const useSetAvailability = () =>
  useDriverAction((available) => rpc('set_availability', { p_available: available }));

export const useAcceptRequest = () =>
  useDriverAction((bookingId) => rpc('accept_booking', { p_booking_id: bookingId }));

export const usePassRequest = () =>
  useDriverAction((bookingId) => rpc('decline_booking', { p_booking_id: bookingId }));

export const useAdvanceTrip = () =>
  useDriverAction((bookingId) => rpc('advance_booking', { p_booking_id: bookingId }));

export const useReleaseTrip = () =>
  useDriverAction((bookingId) =>
    rpc('release_booking', { p_booking_id: bookingId, p_reason: 'Released by driver' })
  );

/** Sends a driver application. The account stays off the road until a dispatcher approves it. */
export const useRegisterDriver = () =>
  useDriverAction(({ fullName, phone, ambulanceNumber, licensePlate }) =>
    rpc('register_driver', {
      p_full_name: fullName,
      p_phone: phone,
      p_ambulance_number: ambulanceNumber,
      p_license_plate: licensePlate,
    })
  );

// ------------------------------------------------------------------ position

/**
 * While `active`, watches the device's position and uploads the latest fix
 * every HEARTBEAT_MS. GPS can fire several times a second; the upload does not.
 * The upload doubles as the "still on duty" signal.
 *
 * @returns {{ position: {lat:number,lng:number}|null,
 *             problem: null|'denied'|'unavailable'|'unsupported' }}
 */
export function useDriverHeartbeat(active) {
  const latest = useRef(null);
  const [position, setPosition] = useState(null);
  const [problem, setProblem] = useState(null);

  useEffect(() => {
    if (!active) return undefined;
    if (!('geolocation' in navigator)) {
      setProblem('unsupported');
      return undefined;
    }

    const send = () => {
      const fix = latest.current;
      if (!fix) return;
      supabase
        .rpc('driver_heartbeat', {
          p_lat: fix.latitude,
          p_lng: fix.longitude,
          p_heading: Number.isFinite(fix.heading) ? fix.heading : null,
          p_speed: Number.isFinite(fix.speed) ? fix.speed : null,
          p_accuracy: Number.isFinite(fix.accuracy) ? fix.accuracy : null,
        })
        .then(() => {});
      // A failed upload is not reported: the next one follows in seconds, and
      // useMyDriver shows it if the server has taken the driver off duty.
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const first = !latest.current;
        latest.current = pos.coords;
        setProblem(null);
        setPosition((previous) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          // Ignore jitter under ~10 m so the screen is not re-sorted constantly.
          if (
            previous &&
            Math.abs(previous.lat - next.lat) < 0.0001 &&
            Math.abs(previous.lng - next.lng) < 0.0001
          ) {
            return previous;
          }
          return next;
        });
        if (first) send();
      },
      (err) => setProblem(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    const timer = setInterval(send, HEARTBEAT_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      latest.current = null;
    };
  }, [active]);

  return { position: active ? position : null, problem: active ? problem : null };
}
