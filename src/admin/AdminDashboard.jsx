import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebaseConfig';
import { getQueuedPatients } from '../utils/patientQueue';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const [patients, setPatients] = useState([]);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    // Listen to all patients
    const patientsRef = ref(db, 'patients');
    onValue(patientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setPatients(list);
      }
    });

    // Get offline queue
    getQueuedPatients().then((queued) => setQueuedCount(queued.length));
  }, []);

  const totalPatients = patients.length;
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayPatients = patients.filter(p =>
    p.timestamp?.startsWith(today)
  ).length;

  const genderStats = patients.reduce(
    (acc, p) => {
      const g = (p.gender || '').toLowerCase();
      if (g === 'male') acc.male++;
      else if (g === 'female') acc.female++;
      else acc.other++;
      return acc;
    },
    { male: 0, female: 0, other: 0 }
  );

  const recent = patients.slice(0, 5);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Admin Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card title="Total Patients" value={totalPatients} color="bg-blue-300" style={{ border: '1px solid blue'}} />
        <Card title="Offline Queued" value={queuedCount} color="bg-yellow-300" style={{ border: '1px solid yellow'}} />
        <Card title="Submitted Today" value={todayPatients} color="bg-green-300" style={{ border: '1px solid green'}}/>
        <Card title="Gender Breakdown" value={
          `♂️ ${genderStats.male} / ♀️ ${genderStats.female} / ⚧ ${genderStats.other}`
        } color="bg-purple-300" style={{ border: '1px solid purple'}} />
      </div>

      <div className="bg-white rounded shadow p-4">
        <h2 className="text-xl font-semibold mb-3">Recent Submissions</h2>
        <ul className="divide-y">
          {recent.map((p) => (
            <li key={p.id} className="py-2">
              <strong>{p.fullName}</strong> ({p.age} yrs, {p.gender}) – {p.phone}
              <br />
              <span className="text-sm text-gray-500">{format(new Date(p.timestamp), 'PPpp')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Card({ title, value, color, style }) {
  return (
    <div className={`text-white p-4 rounded shadow ${color}`} style={style}>
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
