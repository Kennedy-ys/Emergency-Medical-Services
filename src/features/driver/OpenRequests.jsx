import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { distanceM, formatDistance } from '../../lib/geo';
import { classifyError } from '../../lib/supabase';
import { errorText } from '../../lib/status';
import { useAcceptRequest, useOpenRequests, usePassRequest } from './api';

/** Minutes since a time, re-read every 30 seconds so waiting times stay current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function waitedText(createdAt, now) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));
  return minutes < 1 ? 'Waiting less than a minute' : `Waiting ${minutes} min`;
}

/** Requests waiting for a driver, with Accept and Pass. */
export default function OpenRequests({ position }) {
  const { data, isPending, isError, refetch } = useOpenRequests(true);
  const accept = useAcceptRequest();
  const pass = usePassRequest();
  const now = useNow();

  if (isPending) return <LoadingState label="Loading requests…" />;
  if (isError) return <ErrorState message="Could not load requests." onRetry={refetch} />;
  if (data.length === 0) {
    return (
      <EmptyState title="No requests waiting">
        New requests appear here automatically. Keep this screen open.
      </EmptyState>
    );
  }

  const onError = (error) => {
    const { kind, code } = classifyError(error);
    toast.error(
      kind === 'business' ? errorText(code) : 'Could not save. Check your connection and try again.'
    );
  };

  const busy = accept.isPending || pass.isPending;

  return (
    <ul className="space-y-3">
      {data.map((request) => {
        const distance = position
          ? distanceM(position, { lat: request.pickup_lat, lng: request.pickup_lng })
          : null;
        return (
          <Card as="li" key={request.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold text-gray-900">{request.contact_name}</h3>
              {distance != null && (
                <span className="shrink-0 font-semibold text-gray-900">
                  {formatDistance(distance)} away
                </span>
              )}
            </div>
            <p className="text-gray-600">{waitedText(request.created_at, now)}</p>
            {request.notes && <p className="mt-1 text-gray-900">{request.notes}</p>}
            {request.hospital && <p className="text-gray-600">To {request.hospital.name}</p>}
            <div className="mt-3 flex gap-2">
              <Button
                className="flex-1"
                loading={accept.isPending && accept.variables === request.id}
                disabled={busy}
                onClick={() => accept.mutate(request.id, { onError })}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                loading={pass.isPending && pass.variables === request.id}
                disabled={busy}
                onClick={() => pass.mutate(request.id, { onError })}
              >
                Pass
              </Button>
            </div>
          </Card>
        );
      })}
    </ul>
  );
}
