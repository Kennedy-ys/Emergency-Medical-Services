import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';

// Public pages
import AdminLogin from './pages/AdminLogin';
import Home from './pages/Home';
import Protocols from './pages/Protocols';
import PatientForm from './pages/PatientForm';
import Patients from './pages/Patients';
import OfflineMap from './components/offlineMap';
import AmbulanceBooking from './pages/AmbulanceBooking';
import LiveTrackingPage from './pages/LiveTrackingPage';
import TechnicianChat from './pages/TechnicianChat';
import FirstAidTips from './pages/FirstAidTips';
import LocateHospitals from './pages/LocateHospitals';

// Driver components
import DriverDashboard from './driver/DriverDashboard';
import DriverBookings from './driver/DriverBookings';
import DriverTrackingPage from './driver/DriverTrackingPage';
import DriverProfile from './driver/DriverProfile';
import DriverRegistration from "./driver/DriverRegistration";
import DriverLogin from "./driver/DriverLogin";
import DriverProtectedRoute from "./components/DriverProtectedRoute";
import MockAmbulanceUpdater from './pages/MockAmbulanceUpdater';

// Ambulance components
import AmbulanceLayout from './ambulance/AmbulanceLayout';
import AmbulanceBookingSelection from './ambulance/BookingSelection';
import ALiveTrackingPage from './ambulance/LiveTrackingPage';
import Profilepage from './ambulance/Profilepage';

// Admin components
import AdminDashboard from './admin/AdminDashboard';
import PatientTable from './admin/PatientTable';
import MapView from './admin/MapView';
import SyncMonitor from './admin/SyncMonitor';
import AdminLayout from './admin/AdminLayout';
import ArchivedPatientsTable from './admin/ArchivedPatientsTable';
import ReviewModeration from './admin/ReviewModeration';
import AdminHospitalManager from './admin/AdminHospitalManager';

import 'leaflet/dist/leaflet.css';
import './index.css';

import { getQueuedPatients } from './utils/patientQueue';
import { syncQueuedPatients } from './utils/syncQueue';


// 🔐 Wrapper for protecting admin routes
function ProtectedRoute({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading) return <div>Loading...</div>;

  return isAuthenticated ? children : <Navigate to="/admin-login" />;
}

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const handleOnline = async () => {
      console.log('📡 Network is back online!');
      setIsOnline(true);
      await syncQueuedPatients();
      const remaining = await getQueuedPatients();
      setQueuedCount(remaining.length);
    };

    const handleOffline = () => {
      console.log('📴 You are offline.');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getQueuedPatients().then((queued) => setQueuedCount(queued.length));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Router>
      {!isOnline && (
        <div className="bg-yellow-500 text-white text-center py-2">
          📴 You are currently offline. Submissions will be queued.
        </div>
      )}
      <nav>
      {/* <nav className="p-4 bg-blue-800 text-white flex gap-4 justify-between"> 
        <div className="flex gap-4">
          <Link to="/">Home</Link>
          <Link to="/protocols">Protocols</Link>
          <Link to="/form">Patient Form</Link>
          <Link to="/patients">Patients</Link>
          <Link to="/map">Map</Link>
        </div> */}
        <div>
          {queuedCount > 0 && (
            <span className="bg-red-500 px-2 py-1 rounded text-sm">
              ⏳ {queuedCount} queued
            </span>
          )}
        </div>
      </nav>

      <Toaster position="top-right" />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/protocols" element={<Protocols />} />
        <Route path="/form" element={<PatientForm />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/map" element={<OfflineMap />} />
        <Route path="/ambulance-booking" element={<AmbulanceBooking />} />
        <Route path="/technician-chat" element={<TechnicianChat />} />
        <Route path="/first-aid-tips" element={<FirstAidTips />} />
        <Route path="/locate-hospitals" element={<LocateHospitals />} />
        {/* <Route path="/tracking/:id" element={<BookingTracker />} /> */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/driver/register" element={<DriverRegistration />} />
        <Route path="/driver/login" element={<DriverLogin />} />
        <Route path="/ambulance/dashboard" element={<AmbulanceLayout />} />
        <Route path="/track/:bookingId" element={<LiveTrackingPage />} />
        <Route path="/mock-ambulance" element={<MockAmbulanceUpdater />} />
        <Route path="/ambulance/bookings" element={<AmbulanceBookingSelection />} />
        <Route path="/ambulance/track/:bookingId" element={<ALiveTrackingPage />} />
        <Route path="/profile/:ambulanceId" element={<Profilepage />} />

        {/* Driver Protected Routes */}
        <Route
          path="/driver/dashboard"
          element={
            <DriverProtectedRoute>
              <DriverDashboard />
            </DriverProtectedRoute>
          }
        />
        <Route
          path="/driver/bookings"
          element={
            <DriverProtectedRoute>
              <DriverBookings />
            </DriverProtectedRoute>
          }
        />
        <Route
          path="/driver/profile"
          element={
            <DriverProtectedRoute>
              <DriverProfile />
            </DriverProtectedRoute>
          }
        />

        <Route
          path="/driver/track/:bookingId"
          element={
            <DriverProtectedRoute>
              <DriverTrackingPage />
            </DriverProtectedRoute>
          }
        />

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="patients" element={<PatientTable />} />
          <Route path="map" element={<MapView />} />
          <Route path="sync" element={<SyncMonitor />} />
          <Route path="archived" element={<ArchivedPatientsTable />} />
          <Route path="reviews" element={<ReviewModeration />} />
          <Route path="hospitals" element={<AdminHospitalManager />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
