import { useSyncExternalStore } from 'react';

// Android Chrome offers "install this app" through an event that fires once,
// early, often before any screen has loaded. It is caught here (this file is
// imported from main.jsx) and kept until a screen wants to show the offer.

let offer = null;
const listeners = new Set();
const changed = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    offer = event;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    changed();
  });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * @returns {{ available: boolean, install: () => Promise<boolean> }}
 * `install` shows the browser's own install dialog and resolves to whether the
 * user accepted. The browser allows one use of each offer.
 */
export function useInstallPrompt() {
  const available = useSyncExternalStore(
    subscribe,
    () => offer !== null,
    () => false
  );
  const install = async () => {
    const event = offer;
    if (!event) return false;
    offer = null;
    changed();
    event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  };
  return { available, install };
}
