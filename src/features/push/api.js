import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  getPushSubscription,
  keyToBytes,
  madeWithKey,
  pushRegistration,
  pushSupport,
} from '../../lib/pushDevice';

// Public half of the signing key. Safe in the browser; the private half lives
// only in the push-notify function's secrets.
const publicKey = () => import.meta.env.VITE_VAPID_PUBLIC_KEY;

/** Tells the server to send this user's alerts to this browser. */
async function saveSubscription(subscription) {
  const { endpoint, keys } = subscription.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/**
 * Where alerts stand on this device:
 *   'not_configured' the app was built without a push key
 *   'unsupported'    this browser cannot do push
 *   'needs_install'  iPhone or iPad: add the app to the Home Screen first
 *   'blocked'        the user refused notifications for this site
 *   'off' | 'on'
 *
 * When alerts are on, the subscription is saved again for `userId`, so a device
 * that changed hands (or whose record was removed at sign-out) keeps working.
 */
export function usePushStatus(userId) {
  return useQuery({
    queryKey: ['push', 'status', userId ?? null],
    queryFn: async () => {
      if (!publicKey()) return 'not_configured';
      const support = pushSupport();
      if (support !== 'ok') return support;
      if (Notification.permission === 'denied') return 'blocked';
      const subscription = await getPushSubscription();
      if (!subscription || Notification.permission !== 'granted') return 'off';
      if (userId) {
        // Best effort: the next visit tries again.
        await saveSubscription(subscription).catch(() => {});
      }
      return 'on';
    },
    staleTime: Infinity,
    retry: false,
  });
}

function failure(reason) {
  return Object.assign(new Error(reason), { reason });
}

/**
 * Asks for permission, subscribes this browser and saves it for the signed-in
 * user. Must be called straight from a tap: browsers refuse the permission
 * question otherwise. Fails with `error.reason` of 'blocked', 'dismissed' or
 * 'not_ready' (no service worker yet), or with the Supabase error.
 */
export function useTurnOnPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw failure(permission === 'denied' ? 'blocked' : 'dismissed');
      }
      const registration = await pushRegistration();
      if (!registration) throw failure('not_ready');

      const key = keyToBytes(publicKey());
      let subscription = await registration.pushManager.getSubscription();
      // Made with an older key: the server could no longer send to it.
      if (subscription && !madeWithKey(subscription, key)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      await saveSubscription(subscription);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push'] }),
  });
}

/** Stops alerts on this device. */
export function useTurnOffPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const subscription = await getPushSubscription();
      if (!subscription) return;
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);
      if (error) throw error;
      await subscription.unsubscribe();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['push'] }),
  });
}
