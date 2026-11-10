import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';
import BaseMap from '../../components/map/BaseMap';
import FitBounds from '../../components/map/FitBounds';
import RouteLayer from '../../components/map/RouteLayer';
import { ambulanceIcon, hospitalIcon, patientIcon } from '../../components/map/markers';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { formatDistance, formatDuration } from '../../lib/geo';
import { classifyError } from '../../lib/supabase';
import { STATUS, STEPS, errorText, isFinished, patientCanCancel } from '../../lib/status';
import { useBooking, useCancelBooking, useDriverLocation, useTripDriver } from '../booking/api';
import PushOptIn from '../push/PushOptIn';

function Progress({ step }) {
  return (
    <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Progress">
      {STEPS.map((name, index) => {
        const done = step != null && index <= step;
        return (
          <li key={name} aria-current={index === step ? 'step' : undefined}>
            <div className={`h-2 rounded-full ${done ? 'bg-brand' : 'bg-gray-200'}`} />
            <p className={`mt-1 text-sm ${done ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
              {name}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function DriverCard({ driver }) {
  return (
    <Card className="mt-4">
      <h2 className="text-lg font-semibold text-gray-900">Your driver</h2>
      <p className="mt-1 text-gray-900">{driver.full_name || 'Ambulance crew'}</p>
      <p className="text-gray-600">
        Ambulance {driver.ambulance_number}
        {driver.license_plate ? `, plate ${driver.license_plate}` : ''}
      </p>
      {driver.phone && (
        <a
          href={`tel:${driver.phone}`}
          className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-hover"
        >
          Call driver
        </a>
      )}
    </Card>
  );
}

export default function TrackPage() {
  const { bookingId } = useParams();
  const { data: booking, isPending, isError, refetch } = useBooking(bookingId);
  const { data: driver } = useTripDriver(booking);
  const { data: driverLocation } = useDriverLocation(booking);
  const cancel = useCancelBooking(bookingId);
  const [confirming, setConfirming] = useState(false);
  const [route, setRoute] = useState(null);

  const pickup = useMemo(
    () => (booking ? { lat: booking.pickup_lat, lng: booking.pickup_lng } : null),
    [booking]
  );

  if (isPending) return <LoadingState className="p-6" label="Loading your request…" />;
  if (isError) {
    return (
      <div className="p-4">
        <ErrorState message="Could not load your request." onRetry={refetch} />
        <p className="mt-3 text-gray-900">
          If this is life-threatening, call{' '}
          <a href="tel:112" className="font-bold text-emergency underline">
            112
          </a>
          .
        </p>
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="mx-auto max-w-md p-4 pt-10">
        <EmptyState title="We could not find this request">
          <p>It may have been made on another phone or browser.</p>
          <Link to="/book" className="mt-3 inline-block font-semibold text-brand underline">
            Request an ambulance
          </Link>
        </EmptyState>
      </div>
    );
  }

  const status = STATUS[booking.status];
  const hospital = booking.hospital;
  const finished = isFinished(booking.status);
  const ambulance = driverLocation ? { lat: driverLocation.lat, lng: driverLocation.lng } : null;

  // The ambulance drives to the patient first, then to the hospital.
  const routeTo =
    booking.status === 'assigned'
      ? pickup
      : booking.status === 'en_route_to_hospital'
        ? hospital
        : null;
  const showRoute = ambulance && routeTo;
  const points = [pickup, ambulance, hospital].filter(Boolean);

  const handleCancel = () => {
    cancel.mutate('Cancelled by patient', {
      onSuccess: () => {
        setConfirming(false);
        toast.success('Your request has been cancelled.');
      },
      onError: (error) => {
        setConfirming(false);
        const { kind, code } = classifyError(error);
        toast.error(
          kind === 'business'
            ? errorText(code)
            : 'Could not cancel. Check your connection and try again.'
        );
        refetch();
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 py-6 md:px-6">
        <Card aria-live="polite">
          <h1 className="text-2xl font-bold text-gray-900">{status.label}</h1>
          <p className="mt-1 text-gray-600">{status.detail}</p>
          {showRoute && route && (
            <p className="mt-2 text-lg font-semibold text-gray-900">
              About {formatDuration(route.durationS)} away ({formatDistance(route.distanceM)})
            </p>
          )}
          {status.step != null && <Progress step={status.step} />}
        </Card>

        {!finished && (
          <div className="mt-4">
            <PushOptIn audience="patient" />
          </div>
        )}

        {driver && !finished && <DriverCard driver={driver} />}

        {!finished && (
          <div className="mt-4 overflow-hidden rounded-xl shadow-sm">
            <BaseMap center={pickup} zoom={15} height="45vh">
              <Marker position={[pickup.lat, pickup.lng]} icon={patientIcon}>
                <Popup>Pickup location</Popup>
              </Marker>
              {hospital && (
                <Marker position={[hospital.lat, hospital.lng]} icon={hospitalIcon}>
                  <Popup>{hospital.name}</Popup>
                </Marker>
              )}
              {ambulance && (
                <Marker position={[ambulance.lat, ambulance.lng]} icon={ambulanceIcon}>
                  <Popup>Ambulance</Popup>
                </Marker>
              )}
              <FitBounds points={points} />
              {showRoute && <RouteLayer from={ambulance} to={routeTo} onSummary={setRoute} />}
            </BaseMap>
          </div>
        )}

        {hospital && (
          <Card className="mt-4">
            <h2 className="text-lg font-semibold text-gray-900">Hospital</h2>
            <p className="mt-1 text-gray-900">{hospital.name}</p>
            {hospital.address && <p className="text-gray-600">{hospital.address}</p>}
          </Card>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {!finished && (
            <a
              href="tel:112"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emergency px-4 font-semibold text-emergency hover:bg-red-50"
            >
              Call 112
            </a>
          )}
          {patientCanCancel(booking.status) && (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Cancel request
            </Button>
          )}
          {finished && (
            <Link
              to={booking.status === 'cancelled' ? '/book' : '/'}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 font-semibold text-white hover:bg-brand-hover"
            >
              {booking.status === 'cancelled' ? 'Request an ambulance' : 'Back to home'}
            </Link>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={confirming}
        title="Cancel this request?"
        confirmLabel="Yes, cancel"
        cancelLabel="Keep request"
        loading={cancel.isPending}
        onConfirm={handleCancel}
        onClose={() => setConfirming(false)}
      >
        {booking.status === 'assigned'
          ? 'An ambulance is already on its way to you. It will be told to stop.'
          : 'No ambulance will be sent.'}
      </ConfirmDialog>
    </div>
  );
}
