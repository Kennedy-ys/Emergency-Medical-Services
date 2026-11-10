import { useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';
import BaseMap from '../../components/map/BaseMap';
import FitBounds from '../../components/map/FitBounds';
import { ambulanceIcon, hospitalIcon, patientIcon } from '../../components/map/markers';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { classifyError } from '../../lib/supabase';
import { NEXT_TRIP_ACTION, STATUS, errorText } from '../../lib/status';
import { useAdvanceTrip, useReleaseTrip } from './api';

function reportFailure(error) {
  const { kind, code } = classifyError(error);
  toast.error(
    kind === 'business' ? errorText(code) : 'Could not save. Check your connection and try again.'
  );
}

/** The driver's current trip: who, where, and the one button that moves it forward. */
export default function TripPanel({ trip, position }) {
  const advance = useAdvanceTrip();
  const release = useReleaseTrip();
  const [confirm, setConfirm] = useState(null); // 'complete' | 'release' | null

  const status = STATUS[trip.status];
  const pickup = { lat: trip.pickup_lat, lng: trip.pickup_lng };
  const hospital = trip.hospital;
  const toHospital = trip.status === 'en_route_to_hospital';
  const destination = toHospital && hospital ? hospital : pickup;
  const points = [pickup, hospital, position].filter(Boolean);

  const doAdvance = () =>
    advance.mutate(trip.id, {
      onSuccess: (updated) => {
        setConfirm(null);
        if (updated?.status === 'completed') toast.success('Trip completed. You are on duty.');
      },
      onError: (error) => {
        setConfirm(null);
        reportFailure(error);
      },
    });

  const doRelease = () =>
    release.mutate(trip.id, {
      onSuccess: () => {
        setConfirm(null);
        toast.success('Trip released. It has gone back to the other drivers.');
      },
      onError: (error) => {
        setConfirm(null);
        reportFailure(error);
      },
    });

  return (
    <div className="space-y-4">
      <Card aria-live="polite">
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${status.tone}`}
        >
          {status.tripLabel}
        </span>
        <h2 className="mt-2 text-lg font-semibold text-gray-900">{trip.contact_name}</h2>
        {trip.notes && <p className="mt-1 text-gray-900">{trip.notes}</p>}
        {hospital && (
          <p className="mt-1 text-gray-600">
            Hospital: {hospital.name}
            {hospital.address ? `, ${hospital.address}` : ''}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`tel:${trip.contact_phone}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-semibold text-gray-900 hover:bg-gray-50"
          >
            Call {trip.contact_phone}
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-semibold text-gray-900 hover:bg-gray-50"
          >
            Navigate to {toHospital ? 'hospital' : 'patient'}
          </a>
        </div>
      </Card>

      <div className="overflow-hidden rounded-xl shadow-sm">
        <BaseMap center={pickup} zoom={15} height="40vh">
          <Marker position={[pickup.lat, pickup.lng]} icon={patientIcon}>
            <Popup>Patient</Popup>
          </Marker>
          {hospital && (
            <Marker position={[hospital.lat, hospital.lng]} icon={hospitalIcon}>
              <Popup>{hospital.name}</Popup>
            </Marker>
          )}
          {position && (
            <Marker position={[position.lat, position.lng]} icon={ambulanceIcon}>
              <Popup>You</Popup>
            </Marker>
          )}
          <FitBounds points={points} />
        </BaseMap>
      </div>

      <Button
        size="lg"
        loading={advance.isPending && !confirm}
        onClick={() => (toHospital ? setConfirm('complete') : doAdvance())}
      >
        {NEXT_TRIP_ACTION[trip.status]}
      </Button>

      {trip.status === 'assigned' && (
        <Button variant="ghost" className="w-full" onClick={() => setConfirm('release')}>
          I cannot take this trip
        </Button>
      )}

      <ConfirmDialog
        open={confirm === 'complete'}
        title="Complete this trip?"
        confirmLabel="Complete trip"
        variant="primary"
        loading={advance.isPending}
        onConfirm={doAdvance}
        onClose={() => setConfirm(null)}
      >
        Confirm that the patient has been handed over at the hospital.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm === 'release'}
        title="Release this trip?"
        confirmLabel="Release trip"
        loading={release.isPending}
        onConfirm={doRelease}
        onClose={() => setConfirm(null)}
      >
        The request goes back to the other drivers and the patient keeps waiting. Only do this if
        you cannot reach the patient.
      </ConfirmDialog>
    </div>
  );
}
