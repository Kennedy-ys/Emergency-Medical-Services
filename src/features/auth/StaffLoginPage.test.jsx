import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StaffLoginPage from './StaffLoginPage';
import { useSession } from '../../hooks/useSession';
import { supabase } from '../../lib/supabase';

vi.mock('../../hooks/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));

function renderLogin(session = {}, from) {
  useSession.mockReturnValue({
    loading: false,
    user: null,
    isAnonymous: false,
    role: null,
    signOut: vi.fn(),
    ...session,
  });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/staff/login', state: from ? { from } : null }]}>
        <Routes>
          <Route path="/staff/login" element={<StaffLoginPage />} />
          <Route path="/admin/dispatch" element={<p>Dispatch</p>} />
          <Route path="/admin/drivers" element={<p>Admin drivers</p>} />
          <Route path="/driver" element={<p>Driver home</p>} />
          <Route path="/technician" element={<p>Technician home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('StaffLoginPage', () => {
  beforeEach(() => {
    supabase.auth.signInWithPassword.mockReset();
  });

  it('asks for both fields before contacting the server', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with the typed email and password', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'dispatch@example.org');
    await userEvent.type(screen.getByLabelText('Password'), 'not-a-real-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'dispatch@example.org',
      password: 'not-a-real-password',
    });
  });

  it('explains a wrong password in plain words', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', status: 400 },
    });
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), 'dispatch@example.org');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();
  });

  it.each([
    ['admin', 'Dispatch'],
    ['driver', 'Driver home'],
    ['technician', 'Technician home'],
  ])('sends a signed-in %s to their own area', (role, text) => {
    renderLogin({ user: { id: 'u1' }, role });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('returns an admin to the admin page they were trying to open', () => {
    renderLogin({ user: { id: 'u1' }, role: 'admin' }, '/admin/drivers');
    expect(screen.getByText('Admin drivers')).toBeInTheDocument();
  });

  it("never sends a driver to another role's page", () => {
    renderLogin({ user: { id: 'u1' }, role: 'driver' }, '/admin/drivers');
    expect(screen.getByText('Driver home')).toBeInTheDocument();
  });

  it('tells a patient account it has no staff access', () => {
    renderLogin({ user: { id: 'u1' }, role: 'patient' });
    expect(screen.getByRole('alert')).toHaveTextContent('does not have staff access');
  });

  it('shows the form to an anonymous requester session', () => {
    renderLogin({ user: { id: 'u1' }, isAnonymous: true, role: 'patient' });
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
