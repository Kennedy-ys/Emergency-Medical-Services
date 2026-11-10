import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '../components/ui/States';
import RequireRole from './RequireRole';
import LegacyFirebaseRoute from './LegacyFirebaseRoute';

// The landing page stays in the main bundle so the first screen is fast.
import Home from '../pages/Home';

// --- Screens on Supabase ---
const HospitalsPage = lazy(() => import('../features/hospitals/HospitalsPage'));
const StaffLoginPage = lazy(() => import('../features/auth/StaffLoginPage'));
const DispatchPage = lazy(() => import('../features/admin/DispatchPage'));
const DriversPage = lazy(() => import('../features/admin/DriversPage'));
const BookingsPage = lazy(() => import('../features/admin/BookingsPage'));
const BookingDetailPage = lazy(() => import('../features/admin/BookingDetailPage'));
const HospitalsAdminPage = lazy(() => import('../features/admin/HospitalsAdminPage'));
const DriverHomePage = lazy(() => import('../features/driver/DriverHomePage'));
const DriverRegisterPage = lazy(() => import('../features/driver/DriverRegisterPage'));
const BookPage = lazy(() => import('../features/booking/BookPage'));
const TrackPage = lazy(() => import('../features/tracking/TrackPage'));
const TechnicianHomePage = lazy(() => import('../features/technician/TechnicianHomePage'));

// --- Older screens still on Firebase. Each is replaced in its phase of the plan. ---
const TechnicianChat = lazy(() => import('../pages/TechnicianChat'));
const FirstAidTips = lazy(() => import('../pages/FirstAidTips'));
const AdminLogin = lazy(() => import('../pages/AdminLogin'));
const AdminLayout = lazy(() => import('../admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../admin/AdminDashboard'));
const PatientTable = lazy(() => import('../admin/PatientTable'));
const MapView = lazy(() => import('../admin/MapView'));
const SyncMonitor = lazy(() => import('../admin/SyncMonitor'));
const ArchivedPatientsTable = lazy(() => import('../admin/ArchivedPatientsTable'));
const ReviewModeration = lazy(() => import('../admin/ReviewModeration'));

const admin = (page) => (
  <RequireRole roles={['admin']} loginPath="/staff/login">
    {page}
  </RequireRole>
);

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState className="p-6" />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/hospitals" element={<HospitalsPage />} />
        <Route path="/locate-hospitals" element={<Navigate to="/hospitals" replace />} />
        <Route path="/first-aid-tips" element={<FirstAidTips />} />
        <Route path="/book" element={<BookPage />} />
        <Route path="/ambulance-booking" element={<Navigate to="/book" replace />} />
        <Route path="/track/:bookingId" element={<TrackPage />} />
        <Route path="/technician-chat" element={<TechnicianChat />} />

        {/* Staff areas on Supabase */}
        <Route path="/staff/login" element={<StaffLoginPage />} />
        <Route path="/admin/dispatch" element={admin(<DispatchPage />)} />
        <Route path="/admin/drivers" element={admin(<DriversPage />)} />
        <Route path="/admin/bookings" element={admin(<BookingsPage />)} />
        <Route path="/admin/bookings/:bookingId" element={admin(<BookingDetailPage />)} />
        <Route path="/admin/hospitals" element={admin(<HospitalsAdminPage />)} />
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

        <Route path="/driver/register" element={<DriverRegisterPage />} />
        {/* Addresses from the old driver app */}
        <Route path="/driver/login" element={<Navigate to="/staff/login" replace />} />
        <Route path="/driver/*" element={<Navigate to="/driver" replace />} />

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
