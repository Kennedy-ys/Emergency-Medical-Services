import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Marker, Popup } from 'react-leaflet';
import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import BaseMap from '../../components/map/BaseMap';
import FitBounds from '../../components/map/FitBounds';
import { ambulanceIcon, patientIcon } from '../../components/map/markers';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { formatDistance } from '../../lib/geo';
import {
  ADMIN_NAV,
  useAssignDriver,
  useCancelRequest,
  useDrivers,
  useLiveBookings,
  useNearestDrivers,
} from './api';
import { formatElapsed, reportFailure, useNow } from './shared';
import StatusBadge from './StatusBadge';

/** A request nobody has accepted after this long is called out. */
const SLOW_AFTER_MS = 2 * 60_000;

const canAssign = (status) => status === 'pending' || status === 'assigned';

function QueueItem({ booking, selected, now, onSelect }) {
  const waiting = booking.status === 'pending';
  const slow = waiting && now - new Date(booking.created_at).getTime() > SLOW_AFTER_MS;
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(booking.id)}
        className={`block w-full rounded-xl border-2 bg-white p-3 text-left shadow-sm ${
          selected ? 'border-brand' : 'border-transparent hover:border-gray-300'
        }`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="font-semibold text-gray-900">{booking.contact_name}</span>
          <StatusBadge status={booking.status} />
        </span>
        <span className={`mt-1 block ${slow ? 'font-semibold text-red-700' : 'text-gray-600'}`}>
          {waiting
            ? `Waiting ${formatElapsed(booking.created_at, now)}${slow ? ' — needs a driver' : ''}`
            : `${booking.driver?.profile?.full_name || 'Driver'} · ambulance ${booking.driver?.ambulance_number ?? ''}`}
        </span>
        {booking.notes && <span className="mt-1 block text-gray-900">{booking.notes}</span>}
      </button>
    </li>
  );
}

