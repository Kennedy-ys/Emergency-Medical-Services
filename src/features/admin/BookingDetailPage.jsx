import { Link, useParams } from 'react-router-dom';
import { Marker, Popup } from 'react-leaflet';
import StaffShell from '../../components/layout/StaffShell';
import BaseMap from '../../components/map/BaseMap';
import FitBounds from '../../components/map/FitBounds';
import { hospitalIcon, patientIcon } from '../../components/map/markers';
import Card from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { STATUS, isFinished } from '../../lib/status';
import { ADMIN_NAV, useBookingDetail } from './api';
import { formatDateTime } from './shared';
import StatusBadge from './StatusBadge';

const ROLE = {
  admin: 'Dispatcher',
  driver: 'Driver',
  technician: 'Technician',
  patient: 'Patient',
};

function who(actor) {
  if (!actor) return 'System';
  const role = ROLE[actor.role] ?? 'User';
  return actor.full_name ? `${role} ${actor.full_name}` : role;
}

function Timeline({ events }) {
  if (events.length === 0) return <p className="text-gray-600">Nothing recorded yet.</p>;
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-4 border-gray-200 pl-3">
          <p className="font-semibold text-gray-900">
            {event.from_status
              ? `${STATUS[event.from_status].tripLabel} → ${STATUS[event.to_status].tripLabel}`
              : 'Request made'}
          </p>
          <p className="text-gray-600">
            {formatDateTime(event.created_at)} · {who(event.actor)}
          </p>
          {event.note && <p className="text-gray-900">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const { data, isPending, isError, refetch } = useBookingDetail(bookingId);

  let body;
  if (isPending) body = <LoadingState label="Loading request…" />;
  else if (isError) body = <ErrorState message="Could not load this request." onRetry={refetch} />;
  else if (!data) body = <EmptyState title="This request does not exist" />;
  else {
    const { booking, events } = data;
    const pickup = { lat: booking.pickup_lat, lng: booking.pickup_lng };
    const points = [pickup, booking.hospital].filter(Boolean);
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{booking.contact_name}</h2>
              <StatusBadge status={booking.status} />
            </div>
            <a href={`tel:${booking.contact_phone}`} className="font-semibold text-brand underline">
              {booking.contact_phone}
            </a>
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-sm text-gray-600">Requested</dt>
                <dd className="text-gray-900">{formatDateTime(booking.created_at)}</dd>
              </div>
              {booking.notes && (
                <div>
                  <dt className="text-sm text-gray-600">What happened</dt>
                  <dd className="text-gray-900">{booking.notes}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-600">Hospital</dt>
                <dd className="text-gray-900">{booking.hospital?.name ?? 'Not chosen'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Driver</dt>
                <dd className="text-gray-900">
                  {booking.driver
                    ? `${booking.driver.profile?.full_name || 'Driver'}, ambulance ${booking.driver.ambulance_number}`
                    : 'None'}
                </dd>
              </div>
              {booking.cancel_reason && (
                <div>
                  <dt className="text-sm text-gray-600">Reason for cancelling</dt>
                  <dd className="text-gray-900">{booking.cancel_reason}</dd>
                </div>
              )}
            </dl>
            {!isFinished(booking.status) && (
              <Link
                to="/admin/dispatch"
                className="mt-3 inline-block font-semibold text-brand underline"
              >
                Assign or cancel on the dispatch screen
              </Link>
            )}
          </Card>
          <div className="overflow-hidden rounded-xl shadow-sm">
            <BaseMap center={pickup} zoom={15} height="35vh">
              <Marker position={[pickup.lat, pickup.lng]} icon={patientIcon}>
                <Popup>Pickup location</Popup>
              </Marker>
              {booking.hospital && (
                <Marker position={[booking.hospital.lat, booking.hospital.lng]} icon={hospitalIcon}>
                  <Popup>{booking.hospital.name}</Popup>
                </Marker>
              )}
              <FitBounds points={points} />
            </BaseMap>
          </div>
        </div>
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">History</h2>
          <Timeline events={events} />
        </Card>
      </div>
    );
  }

  return (
    <StaffShell title="Request" nav={ADMIN_NAV}>
      <Link to="/admin/bookings" className="mb-3 inline-block font-semibold text-brand underline">
        All requests
      </Link>
      {body}
    </StaffShell>
  );
}
