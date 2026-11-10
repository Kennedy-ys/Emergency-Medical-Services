// Push notifications. Loaded into the generated service worker by the
// importScripts setting in vite.config.js.
//
// The server sends { title, body, url, tag, urgent } (see
// supabase/functions/push-notify/messages.js).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not ours, or damaged: still show something, as browsers require.
  }
  const urgent = Boolean(data.urgent);
  event.waitUntil(
    self.registration.showNotification(data.title || 'EMS Connect', {
      body: data.body || 'Open the app for the latest update.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      // One notification per booking: an update replaces the one before it.
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: urgent,
      vibrate: urgent ? [300, 100, 300, 100, 300] : [200],
      data: { url: typeof data.url === 'string' ? data.url : '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Only ever open a page of this app.
  let target = new URL('/', self.location.origin);
  try {
    const wanted = new URL(event.notification.data?.url || '/', self.location.origin);
    if (wanted.origin === self.location.origin) target = wanted;
  } catch {
    // Keep the home page.
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        try {
          await open.focus();
          if (open.url !== target.href) await open.navigate(target.href);
          return;
        } catch {
          // Could not reuse that window: open a new one below.
        }
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
