import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RequireRole from './RequireRole';
import { useSession } from '../hooks/useSession';

vi.mock('../hooks/useSession', () => ({ useSession: vi.fn() }));

function Login() {
  const location = useLocation();
  return <p>Login page, from {location.state?.from}</p>;
}

function renderAt(path, session) {
  useSession.mockReturnValue({
    loading: false,
    user: null,
    isAnonymous: false,
    role: null,
    driver: null,
    ...session,
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/staff/login" element={<Login />} />
        <Route
          path="/admin/dispatch"
          element={
            <RequireRole roles={['admin']} loginPath="/staff/login">
              <p>Admin area</p>
            </RequireRole>
          }
        />
        <Route
          path="/driver"
          element={
            <RequireRole roles={['driver']} loginPath="/staff/login">
              <p>Driver area</p>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

const user = { id: 'u1' };

describe('RequireRole', () => {
  it('shows a loading state while the session is being read', () => {
    renderAt('/admin/dispatch', { loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page and remembers where they were going', () => {
    renderAt('/admin/dispatch');
    expect(screen.getByText('Login page, from /admin/dispatch')).toBeInTheDocument();
  });

  it('does not let an anonymous requester session into a staff area', () => {
    renderAt('/admin/dispatch', { user, isAnonymous: true, role: 'patient' });
    expect(screen.getByText(/Login page/)).toBeInTheDocument();
  });

  it('lets an admin into the admin area', () => {
    renderAt('/admin/dispatch', { user, role: 'admin' });
    expect(screen.getByText('Admin area')).toBeInTheDocument();
  });

  it('sends a driver away from the admin area', () => {
    renderAt('/admin/dispatch', {
      user,
      role: 'driver',
      driver: { approval_status: 'approved' },
    });
    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).not.toBeInTheDocument();
  });

  it('sends an admin away from the driver area', () => {
    renderAt('/driver', { user, role: 'admin' });
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('lets an approved driver into the driver area', () => {
    renderAt('/driver', { user, role: 'driver', driver: { approval_status: 'approved' } });
    expect(screen.getByText('Driver area')).toBeInTheDocument();
  });

  it('holds a driver who is not approved yet', () => {
    renderAt('/driver', { user, role: 'driver', driver: { approval_status: 'pending' } });
    expect(screen.getByText('Application received')).toBeInTheDocument();
    expect(screen.queryByText('Driver area')).not.toBeInTheDocument();
  });

  it('tells a suspended driver they are suspended', () => {
    renderAt('/driver', { user, role: 'driver', driver: { approval_status: 'suspended' } });
    expect(screen.getByText('Account suspended')).toBeInTheDocument();
  });
});
