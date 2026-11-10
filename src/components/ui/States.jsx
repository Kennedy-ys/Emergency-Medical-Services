import Button from './Button';
import Spinner from './Spinner';

/** The loading, empty and error states every data-driven view must handle. */

export function LoadingState({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center gap-2 text-gray-600 ${className}`} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, children, className = '' }) {
  return (
    <div className={`rounded-xl bg-white p-6 text-center shadow-sm ${className}`}>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      {children && <div className="mt-1 text-gray-600">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 ${className}`}
      role="alert"
    >
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
