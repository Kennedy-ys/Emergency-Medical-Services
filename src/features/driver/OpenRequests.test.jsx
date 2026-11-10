import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import OpenRequests from './OpenRequests';
import { supabase } from '../../lib/supabase';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  classifyError: (error) =>
    error?.code === 'P0001'
      ? { kind: 'business', code: error.message }
      : { kind: 'network', code: null },
}));

/** Makes supabase.from('bookings').select().eq().order() resolve to the given result. */
function mockOpenRequests(result) {
  const query = { select: () => query, eq: () => query, order: () => Promise.resolve(result) };
  supabase.from.mockReturnValue(query);
}

function renderList(position = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OpenRequests position={position} />
    </QueryClientProvider>
  );
}

const request = {
  id: 'b1',
  status: 'pending',
  contact_name: 'Ada Obi',
  contact_phone: '08031234567',
  notes: 'Chest pain',
  pickup_lat: 4.9757,
  pickup_lng: 8.3417,
  created_at: new Date(Date.now() - 3 * 60_000).toISOString(),
  hospital: { id: 'h1', name: 'General Hospital' },
};

describe('OpenRequests', () => {
  beforeEach(() => {
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    toast.error.mockReset();
  });

  it('says so when nothing is waiting', async () => {
    mockOpenRequests({ data: [], error: null });
    renderList();
    expect(await screen.findByText('No requests waiting')).toBeInTheDocument();
  });

  it('offers a retry when the list cannot be loaded', async () => {
    mockOpenRequests({ data: null, error: { message: 'Failed to fetch' } });
    renderList();
    expect(await screen.findByText('Could not load requests.')).toBeInTheDocument();
  });

  it('shows who is waiting, for how long and how far away', async () => {
    mockOpenRequests({ data: [request], error: null });
    renderList({ lat: 4.9757, lng: 8.3517 });
    expect(await screen.findByText('Ada Obi')).toBeInTheDocument();
    expect(screen.getByText('Waiting 3 min')).toBeInTheDocument();
    expect(screen.getByText('Chest pain')).toBeInTheDocument();
    expect(screen.getByText(/away$/)).toBeInTheDocument();
  });

  it('accepts a request through the server function', async () => {
    mockOpenRequests({ data: [request], error: null });
    supabase.rpc.mockResolvedValue({ data: { id: 'b1', status: 'assigned' }, error: null });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('accept_booking', { p_booking_id: 'b1' })
    );
  });

  it('explains when another driver got there first', async () => {
    mockOpenRequests({ data: [request], error: null });
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'booking_already_taken' },
    });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Another driver has already accepted this request.')
    );
  });
});
