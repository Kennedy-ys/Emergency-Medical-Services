// What this browser can do about push notifications, and its current subscription.
// No server calls here: saving a subscription lives in features/push/api.js.

function isIos() {
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isInstalled() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigator.standalone === true
  );
}

/**
 * 'ok'            push can be used here
 * 'needs_install' an iPhone or iPad, where push only works once the app is on the Home Screen
 * 'unsupported'   this browser cannot do push at all
 */
export function pushSupport() {
  const capable =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (capable) return 'ok';
  return isIos() && !isInstalled() ? 'needs_install' : 'unsupported';
}

/** The active service worker, or null if none becomes ready in time (as in development). */
export function pushRegistration(waitMs = 4000) {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
}

/** This browser's push subscription, or null. Never waits for a service worker to appear. */
export async function getPushSubscription() {
  if (pushSupport() !== 'ok') return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager?.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Turns the public key from its text form into the bytes the browser wants. */
export function keyToBytes(base64Url) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** True when a subscription was made with the given key bytes. */
export function madeWithKey(subscription, keyBytes) {
  const used = subscription.options?.applicationServerKey;
  if (!used) return true; // Cannot tell: assume it is ours.
  const bytes = new Uint8Array(used);
  return bytes.length === keyBytes.length && bytes.every((byte, i) => byte === keyBytes[i]);
}
