import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import TripRecordForm from './TripRecordForm';
import { supabase } from '../../lib/supabase';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));

const trip = {
  id: 'b1',
  contact_name: 'Ada Obi',
  contact_phone: '08030000000',
  pickup_address: null,
  pickup_lat: 4.97,
  pickup_lng: 8.34,
};

let insert;
const onDone = vi.fn();

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TripRecordForm trip={trip} userId="d1" onDone={onDone} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  insert = vi.fn().mockResolvedValue({ error: null });
  supabase.from.mockReturnValue({ insert });
  onDone.mockReset();
  toast.error.mockReset();
});

describe('TripRecordForm', () => {
  it('saves the record against the trip and the driver', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Full name of the patient'), 'Eno Bassey');
    await userEvent.type(screen.getByLabelText('Age in years (optional)'), '54');
    await userEvent.type(screen.getByLabelText('What you found and what you did'), 'Splinted');
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(supabase.from).toHaveBeenCalledWith('patient_records');
    expect(insert.mock.calls[0][0]).toMatchObject({
      booking_id: 'b1',
      recorded_by: 'd1',
      full_name: 'Eno Bassey',
      age: 54,
      gender: null,
      phone: '08030000000',
      notes: 'Splinted',
    });
    expect(insert.mock.calls[0][0].client_request_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('needs the name of the patient', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }));
    expect(await screen.findByText('Enter the name of the patient.')).toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
  });

  it('treats a record that was already stored as saved', async () => {
    insert.mockResolvedValue({ error: { code: '23505' } });
    renderForm();
    await userEvent.type(screen.getByLabelText('Full name of the patient'), 'Eno Bassey');
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('keeps the form open when saving fails', async () => {
    insert.mockResolvedValue({ error: { code: '42501' } });
    renderForm();
    await userEvent.type(screen.getByLabelText('Full name of the patient'), 'Eno Bassey');
    await userEvent.click(screen.getByRole('button', { name: 'Save record' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
  });
});
