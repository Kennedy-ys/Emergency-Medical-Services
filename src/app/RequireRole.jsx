import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

/**
 * Route guard. Wrap protected routes with it in the route table.
 *
 *   <RequireRole roles={['admin']} loginPath="/staff/login"><AdminLayout /></RequireRole>
 *
 * This only decides what the UI shows. The database enforces the same rules
 * through row-level security, so bypassing this component gains nothing.
 */
export default function RequireRole({ roles, loginPath = '/login', children }) {
  const { loading, user, isAnonymous, role, driver } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" role="status">
        <p className="text-lg font-semibold text-gray-700">Loading…</p>
      </div>
    );
  }

  // Staff areas need a real account; an anonymous requester session is not enough.
  const staffOnly = !roles.includes('patient');
  if (!user || (staffOnly && isAnonymous)) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  if (!roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  if (role === 'driver' && driver?.approval_status !== 'approved') {
    const suspended = driver?.approval_status === 'suspended';
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            {suspended ? 'Account suspended' : 'Application received'}
          </h1>
          <p className="mt-2 text-gray-600">
            {suspended
              ? 'Your driver account has been suspended. Contact your dispatcher for details.'
              : 'A dispatcher needs to approve your account before you can receive requests.'}
          </p>
        </div>
      </div>
    );
  }

  return children;
}
