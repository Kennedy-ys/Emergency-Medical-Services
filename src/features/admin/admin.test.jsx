import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DispatchPage from './DispatchPage';
import DriversPage from './DriversPage';
import ReviewsPage from './ReviewsPage';
import RecordsPage from './RecordsPage';
import StaffPage from './StaffPage';
import { formatElapsed, toCsv } from './shared';
import { supabase } from '../../lib/supabase';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../hooks/useSession', () => ({
  useSession: () => ({ profile: { full_name: 'Dee' }, role: 'admin', signOut: vi.fn() }),
}));
// Maps need a real browser; these screens are tested for what surrounds the map.
vi.mock('../../components/map/BaseMap', () => ({ default: () => <div data-testid="map" /> }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
  classifyError: (error) =>
    error?.code === 'P0001'
      ? { kind: 'business', code: error.message }
      : { kind: 'network', code: null },
}));

/** Every call chained on supabase.from(table), as [table, method, ...args]. */
let tableCalls = [];

/** Makes supabase.from(table) resolve to tables[table], whatever filters are chained on. */
function mockTables(tables) {
  supabase.from.mockImplementation((table) => {
    const result = Promise.resolve({ data: tables[table] ?? [], error: null });
    const query = new Proxy(
      {},
      {
        get: (_, key) => {
          if (key === 'then') return result.then.bind(result);
          return (...args) => {
            tableCalls.push([table, key, ...args]);
            return query;
          };
        },
      }
    );
    return query;
  });
}

function renderPage(page) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>
  );
}

const driver = (overrides) => ({
  id: 'd1',
  ambulance_number: 'AMB-1',
  license_plate: 'CAL-123',
  approval_status: 'pending',
  approval_note: null,
  availability: 'offline',
  created_at: '2026-11-10T08:00:00Z',
  profile: { full_name: 'Bassey Eyo', phone: '08031234567' },
  location: null,
  ...overrides,
});

const booking = (overrides) => ({
  id: 'b1',
  status: 'pending',
  contact_name: 'Ada Obi',
  contact_phone: '08030000000',
  notes: 'Chest pain',
  pickup_lat: 4.97,
  pickup_lng: 8.34,
  driver_id: null,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  hospital: { id: 'h1', name: 'General Hospital', lat: 4.96, lng: 8.33 },
  driver: null,
  ...overrides,
});

beforeEach(() => {
  supabase.from.mockReset();
  supabase.rpc.mockReset();
  supabase.functions.invoke.mockReset();
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'admin-1' } } } });
  tableCalls = [];
  toast.error.mockReset();
  toast.success.mockReset();
  const channel = { on: () => channel, subscribe: () => channel };
  supabase.channel.mockReturnValue(channel);
});

describe('formatElapsed', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  it('reads naturally from seconds to hours', () => {
    expect(formatElapsed('2026-11-10T11:59:40Z', now)).toBe('under 1 min');
    expect(formatElapsed('2026-11-10T11:53:00Z', now)).toBe('7 min');
    expect(formatElapsed('2026-11-10T09:55:00Z', now)).toBe('2 h 5 min');
  });
});

describe('DriversPage', () => {
  it('groups drivers by approval and approves through the server function', async () => {
    mockTables({
      drivers: [driver(), driver({ id: 'd2', approval_status: 'approved' })],
    });
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    renderPage(<DriversPage />);

    const waiting = (
      await screen.findByRole('heading', { name: 'Waiting for approval (1)' })
    ).closest('section');
    expect(screen.getByRole('heading', { name: 'Approved (1)' })).toBeInTheDocument();

    await userEvent.click(within(waiting).getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('set_driver_approval', {
        p_driver_id: 'd1',
        p_status: 'approved',
        p_note: null,
      })
    );
  });

  it('asks for confirmation and a reason before suspending', async () => {
    mockTables({ drivers: [driver({ approval_status: 'approved' })] });
    supabase.rpc.mockResolvedValue({ data: {}, error: null });
    renderPage(<DriversPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    expect(supabase.rpc).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Licence expired');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('set_driver_approval', {
        p_driver_id: 'd1',
        p_status: 'suspended',
        p_note: 'Licence expired',
      })
    );
  });

  it('says so when there are no drivers', async () => {
    mockTables({ drivers: [] });
    renderPage(<DriversPage />);
    expect(await screen.findByText('No drivers yet')).toBeInTheDocument();
  });
});

