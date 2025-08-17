self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/generated-osm-tiles.json')
      .then(res => res.json())
      .then(urls => {
        return caches.open('osm-tile-cache').then(cache => {
          return cache.addAll(urls);
        });
      })
      .catch(err => console.error('Failed to precache tiles:', err))
  );
});
