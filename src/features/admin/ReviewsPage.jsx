import { useState } from 'react';
import toast from 'react-hot-toast';
import StaffShell from '../../components/layout/StaffShell';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ADMIN_NAV, REVIEW_FILTERS, useModerateReview, useReviews } from './api';
import { formatDateTime, reportFailure } from './shared';

const EMPTY = {
  pending: 'No reviews are waiting.',
  approved: 'No reviews are published.',
  rejected: 'No reviews have been rejected.',
};

export default function ReviewsPage() {
  const [filter, setFilter] = useState('pending');
  const { data, isPending, isError, refetch } = useReviews(filter);
  const moderate = useModerateReview();

  const decide = (review, status) =>
    moderate.mutate(
      { id: review.id, status },
      {
        onSuccess: () =>
          toast.success(status === 'approved' ? 'Review published.' : 'Review rejected.'),
        onError: reportFailure,
      }
    );

  let body;
  if (isPending) body = <LoadingState label="Loading reviews…" />;
  else if (isError) body = <ErrorState message="Could not load reviews." onRetry={refetch} />;
  else if (data.length === 0) {
    body = (
      <EmptyState title={EMPTY[filter]}>
        Reviews are shown on the home page only after you publish them.
      </EmptyState>
    );
  } else {
    body = (
      <ul className="space-y-3">
        {data.map((review) => {
          const busy = moderate.isPending && moderate.variables?.id === review.id;
          return (
            <Card as="li" key={review.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{review.display_name}</h2>
                <p className="font-semibold text-gray-900">{review.rating} out of 5</p>
              </div>
              <p className="text-sm text-gray-600">{formatDateTime(review.created_at)}</p>
              <p className="mt-2 whitespace-pre-line text-gray-900">{review.comment}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {review.status !== 'approved' && (
                  <Button loading={busy} onClick={() => decide(review, 'approved')}>
                    Publish
                  </Button>
                )}
                {review.status !== 'rejected' && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => decide(review, 'rejected')}
                  >
                    {review.status === 'approved' ? 'Take down' : 'Reject'}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </ul>
    );
  }

  return (
    <StaffShell title="Reviews" nav={ADMIN_NAV}>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter reviews">
        {Object.entries(REVIEW_FILTERS).map(([key, label]) => (
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
