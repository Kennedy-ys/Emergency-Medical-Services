/**
 * The one place that knows what each request status means on screen.
 * Screens never hard-code a status string, its wording or its colour.
 *
 * label: what the patient reads. tripLabel: what the driver reads.
 * tone: Tailwind classes for a badge (always shown with the label, never colour alone).
 * step: position in the progress bar (0-3), or null for cancelled.
 */
export const STATUS = {
  pending: {
    label: 'Finding an ambulance',
    detail: 'Your request has been received. A driver will accept it shortly.',
    tripLabel: 'Waiting for a driver',
    tone: 'bg-amber-100 text-amber-900',
    step: 0,
  },
  assigned: {
    label: 'Ambulance on the way',
    detail: 'A driver has accepted and is coming to you.',
    tripLabel: 'Go to the patient',
    tone: 'bg-blue-100 text-blue-900',
    step: 1,
  },
  arrived_at_patient: {
    label: 'Ambulance has arrived',
    detail: 'The crew is at your location.',
    tripLabel: 'With the patient',
    tone: 'bg-green-100 text-green-900',
    step: 2,
  },
  en_route_to_hospital: {
    label: 'On the way to hospital',
    detail: 'You are being taken to hospital.',
    tripLabel: 'Go to the hospital',
    tone: 'bg-blue-100 text-blue-900',
    step: 3,
  },
  completed: {
    label: 'Trip completed',
    detail: 'You have arrived at the hospital.',
    tripLabel: 'Trip completed',
    tone: 'bg-green-100 text-green-900',
    step: 4,
  },
  cancelled: {
    label: 'Request cancelled',
    detail: 'This request was cancelled.',
    tripLabel: 'Cancelled',
    tone: 'bg-gray-200 text-gray-900',
    step: null,
  },
};

export const STEPS = ['Requested', 'On the way', 'Arrived', 'To hospital'];

/** Statuses during which a driver is attached and the trip is live. */
export const TRIP_STATUSES = ['assigned', 'arrived_at_patient', 'en_route_to_hospital'];

export const isFinished = (status) => status === 'completed' || status === 'cancelled';
export const isOnTrip = (status) => TRIP_STATUSES.includes(status);
/** The patient may cancel until the ambulance arrives. */
export const patientCanCancel = (status) => status === 'pending' || status === 'assigned';

/** The driver's next action for each trip status. */
export const NEXT_TRIP_ACTION = {
  assigned: 'I have arrived',
  arrived_at_patient: 'Leave for hospital',
  en_route_to_hospital: 'Complete trip',
};

/** Plain words for the stable error codes the server functions raise. */
const ERROR_TEXT = {
  active_request_exists: 'You already have a request in progress.',
  hospital_not_found: 'That hospital is no longer available. Choose another.',
  booking_already_taken: 'Another driver has already accepted this request.',
  driver_not_available: 'Go on duty before accepting a request.',
  invalid_transition: 'This request has moved on. The screen has been refreshed.',
  not_allowed: 'You are not allowed to do that.',
  not_approved: 'Your account has not been approved yet.',
  on_active_trip: 'Finish your current trip first.',
  driver_offline: 'You are off duty.',
  verified_account_required: 'Sign in with your email and password first.',
  already_registered: 'This account is already registered as staff.',
  not_signed_in: 'Sign in and try again.',
};

export function errorText(code, fallback = 'Something went wrong. Try again.') {
  return ERROR_TEXT[code] ?? fallback;
}