function NearestDrivers({ booking, onAssign, assigning }) {
  const { data, isPending, isError, refetch } = useNearestDrivers(booking.id);
  if (isPending) return <LoadingState label="Finding the nearest drivers…" />;
  if (isError) return <ErrorState message="Could not load drivers." onRetry={refetch} />;
  const drivers = data.filter((driver) => driver.driver_id !== booking.driver_id);
  if (drivers.length === 0) {
    return (
      <p className="text-gray-900">
        No free driver is on duty right now. Call the patient and keep this request open.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {drivers.map((driver) => (
        <li
          key={driver.driver_id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2"
        >
          <span>
            <span className="block font-semibold text-gray-900">
              {driver.full_name || 'Driver'} · {formatDistance(driver.distance_m)} away
            </span>
            <span className="block text-sm text-gray-600">Ambulance {driver.ambulance_number}</span>
          </span>
          <Button
            loading={assigning === driver.driver_id}
            disabled={Boolean(assigning)}
            onClick={() => onAssign(driver)}
          >
            {booking.driver_id ? 'Reassign' : 'Assign'}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Detail({ booking, now }) {
  const assign = useAssignDriver();
  const cancel = useCancelRequest();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  const onAssign = (driver) =>
    assign.mutate(
      { bookingId: booking.id, driverId: driver.driver_id },
      {
        onSuccess: () => toast.success(`Assigned to ${driver.full_name || 'the driver'}.`),
        onError: reportFailure,
      }
    );

  const onCancel = () =>
    cancel.mutate(
      { bookingId: booking.id, reason: reason || 'Cancelled by dispatcher' },
      {
        onSuccess: () => {
          setCancelling(false);
          setReason('');
          toast.success('Request cancelled.');
        },
        onError: (error) => {
          setCancelling(false);
          reportFailure(error);
        },
      }
    );

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{booking.contact_name}</h2>
        <StatusBadge status={booking.status} />
      </div>
      <p className="text-gray-600">Requested {formatElapsed(booking.created_at, now)} ago</p>
      {booking.notes && <p className="mt-1 text-gray-900">{booking.notes}</p>}
      {booking.hospital && <p className="text-gray-600">To {booking.hospital.name}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`tel:${booking.contact_phone}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-semibold text-gray-900 hover:bg-gray-50"
        >
          Call patient {booking.contact_phone}
        </a>
        {booking.driver?.profile?.phone && (
          <a
            href={`tel:${booking.driver.profile.phone}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-semibold text-gray-900 hover:bg-gray-50"
          >
            Call driver
          </a>
        )}
      </div>

      {canAssign(booking.status) && (
        <section className="mt-4">
          <h3 className="mb-2 font-semibold text-gray-900">
            {booking.driver_id ? 'Give this trip to another driver' : 'Nearest free drivers'}
          </h3>
          <NearestDrivers
            booking={booking}
            onAssign={onAssign}
            assigning={assign.isPending ? assign.variables?.driverId : null}
          />
        </section>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3">
        <Link to={`/admin/bookings/${booking.id}`} className="font-semibold text-brand underline">
          Full history
        </Link>
        <Button variant="ghost" onClick={() => setCancelling(true)}>
          Cancel request
        </Button>
      </div>

      <ConfirmDialog
        open={cancelling}
        title="Cancel this request?"
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        loading={cancel.isPending}
        onConfirm={onCancel}
        onClose={() => setCancelling(false)}
      >
        <p>
          The patient sees that it was cancelled
          {booking.driver_id ? ' and the driver is freed for other requests' : ''}.
        </p>
        <label htmlFor="cancel-reason" className="mt-3 mb-1 block font-medium text-gray-900">
          Reason
        </label>
        <textarea
          id="cancel-reason"
          rows={2}
          maxLength={200}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="block w-full rounded-lg border border-gray-300 p-2 text-base text-gray-900"
        />
      </ConfirmDialog>
    </Card>
  );
}

const DRIVER_STATE = { available: 'Free', busy: 'On a trip' };

export default function DispatchPage() {
  const bookings = useLiveBookings();
  const drivers = useDrivers();
  const now = useNow();
  const [selectedId, setSelectedId] = useState(null);

  const live = useMemo(() => bookings.data ?? [], [bookings.data]);
  const waiting = live.filter((booking) => booking.status === 'pending');
  const onTrip = live.filter((booking) => booking.status !== 'pending');
  const selected = live.find((booking) => booking.id === selectedId) ?? null;

  const onDuty = (drivers.data ?? []).filter(
    (driver) => driver.availability !== 'offline' && driver.location
  );

  // The map follows the requests, not the ambulances, so it does not jump as they move.
  const focus = useMemo(() => {
    const source = selected ? [selected] : live;
    return source.map((booking) => ({ lat: booking.pickup_lat, lng: booking.pickup_lng }));
  }, [selected, live]);

  let queue;
  if (bookings.isPending) queue = <LoadingState label="Loading requests…" />;
  else if (bookings.isError) {
    queue = <ErrorState message="Could not load requests." onRetry={bookings.refetch} />;
  } else if (live.length === 0) {
    queue = (
      <EmptyState title="No requests in progress">
        New requests appear here automatically.
      </EmptyState>
    );
  } else {
    queue = (
      <>
        <section aria-live="polite">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Waiting for a driver ({waiting.length})
          </h2>
          {waiting.length === 0 ? (
            <p className="text-gray-600">Nobody is waiting.</p>
          ) : (
            <ul className="space-y-2">
              {waiting.map((booking) => (
                <QueueItem
                  key={booking.id}
                  booking={booking}
                  now={now}
                  selected={booking.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          )}
        </section>
        <section className="mt-5">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            Trips under way ({onTrip.length})
          </h2>
          {onTrip.length === 0 ? (
            <p className="text-gray-600">No trips under way.</p>
          ) : (
            <ul className="space-y-2">
              {onTrip.map((booking) => (
                <QueueItem
                  key={booking.id}
                  booking={booking}
                  now={now}
                  selected={booking.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </ul>
          )}
        </section>
      </>
    );
  }

  return (
    <StaffShell title="Dispatch" nav={ADMIN_NAV} wide>
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <div>{queue}</div>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl shadow-sm">
            <BaseMap height="50vh">
              {live.map((booking) => (
                <Marker
                  key={booking.id}
                  position={[booking.pickup_lat, booking.pickup_lng]}
                  icon={patientIcon}
                  eventHandlers={{ click: () => setSelectedId(booking.id) }}
                >
                  <Popup>{booking.contact_name}</Popup>
                </Marker>
              ))}
              {onDuty.map((driver) => (
                <Marker
                  key={driver.id}
                  position={[driver.location.lat, driver.location.lng]}
                  icon={ambulanceIcon}
                >
                  <Popup>
                    {driver.profile?.full_name || 'Driver'} · ambulance {driver.ambulance_number}
                    <br />
                    {DRIVER_STATE[driver.availability]}
                  </Popup>
                </Marker>
              ))}
              <FitBounds points={focus} />
            </BaseMap>
          </div>
          <p className="text-gray-600">
            {drivers.isError
              ? 'Driver positions could not be loaded.'
              : `${onDuty.filter((d) => d.availability === 'available').length} free, ${
                  onDuty.filter((d) => d.availability === 'busy').length
                } on a trip.`}
          </p>
          {selected ? (
            <Detail key={selected.id} booking={selected} now={now} />
          ) : (
            live.length > 0 && (
              <p className="text-gray-600">Choose a request to assign a driver or cancel it.</p>
            )
          )}
        </div>
      </div>
    </StaffShell>
  );
}
