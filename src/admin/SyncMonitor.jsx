import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  getQueuedPatients,
  clearQueuedPatients,
  syncOfflinePatients,
} from '../utils/patientQueue';

export default function AdminSyncMonitor() {
  const [queued, setQueued] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [syncLog, setSyncLog] = useState(() => 
    JSON.parse(localStorage.getItem('syncLog')) || []
  );

  // Load queued patients from IndexedDB
  useEffect(() => {
    loadQueued();
  }, []);

  const loadQueued = async () => {
    const list = await getQueuedPatients();
    setQueued(list);
  };

  const handleSync = async () => {
    setLoading(true);
    setMessage('');
    const countBefore = queued.length;
    await syncOfflinePatients();

    const timestamp = new Date().toISOString();

    const updatedLog = [
      {
        timestamp,
        countBefore,
        message: `Attempted to sync ${countBefore} patient(s).`,
      },
      ...syncLog.slice(0, 9) // Keep last 10 entries
    ];

    setSyncLog(updatedLog);
    localStorage.setItem('syncLog', JSON.stringify(updatedLog));
    setMessage('✅ Sync complete. Check console for details.');
    await loadQueued();
    setLoading(false);
  };

  const handleClear = async () => {
    const confirmed = window.confirm("Are you sure you want to clear the offline queue?");
    if (!confirmed) return;
    await clearQueuedPatients();
    setMessage('🗑️ Offline queue cleared.');
    await loadQueued();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🔄 Sync Monitor</h1>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-700">
          {queued.length} patient{queued.length !== 1 ? 's' : ''} currently queued for sync.
        </p>
        <div className="space-x-2">
          <button
            onClick={handleSync}
            disabled={loading || queued.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Syncing...' : '🔄 Sync Now'}
          </button>
          <button
            onClick={handleClear}
            disabled={queued.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            🗑️ Clear Queue
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-sm text-green-700 bg-green-100 px-4 py-2 rounded">
          {message}
        </div>
      )}

      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Age</th>
              <th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Queued At</th>
            </tr>
          </thead>
          <tbody>
            {queued.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center px-4 py-6 text-gray-500">
                  No queued patients found.
                </td>
              </tr>
            ) : (
              queued.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">{p.fullName}</td>
                  <td className="px-4 py-2">{p.age}</td>
                  <td className="px-4 py-2">{p.gender}</td>
                  <td className="px-4 py-2">{p.phone}</td>
                  <td className="px-4 py-2">
                    {new Date(p.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sync Log Section */}
      <div className="bg-white border rounded shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-3">📜 Sync History</h2>
        {syncLog.length === 0 ? (
          <p className="text-sm text-gray-500">No sync activity yet.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-gray-800 space-y-2">
            {syncLog.map((log, index) => (
              <li key={index}>
                <span className="font-medium text-blue-700">
                  {format(new Date(log.timestamp), 'PPpp')}:
                </span>{" "}
                {log.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>      
  );
}