describe('DispatchPage', () => {
  it('flags a request that has waited too long and assigns the nearest driver', async () => {
    mockTables({ bookings: [booking()], drivers: [] });
    supabase.rpc.mockImplementation((name) =>
      Promise.resolve(
        name === 'nearest_drivers'
          ? {
              data: [
                {
                  driver_id: 'd1',
                  full_name: 'Bassey Eyo',
                  ambulance_number: 'AMB-1',
                  distance_m: 1200,
                },
              ],
              error: null,
            }
          : { data: {}, error: null }
      )
    );
    renderPage(<DispatchPage />);

    expect(await screen.findByText(/Waiting 5 min — needs a driver/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Assign' }));

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('assign_booking', {
        p_booking_id: 'b1',
        p_driver_id: 'd1',
      })
    );
  });

  it('tells the dispatcher when no driver is free', async () => {
    mockTables({ bookings: [booking()], drivers: [] });
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    renderPage(<DispatchPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Ada Obi/ }));
    expect(await screen.findByText(/No free driver is on duty/)).toBeInTheDocument();
  });

  it('explains a refused assignment in plain words', async () => {
    mockTables({ bookings: [booking()], drivers: [] });
    supabase.rpc.mockImplementation((name) =>
      Promise.resolve(
        name === 'nearest_drivers'
          ? { data: [{ driver_id: 'd1', full_name: 'Bassey Eyo', distance_m: 900 }], error: null }
          : { data: null, error: { code: 'P0001', message: 'driver_not_available' } }
      )
    );
    renderPage(<DispatchPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Ada Obi/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Assign' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('shows an empty state when nothing is in progress', async () => {
    mockTables({ bookings: [], drivers: [] });
    renderPage(<DispatchPage />);
    expect(await screen.findByText('No requests in progress')).toBeInTheDocument();
  });
});

describe('ReviewsPage', () => {
  it('publishes a waiting review and records who decided', async () => {
    mockTables({
      reviews: [
        {
          id: 'r1',
          display_name: 'Ada',
          rating: 4,
          comment: 'They came quickly.',
          status: 'pending',
          created_at: '2026-11-10T08:00:00Z',
        },
      ],
    });
    renderPage(<ReviewsPage />);

    expect(await screen.findByText('They came quickly.')).toBeInTheDocument();
    expect(screen.getByText('4 out of 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      const update = tableCalls.find(
        ([table, method]) => table === 'reviews' && method === 'update'
      );
      expect(update?.[2]).toMatchObject({ status: 'approved', moderated_by: 'admin-1' });
    });
    expect(tableCalls).toContainEqual(['reviews', 'eq', 'id', 'r1']);
  });

  it('says so when nothing is waiting', async () => {
    mockTables({ reviews: [] });
    renderPage(<ReviewsPage />);
    expect(await screen.findByText('No reviews are waiting.')).toBeInTheDocument();
  });
});

describe('RecordsPage', () => {
  it('lists crew records and archives one', async () => {
    mockTables({
      patient_records: [
        {
          id: 'p1',
          booking_id: 'b1',
          full_name: 'Eno Bassey',
          age: 54,
          gender: 'Female',
          address: null,
          phone: '08035550000',
          notes: 'Fractured wrist',
          is_archived: false,
          created_at: '2026-11-10T08:00:00Z',
          recorder: { full_name: 'Bassey Eyo' },
        },
      ],
    });
    renderPage(<RecordsPage />);

    expect(await screen.findByText('Eno Bassey')).toBeInTheDocument();
    expect(screen.getByText('54 years · Female')).toBeInTheDocument();
    expect(screen.getByText(/by Bassey Eyo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() =>
      expect(tableCalls).toContainEqual(['patient_records', 'update', { is_archived: true }])
    );
  });
});

describe('StaffPage', () => {
  const fillIn = async () => {
    await userEvent.type(await screen.findByLabelText('Full name'), 'Ima Udo');
    await userEvent.type(screen.getByLabelText('Email'), 'Ima@Example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  };

  it('lists staff and sends an invitation through the server function', async () => {
    mockTables({
      profiles: [{ id: 'a1', role: 'admin', full_name: 'Dee', created_at: '2026-11-09T08:00:00Z' }],
    });
    supabase.functions.invoke.mockResolvedValue({ data: { id: 'new' }, error: null });
    renderPage(<StaffPage />);

    expect(await screen.findByText('Dee')).toBeInTheDocument();
    await fillIn();

    await waitFor(() =>
      expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-staff', {
        body: { email: 'ima@example.com', full_name: 'Ima Udo', role: 'technician' },
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('explains when the email already has an account', async () => {
    mockTables({ profiles: [] });
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ error: 'already_registered' }) } },
    });
    renderPage(<StaffPage />);
    await fillIn();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Someone with this email already has an account.')
    );
  });

  it('does not send an invitation without a valid email', async () => {
    mockTables({ profiles: [] });
    renderPage(<StaffPage />);
    await userEvent.type(await screen.findByLabelText('Full name'), 'Ima Udo');
    await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });
});

describe('toCsv', () => {
  it('quotes awkward text and disarms spreadsheet formulas', () => {
    const csv = toCsv(
      [
        { name: 'Obi, Ada', notes: 'Said "ouch"' },
        { name: '=SUM(A1)', notes: null },
      ],
      [
        ['Patient', (row) => row.name],
        ['Notes', (row) => row.notes],
      ]
    );
    expect(csv).toBe(`Patient,Notes\r\n"Obi, Ada","Said ""ouch"""\r\n'=SUM(A1),`);
  });
});
