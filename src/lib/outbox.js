/**
 * Holds one ambulance request on the device until the server confirms it.
 *
 * The request is written here before the first send attempt, with an id made
 * on the device. Every retry carries the same id, and the server returns the
 * original row for an id it has already seen, so a request that was queued
 * offline is delivered exactly once however many times it is retried.
 */
const KEY = 'ems.pendingRequest';
const listeners = new Set();
let cache;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emit() {
  cache = read();
  listeners.forEach((listener) => listener());
}

/** @returns {object|null} The request waiting to be sent, if any. */
export function getPending() {
  if (cache === undefined) cache = read();
  return cache;
}

/** @returns {boolean} false if the device refused to store it (private mode, storage full). */
export function setPending(request) {
  try {
    localStorage.setItem(KEY, JSON.stringify(request));
  } catch {
    return false;
  } finally {
    emit();
  }
  return true;
}

export function clearPending() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
  emit();
}

export function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === KEY) emit();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
