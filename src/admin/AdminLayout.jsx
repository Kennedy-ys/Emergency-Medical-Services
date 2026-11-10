import { Link, Outlet, useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useAdminStatus } from '../hooks/useAdminStatus';
// import AdminAutoDispatch from './AdminAutoDispatch';

export default function AdminLayout() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const { isAdmin, checking, user } = useAdminStatus();

  useEffect(() => {
    if (user) setEmail(user.email);
  }, [user]);

  const handleLogout = () => {
    const auth = getAuth();
    signOut(auth).then(() => {
      navigate('/admin-login');
    });
  };

  // 🌀 While checking admin status
  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">🔐 Checking admin access...</p>
      </div>
    );
  }

  // 🚫 Not an admin
  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-6 bg-white border shadow rounded">
          <h2 className="text-lg font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You do not have permission to access the admin panel.</p>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // ✅ Authorized admin view
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col p-4">
        <h2 className="text-xl font-bold mb-6">Admin Panel</h2>
        <nav className="flex flex-col gap-4">
          <Link to="/admin" className="hover:underline">Dashboard</Link>
          <Link to="/admin/patients" className="hover:underline">Patients</Link>
          <Link to="/admin/map" className="hover:underline">Map View</Link>
          <Link to="/admin/sync" className="hover:underline">Sync Monitor</Link>
          <Link to="/admin/archived" className="hover:underline">Archived Patients</Link>
          <Link to="/admin/reviews" className="hover:underline">Review Moderation</Link>
        </nav>
        <div className="mt-auto text-sm">
          <p className="mb-2">Logged in as: {email}</p>
          <button onClick={handleLogout} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600">
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-gray-100 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
