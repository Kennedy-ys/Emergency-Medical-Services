import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PushOptIn from './PushOptIn';
import { supabase } from '../../lib/supabase';
import { getPushSubscription, pushRegistration, pushSupport } from '../../lib/pushDevice';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock('../../hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../lib/pushDevice', () => ({
  pushSupport: vi.fn(),
  pushRegistration: vi.fn(),
  getPushSubscription: vi.fn(),
  keyToBytes: () => new Uint8Array([1, 2, 3]),
  madeWithKey: () => true,
}));

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  toJSON: () => ({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'p-key', auth: 'a-key' },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

function setPermission(permission, afterAsking = permission) {
  const Notification = { permission, requestPermission: vi.fn() };
  Notification.requestPermission.mockImplementation(async () => {
    Notification.permission = afterAsking;
    return afterAsking;
  });
  vi.stubGlobal('Notification', Notification);
  return Notification;
}

function renderCard(audience = 'driver') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PushOptIn audience={audience} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'test-key');
  pushSupport.mockReturnValue('ok');
  getPushSubscription.mockResolvedValue(null);
  supabase.rpc.mockResolvedValue({ error: null });
  toast.error.mockReset();
  toast.success.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('PushOptIn', () => {
  it('subscribes this device and saves it when alerts are turned on', async () => {
    const Notification = setPermission('default', 'granted');
    const subscribe = vi.fn().mockResolvedValue(subscription);
    pushRegistration.mockResolvedValue({
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe },
    });
    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(Notification.requestPermission).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(supabase.rpc).toHaveBeenCalledWith(
      'save_push_subscription',
      expect.objectContaining({
        p_endpoint: subscription.endpoint,
        p_p256dh: 'p-key',
        p_auth: 'a-key',
      })
    );
  });

  it('explains when the user refuses notifications, and saves nothing', async () => {
    setPermission('default', 'denied');
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/blocked/)));
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('shows alerts as on, saves the device again for this user, and can turn them off', async () => {
    setPermission('granted');
    getPushSubscription.mockResolvedValue(subscription);
    const eq = vi.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ delete: () => ({ eq }) });
    renderCard();

    const off = await screen.findByRole('button', { name: 'Turn off alerts' });
    expect(supabase.rpc).toHaveBeenCalledWith('save_push_subscription', expect.anything());

    await userEvent.click(off);
    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions');
    expect(eq).toHaveBeenCalledWith('endpoint', subscription.endpoint);
  });

  it('tells iPhone users to add the app to the Home Screen first', async () => {
    setPermission('default');
    pushSupport.mockReturnValue('needs_install');
    renderCard('patient');
    expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('tells a driver when the browser cannot do alerts, but does not bother a patient', async () => {
    setPermission('default');
    pushSupport.mockReturnValue('unsupported');
    const { unmount } = renderCard('driver');
    expect(await screen.findByText(/cannot show alerts/)).toBeInTheDocument();
    unmount();

    const { container } = renderCard('patient');
    await waitFor(() => expect(pushSupport).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing when the app has no push key', async () => {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '');
    setPermission('default');
    const { container } = renderCard();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
