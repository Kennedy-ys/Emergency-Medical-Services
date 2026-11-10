import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoadingState } from '../components/ui/States';
import RequireRole from './RequireRole';

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
const RecordsPage = lazy(() => import('../features/admin/RecordsPage'));
const ReviewsPage = lazy(() => import('../features/admin/ReviewsPage'));
const StaffPage = lazy(() => import('../features/admin/StaffPage'));
const StaffWelcomePage = lazy(() => import('../features/auth/StaffWelcomePage'));
const DriverHomePage = lazy(() => import('../features/driver/DriverHomePage'));
const DriverRegisterPage = lazy(() => import('../features/driver/DriverRegisterPage'));
const BookPage = lazy(() => import('../features/booking/BookPage'));
const TrackPage = lazy(() => import('../features/tracking/TrackPage'));
const TechnicianHomePage = lazy(() => import('../features/technician/TechnicianHomePage'));

// --- Older screens not yet rebuilt. Each is replaced in its phase of the plan. ---
const TechnicianChat = lazy(() => import('../pages/TechnicianChat'));
const FirstAidTips = lazy(() => import('../pages/FirstAidTips'));

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
        <Route path="/admin/records" element={admin(<RecordsPage />)} />
        <Route path="/admin/reviews" element={admin(<ReviewsPage />)} />
        <Route path="/admin/staff" element={admin(<StaffPage />)} />
        <Route path="/staff/welcome" element={<StaffWelcomePage />} />
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

        {/* Addresses from the old admin area */}
        <Route path="/admin-login" element={<Navigate to="/staff/login" replace />} />
        <Route path="/admin/*" element={<Navigate to="/admin/dispatch" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
