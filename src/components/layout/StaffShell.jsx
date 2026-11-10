import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../ui/Button';
import { useSession } from '../../hooks/useSession';

const ROLE_LABEL = { admin: 'Dispatcher', driver: 'Driver', technician: 'Technician' };

/** Header and page frame shared by the driver, technician and admin areas. */
export default function StaffShell({ title, children }) {
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
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{title}</h1>
        {children}
      </main>
    </div>
  );
}
