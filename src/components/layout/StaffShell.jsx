import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { useSession } from '../../hooks/useSession';

const ROLE_LABEL = { admin: 'Dispatcher', driver: 'Driver', technician: 'Technician' };

/**
 * Header and page frame shared by the driver, technician and admin areas.
 * `nav` is an optional list of { to, label } shown as tabs; `wide` gives
 * map-heavy screens the full width.
 */
export default function StaffShell({ title, nav, wide = false, children }) {
  const { profile, role, signOut } = useSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/staff/login', { replace: true });
    } catch {
      toast.error('Could not sign out. Check your connection and try again.');
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between gap-3 bg-brand px-4 py-3 text-white md:px-6">
        <div>
          <p className="text-lg font-semibold">EMS Connect</p>
          <p className="text-sm text-blue-100">
            {ROLE_LABEL[role] ?? 'Staff'}
            {profile?.full_name ? ` · ${profile.full_name}` : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={handleSignOut} loading={signingOut}>
          Sign out
        </Button>
      </header>
      {nav && (
        <nav aria-label="Sections" className="overflow-x-auto border-b border-gray-200 bg-white">
          <ul className={`mx-auto flex gap-1 px-4 md:px-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex min-h-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap ${
                      isActive
                        ? 'border-brand text-brand'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <main className={`mx-auto px-4 py-6 md:px-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{title}</h1>
        {children}
      </main>
    </div>
  );
}
