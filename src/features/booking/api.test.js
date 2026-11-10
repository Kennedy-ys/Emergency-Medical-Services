import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPending, getPending } from '../../lib/outbox';
import { supabase } from '../../lib/supabase';
import { flushPendingRequest, submitRequest } from './api';

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
  ensureSession: vi.fn().mockResolvedValue(undefined),
  classifyError: (error) =>
    error?.code === 'P0001'
      ? { kind: 'business', code: error.message }
      : { kind: 'network', code: null },
}));

const details = {
  contactName: 'Test Person',
  contactPhone: '08031234567',
  pickup: { lat: 4.97, lng: 8.34 },
  hospitalId: null,
  notes: '',
};

describe('request outbox', () => {
  beforeEach(() => {
    clearPending();
    supabase.rpc.mockReset();
  });

  it('sends a request and clears it from the device once the server confirms', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'b1' }, error: null });

    const result = await submitRequest(details);

    expect(result).toEqual({ status: 'sent', booking: { id: 'b1' } });
    expect(getPending()).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith(
      'request_booking',
      expect.objectContaining({ p_contact_name: 'Test Person', p_pickup_lat: 4.97 })
    );
  });

  it('keeps the request when the network fails, and retries with the same id', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });

    const first = await submitRequest(details);
    expect(first).toEqual({ status: 'queued' });
    const saved = getPending();
    expect(saved.clientRequestId).toBeTruthy();

    supabase.rpc.mockResolvedValueOnce({ data: { id: 'b1' }, error: null });
    const second = await flushPendingRequest();

    expect(second.status).toBe('sent');
    expect(getPending()).toBeNull();
    const ids = supabase.rpc.mock.calls.map(([, args]) => args.p_client_request_id);
    expect(ids).toEqual([saved.clientRequestId, saved.clientRequestId]);
  });

  it('drops a request the server refuses, and reports why', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'active_request_exists' },
    });

    const result = await submitRequest(details);

    expect(result).toEqual({ status: 'rejected', code: 'active_request_exists' });
    expect(getPending()).toBeNull();
  });

  it('shares one attempt between callers that flush at the same time', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    await submitRequest(details);

    supabase.rpc.mockResolvedValue({ data: { id: 'b1' }, error: null });
    const [a, b] = await Promise.all([flushPendingRequest(), flushPendingRequest()]);

    expect(a).toBe(b);
    expect(supabase.rpc).toHaveBeenCalledTimes(2); // the failed attempt, then one shared retry
  });

  it('does nothing when there is no request waiting', async () => {
    expect(await flushPendingRequest()).toEqual({ status: 'empty' });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
