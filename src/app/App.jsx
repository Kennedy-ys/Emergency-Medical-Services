import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import OfflineBanner from '../components/layout/OfflineBanner';
import AppRoutes from './routes';
import { getQueuedPatients } from '../utils/patientQueue';
import { syncQueuedPatients } from '../utils/syncQueue';

/**
 * Count of items in the old Firebase offline queue, re-sent when the
 * connection returns. Replaced by the request outbox in Phase 2.
 */
function useLegacyQueue() {
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const refresh = () =>
      getQueuedPatients()
        .then((queued) => setQueuedCount(queued.length))
        .catch(() => {});
    const handleOnline = async () => {
      try {
        await syncQueuedPatients();
      } finally {
        refresh();
      }
    };

    refresh();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return queuedCount;
}

export default function App() {
  const queuedCount = useLegacyQueue();

  return (
    <BrowserRouter>
      <OfflineBanner />
      {queuedCount > 0 && (
        <p className="bg-amber-100 px-4 py-1 text-center text-sm text-gray-900" role="status">
          Waiting to send: {queuedCount}
        </p>
      )}
      <Toaster position="top-right" />
      <AppRoutes />
    </BrowserRouter>
  );
}
