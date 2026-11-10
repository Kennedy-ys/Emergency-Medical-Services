import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ADMIN_NAV, useArchiveRecord, usePatientRecords } from './api';
import { downloadText, formatDateTime, reportFailure, toCsv } from './shared';

const CSV_COLUMNS = [
  ['Recorded', (record) => record.created_at],
  ['Patient', (record) => record.full_name],
  ['Age', (record) => record.age],
  ['Sex', (record) => record.gender],
  ['Phone', (record) => record.phone],
  ['Address', (record) => record.address],
  ['Notes', (record) => record.notes],
  ['Recorded by', (record) => record.recorder?.full_name],
  ['Request', (record) => record.booking_id],
];

const FILTERS = [
  { archived: false, label: 'Current' },
  { archived: true, label: 'Archived' },
];

export default function RecordsPage() {
  const [archived, setArchived] = useState(false);
  const { data, isPending, isError, refetch } = usePatientRecords(archived);
  const archive = useArchiveRecord();

  const move = (record) =>
    archive.mutate(
      { id: record.id, archived: !record.is_archived },
      {
        onSuccess: () =>
          toast.success(record.is_archived ? 'Record restored.' : 'Record archived.'),
        onError: reportFailure,
      }
    );

  let body;
  if (isPending) body = <LoadingState label="Loading records…" />;
  else if (isError) body = <ErrorState message="Could not load records." onRetry={refetch} />;
  else if (data.length === 0) {
    body = (
      <EmptyState title={archived ? 'No archived records' : 'No trip records yet'}>
        {archived
          ? 'Records you archive are kept here.'
          : 'Records written by ambulance crews appear here.'}
      </EmptyState>
    );
  } else {
    body = (
      <>
        <ul className="space-y-3">
          {data.map((record) => {
            const about = [
              record.age != null ? `${record.age} years` : null,
              record.gender,
              record.address,
            ].filter(Boolean);
            return (
              <Card as="li" key={record.id}>
                <h2 className="text-lg font-semibold text-gray-900">{record.full_name}</h2>
                {about.length > 0 && <p className="text-gray-600">{about.join(' · ')}</p>}
                {record.phone && (
                  <a href={`tel:${record.phone}`} className="font-semibold text-brand underline">
                    {record.phone}
                  </a>
                )}
                {record.notes && (
                  <p className="mt-2 whitespace-pre-line text-gray-900">{record.notes}</p>
                )}
                <p className="mt-2 text-sm text-gray-600">
                  Recorded {formatDateTime(record.created_at)}
                  {record.recorder?.full_name ? ` by ${record.recorder.full_name}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    variant="secondary"
                    loading={archive.isPending && archive.variables?.id === record.id}
                    onClick={() => move(record)}
                  >
                    {record.is_archived ? 'Restore' : 'Archive'}
                  </Button>
                  {record.booking_id && (
                    <Link
                      to={`/admin/bookings/${record.booking_id}`}
                      className="font-semibold text-brand underline"
                    >
                      See the request
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() =>
            downloadText(
              `trip-records-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(data, CSV_COLUMNS)
            )
          }
        >
          Download this list as a spreadsheet file
        </Button>
        {data.length === 100 && (
          <p className="mt-3 text-gray-600">Showing the 100 most recent records.</p>
        )}
      </>
    );
  }

  return (
    <StaffShell title="Trip records" nav={ADMIN_NAV}>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter records">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            type="button"
            aria-pressed={archived === filter.archived}
            onClick={() => setArchived(filter.archived)}
            className={`min-h-11 rounded-full border px-4 font-semibold ${
              archived === filter.archived
                ? 'border-brand bg-brand text-white'
                : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-50'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {body}
    </StaffShell>
  );
}
