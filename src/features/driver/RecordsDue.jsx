import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useTripsNeedingRecord } from './api';

const when = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

/** Recently completed trips that have no record yet. Shows nothing when there are none. */
export default function RecordsDue({ userId, onWrite }) {
  const { data } = useTripsNeedingRecord(userId);
  // Optional paperwork: if the list cannot load, the duty screen carries on without it.
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <h2 className="text-lg font-semibold text-gray-900">Trip records to write</h2>
      <ul className="mt-2 space-y-2">
        {data.map((trip) => (
          <li
            key={trip.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-2"
          >
            <span>
              <span className="block font-semibold text-gray-900">{trip.contact_name}</span>
              <span className="block text-sm text-gray-600">
                Completed {when.format(new Date(trip.completed_at))}
              </span>
            </span>
            <Button variant="secondary" onClick={() => onWrite(trip)}>
              Write record
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
