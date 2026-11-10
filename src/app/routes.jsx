import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '../components/ui/States';
import RequireRole from './RequireRole';
import LegacyFirebaseRoute from './LegacyFirebaseRoute';
import DriverProtectedRoute from '../components/DriverProtectedRoute';

// The landing page stays in the main bundle so the first screen is fast.
import Home from '../pages/Home';

// --- Screens on Supabase ---
const HospitalsPage = lazy(() => import('../features/hospitals/HospitalsPage'));
const StaffLoginPage = lazy(() => import('../features/auth/StaffLoginPage'));
const DispatchPage = lazy(() => import('../features/admin/DispatchPage'));
const DriverHomePage = lazy(() => import('../features/driver/DriverHomePage'));
const TechnicianHomePage = lazy(() => import('../features/technician/TechnicianHomePage'));

// --- Older screens still on Firebase. Each is replaced in its phase of the plan. ---
const AmbulanceBooking = lazy(() => import('../pages/AmbulanceBooking'));
const LiveTrackingPage = lazy(() => import('../pages/LiveTrackingPage'));
const TechnicianChat = lazy(() => import('../pages/TechnicianChat'));
const FirstAidTips = lazy(() => import('../pages/FirstAidTips'));
const AdminLogin = lazy(() => import('../pages/AdminLogin'));
const DriverRegistration = lazy(() => import('../driver/DriverRegistration'));
const DriverLogin = lazy(() => import('../driver/DriverLogin'));
const DriverDashboard = lazy(() => import('../driver/DriverDashboard'));
const DriverBookings = lazy(() => import('../driver/DriverBookings'));
const DriverProfile = lazy(() => import('../driver/DriverProfile'));
const DriverTrackingPage = lazy(() => import('../driver/DriverTrackingPage'));
const AdminLayout = lazy(() => import('../admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../admin/AdminDashboard'));
const PatientTable = lazy(() => import('../admin/PatientTable'));
const MapView = lazy(() => import('../admin/MapView'));
const SyncMonitor = lazy(() => import('../admin/SyncMonitor'));
const ArchivedPatientsTable = lazy(() => import('../admin/ArchivedPatientsTable'));
const ReviewModeration = lazy(() => import('../admin/ReviewModeration'));
const AdminHospitalManager = lazy(() => import('../admin/AdminHospitalManager'));

const legacyDriver = (page) => <DriverProtectedRoute>{page}</DriverProtectedRoute>;

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState className="p-6" />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/hospitals" element={<HospitalsPage />} />
        <Route path="/locate-hospitals" element={<Navigate to="/hospitals" replace />} />
        <Route path="/first-aid-tips" element={<FirstAidTips />} />
        <Route path="/ambulance-booking" element={<AmbulanceBooking />} />
        <Route path="/track/:bookingId" element={<LiveTrackingPage />} />
        <Route path="/technician-chat" element={<TechnicianChat />} />

        {/* Staff areas on Supabase */}
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route
          path="/admin/dispatch"
          element={
            <RequireRole roles={['admin']} loginPath="/staff/login">
              <DispatchPage />
            </RequireRole>
          }
        />
        <Route
          path="/driver"
          element={
            <RequireRole roles={['driver']} loginPath="/staff/login">
              <DriverHomePage />
            </RequireRole>
          }
        />
        <Route
          path="/technician"
          element={
            <RequireRole roles={['technician']} loginPath="/staff/login">
              <TechnicianHomePage />
            </RequireRole>
          }
        />

        {/* Older driver area (Firebase) */}
        <Route path="/driver/register" element={<DriverRegistration />} />
        <Route path="/driver/login" element={<DriverLogin />} />
        <Route path="/driver/dashboard" element={legacyDriver(<DriverDashboard />)} />
        <Route path="/driver/bookings" element={legacyDriver(<DriverBookings />)} />
        <Route path="/driver/profile" element={legacyDriver(<DriverProfile />)} />
        <Route path="/driver/track/:bookingId" element={legacyDriver(<DriverTrackingPage />)} />

        {/* Older admin area (Firebase) */}
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <LegacyFirebaseRoute>
              <AdminLayout />
            </LegacyFirebaseRoute>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
