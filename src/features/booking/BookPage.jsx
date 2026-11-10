import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import LocationPicker from '../../components/map/LocationPicker';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Field from '../../components/ui/Field';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useOnline } from '../../hooks/useOnline';
import { useSession } from '../../hooks/useSession';
import { distanceM, formatDistance } from '../../lib/geo';
import { errorText } from '../../lib/status';
import { useHospitals } from '../hospitals/api';
import {
  discardPendingRequest,
  flushPendingRequest,
  submitRequest,
  useActiveBooking,
  usePendingRequest,
} from './api';
import { NEAREST, requestSchema } from './requestSchema';

const RETRY_MS = 10_000;

function Call112({ className = '' }) {
  return (
    <a
      href="tel:112"
      className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-emergency px-4 font-semibold text-emergency hover:bg-red-50 ${className}`}
    >
      Call 112
    </a>
  );
}

/** Shown while a request is saved on the device but not yet confirmed by the server. */
function WaitingToSend({ onSent, onRejected }) {
  const online = useOnline();
  const [trying, setTrying] = useState(false);

  const callbacks = useRef({ onSent, onRejected });
  useEffect(() => {
    callbacks.current = { onSent, onRejected };
  });

  const attempt = useCallback(async () => {
    setTrying(true);
    const result = await flushPendingRequest();
    setTrying(false);
    if (result.status === 'sent') callbacks.current.onSent(result.booking);
    if (result.status === 'rejected') callbacks.current.onRejected(result.code);
  }, []);

  // Retry when the connection returns, and on a timer in case it is only weak.
  useEffect(() => {
    if (online) attempt();
    const timer = setInterval(attempt, RETRY_MS);
    return () => clearInterval(timer);
  }, [online, attempt]);

  return (
    <Card className="border-2 border-warning p-6" role="status">
      <h2 className="text-lg font-semibold text-gray-900">Not sent yet</h2>
      <p className="mt-1 text-gray-900">
        {online
          ? 'We could not reach the server. We are still trying.'
          : 'You are offline. Your request is saved on this phone and will be sent as soon as you are back online.'}
      </p>
      <p className="mt-2 font-semibold text-gray-900">
        No ambulance has been requested yet. If this is life-threatening, call 112 now.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Call112 />
        <Button variant="secondary" loading={trying} onClick={attempt}>
          Try again now
        </Button>
        <Button variant="ghost" disabled={trying} onClick={discardPendingRequest}>
          Discard request
        </Button>
      </div>
    </Card>
  );
}

export default function BookPage() {
  const navigate = useNavigate();
  const { user, profile } = useSession();
  const pending = usePendingRequest();
  const activeBooking = useActiveBooking(user?.id);
  const hospitals = useHospitals();
  const { status: locationStatus, position, request: locate } = useGeolocation();
  const [pickup, setPickup] = useState(null);
  const [pickupTouched, setPickupTouched] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [pickupError, setPickupError] = useState(false);
  const hospitalFieldId = useId();
  const notesFieldId = useId();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(requestSchema),
    defaultValues: { contactName: '', contactPhone: '', hospitalId: NEAREST, notes: '' },
  });

  // Returning patients do not retype their details.
  useEffect(() => {
    if (profile?.full_name || profile?.phone) {
      reset((values) => ({
        ...values,
        contactName: values.contactName || profile.full_name || '',
        contactPhone: values.contactPhone || profile.phone || '',
      }));
    }
  }, [profile, reset]);

  // Start the pin at the device's location until the person moves it.
  const pin = pickupTouched ? pickup : (pickup ?? position);

  const sortedHospitals = useMemo(() => {
    const rows = (hospitals.data ?? []).map((h) => ({
      ...h,
      distance: pin ? distanceM(pin, h) : null,
    }));
    if (pin) rows.sort((a, b) => a.distance - b.distance);
    return rows;
  }, [hospitals.data, pin]);

  const goToTracking = (booking) => navigate(`/track/${booking.id}`, { replace: true });

  if (activeBooking.data && !pending) {
    return <Navigate to={`/track/${activeBooking.data.id}`} replace />;
  }

  const onSubmit = async (values) => {
    setSubmitError(null);
    if (!pin) {
      setPickupError(true);
      return;
    }
    const result = await submitRequest({
      contactName: values.contactName,
      contactPhone: values.contactPhone,
      notes: values.notes || null,
      pickup: { lat: pin.lat, lng: pin.lng },
      hospitalId:
        values.hospitalId === NEAREST ? (sortedHospitals[0]?.id ?? null) : values.hospitalId,
    });
    if (result.status === 'sent') goToTracking(result.booking);
    if (result.status === 'rejected') setSubmitError(errorText(result.code));
    if (result.status === 'failed') {
      setSubmitError('Could not send your request. Check your connection and try again.');
    }
    // 'queued': the outbox now holds it and the waiting card takes over.
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <Link to="/" className="font-medium text-brand hover:underline">
          Back to home
        </Link>
        <div className="mt-2 mb-4 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Request an ambulance</h1>
          <Call112 className="shrink-0" />
        </div>

        {pending ? (
          <WaitingToSend
            onSent={goToTracking}
            onRejected={(code) => setSubmitError(errorText(code))}
          />
        ) : (
          <form className="space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <h2 className="text-lg font-semibold text-gray-900">Where are you?</h2>
              <p className="mt-1 text-gray-600">
                {pin
                  ? 'Check the pin. Tap the map or drag the pin if it is not exactly where you are.'
                  : locationStatus === 'prompt'
                    ? 'Finding your location… You can also tap the map to mark where you are.'
                    : 'We could not get your location. Tap the map to mark where you are.'}
              </p>
              <div className="mt-3 overflow-hidden rounded-lg">
                <LocationPicker
                  value={pin}
                  onChange={(point) => {
                    setPickup(point);
                    setPickupTouched(true);
                    setPickupError(false);
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPickupTouched(false);
                    setPickup(null);
                    locate();
                  }}
                >
                  Use my current location
                </Button>
                {!pickupTouched && position?.accuracy > 100 && (
                  <p className="text-sm text-gray-600">
                    Accurate to about {formatDistance(position.accuracy)}. Adjust the pin if needed.
                  </p>
                )}
              </div>
              {pickupError && (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  Mark your location on the map so the ambulance can find you.
                </p>
              )}
            </Card>

            <Card className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Who should the crew call?</h2>
              <Field
                label="Your name"
                autoComplete="name"
                error={errors.contactName?.message}
                {...register('contactName')}
              />
              <Field
                label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0803 123 4567"
                error={errors.contactPhone?.message}
                {...register('contactPhone')}
              />
              <div>
                <label htmlFor={hospitalFieldId} className="mb-1 block font-medium text-gray-900">
                  Hospital
                </label>
                <select
                  id={hospitalFieldId}
                  className="block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900"
                  {...register('hospitalId')}
                >
                  <option value={NEAREST}>
                    Nearest hospital
                    {sortedHospitals[0] && pin ? ` (${sortedHospitals[0].name})` : ''}
                  </option>
                  {sortedHospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                      {h.distance != null ? `, ${formatDistance(h.distance)}` : ''}
                    </option>
                  ))}
                </select>
                {hospitals.isError && (
                  <p className="mt-1 text-sm text-gray-600">
                    The hospital list could not be loaded. The crew will choose the hospital.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={notesFieldId} className="mb-1 block font-medium text-gray-900">
                  What has happened? (optional)
                </label>
                <textarea
                  id={notesFieldId}
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900"
                  placeholder="For example: chest pain, 60-year-old man, awake"
                  {...register('notes')}
                />
                {errors.notes && (
                  <p className="mt-1 text-sm text-red-700">{errors.notes.message}</p>
                )}
              </div>
            </Card>

            {submitError && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800"
                role="alert"
              >
                {submitError}
              </p>
            )}

            <Button type="submit" variant="emergency" size="lg" loading={isSubmitting}>
              Request ambulance
            </Button>
            <p className="text-sm text-gray-600">
              Your name, phone number and location are shared with the ambulance crew and the
              dispatcher for this request only.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
