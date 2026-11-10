import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useOnline } from '../../hooks/useOnline';
import { errorText } from '../../lib/status';
import { flushPendingRequest, usePendingRequest } from './api';

/**
 * Keeps an unsent request visible on every screen and sends it when the
 * connection returns, even if the person has left the request form.
 */
export default function PendingRequestBanner() {
  const pending = usePendingRequest();
  const online = useOnline();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onForm = pathname === '/book';

  useEffect(() => {
    // The request form runs its own retries while it is open.
    if (!pending || !online || onForm) return;
    let cancelled = false;
    flushPendingRequest().then((result) => {
      if (cancelled) return;
      if (result.status === 'sent') {
        toast.success('Your ambulance request has been sent.');
        navigate(`/track/${result.booking.id}`);
      }
      if (result.status === 'rejected') toast.error(errorText(result.code));
    });
    return () => {
      cancelled = true;
    };
  }, [pending, online, onForm, navigate]);

  if (!pending || onForm) return null;
  return (
    <div className="bg-emergency px-4 py-2 text-center font-medium text-white" role="status">
      Your ambulance request has not been sent yet.{' '}
      <Link to="/book" className="font-bold underline">
        View request
      </Link>
    </div>
  );
}
