// Decides who is told about a change to a booking, and in what words.
//
// Kept free of any Supabase or Deno code so it can be unit-tested with the rest
// of the app (src/features/push/messages.test.js).
//
// Notifications show on a locked screen, so they never carry a name, a phone
// number or the reason for the call.

/** Seconds a push service keeps trying. A request offer is worthless once stale. */
const OFFER_TTL = 120;
const UPDATE_TTL = 600;

/**
 * @param {{ actor_id: string|null, from_status: string|null, to_status: string }} event
 * @param {{ id: string, patient_id: string, driver_id: string|null, status: string }} booking
 * @returns {Array<{
 *   audience: 'drivers_on_duty' | 'patient' | 'driver',
 *   ttl: number,
 *   payload: { title: string, body: string, url: string, tag: string, urgent: boolean },
 * }>}
 */
export function messagesFor(event, booking) {
  // The booking has moved on since this event (accepted, cancelled...): say nothing.
  if (booking.status !== event.to_status) return [];

  const byPatient = event.actor_id === booking.patient_id;
  const byDriver = booking.driver_id != null && event.actor_id === booking.driver_id;
  const trackUrl = `/track/${booking.id}`;
  const tag = `booking-${booking.id}`;

  const toPatient = (title, body) => ({
    audience: 'patient',
    ttl: UPDATE_TTL,
    payload: { title, body, url: trackUrl, tag, urgent: false },
  });
  const toDriver = (title, body) => ({
    audience: 'driver',
    ttl: UPDATE_TTL,
    payload: { title, body, url: '/driver', tag, urgent: true },
  });
  const offer = {
    audience: 'drivers_on_duty',
    ttl: OFFER_TTL,
    payload: {
      title: 'New ambulance request',
      body: 'A patient is waiting. Open the app to see the pickup point.',
      url: '/driver',
      tag,
      urgent: true,
    },
  };

  switch (event.to_status) {
    case 'pending':
      // Either a new request, or a driver handed an accepted one back.
      return event.from_status == null
        ? [offer]
        : [
            offer,
            toPatient(
              'Finding you another ambulance',
              'The first crew could not come. We are looking for another one now.'
            ),
          ];

    case 'assigned': {
      const out = [];
      if (!byPatient) {
        out.push(toPatient('An ambulance is on its way', 'Open the app to follow it on the map.'));
      }
      // Given to this driver by a dispatcher rather than accepted by them.
      if (!byDriver) {
        out.push(
          toDriver('A trip has been assigned to you', 'Open the app to see the pickup point.')
        );
      }
      return out;
    }

    case 'arrived_at_patient':
      return [toPatient('The ambulance has arrived', 'The crew is at your pickup point.')];

    case 'cancelled': {
      const out = [];
      if (booking.driver_id != null && !byDriver) {
        out.push(
          toDriver('Trip cancelled', 'This trip was cancelled. You are free for other requests.')
        );
      }
      if (!byPatient) {
        out.push(
          toPatient(
            'Your request was cancelled',
            'Open the app for details. If this is life-threatening, call 112.'
          )
        );
      }
      return out;
    }

    default:
      // On the way to hospital and completed: the patient is with the crew.
      return [];
  }
}

/** Push services browsers actually use. Anything else stored as an address is ignored. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];

export function isPushServiceUrl(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}
