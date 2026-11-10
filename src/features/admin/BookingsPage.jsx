import { useState } from 'react';
import { Link } from 'react-router-dom';
import StaffShell from '../../components/layout/StaffShell';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ADMIN_NAV, HISTORY_FILTERS, useBookingHistory } from './api';
import { formatDateTime } from './shared';
import StatusBadge from './StatusBadge';

export default function BookingsPage() {
  const [filter, setFilter] = useState('all');
  const { data, isPending, isError, refetch } = useBookingHistory(filter);

  let body;
  if (isPending) body = <LoadingState label="Loading requests…" />;
  else if (isError) body = <ErrorState message="Could not load requests." onRetry={refetch} />;
  else if (data.length === 0) {
    body = <EmptyState title="No requests to show">Try a different filter.</EmptyState>;
  } else {
    body = (
      <>
        <ul className="space-y-2">
          {data.map((booking) => (
            <li key={booking.id}>
              <Link
                to={`/admin/bookings/${booking.id}`}
                className="block rounded-xl bg-white p-3 shadow-sm hover:bg-gray-50"
              >
                <span className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-semibold text-gray-900">{booking.contact_name}</span>
                  <StatusBadge status={booking.status} />
                </span>
                <span className="block text-gray-600">
                  {formatDateTime(booking.created_at)}
                  {booking.hospital ? ` · to ${booking.hospital.name}` : ''}
                </span>
                <span className="block text-gray-600">
                  {booking.driver
                    ? `${booking.driver.profile?.full_name || 'Driver'} · ambulance ${booking.driver.ambulance_number}`
                    : 'No driver'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {data.length === 100 && (
          <p className="mt-3 text-gray-600">Showing the 100 most recent requests.</p>
        )}
      </>
    );
  }

  return (
    <StaffShell title="Requests" nav={ADMIN_NAV}>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter requests">
        {Object.entries(HISTORY_FILTERS).map(([key, { label }]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-11 rounded-full border px-4 font-semibold ${
              filter === key
                ? 'border-brand bg-brand text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {body}
    </StaffShell>
  );
}
