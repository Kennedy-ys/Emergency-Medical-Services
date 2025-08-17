// generateTiles.js
const fs = require('fs');

// Convert lat/lng to tile x/y at given zoom
function deg2tile(lat, lon, zoom) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
  );
  return { x, y };
}

const centerLat = 9.057;   // e.g., Abuja
const centerLng = 7.448;
const zoom = 13;
const radius = 1; // how many tiles around the center in x/y direction

const { x: centerX, y: centerY } = deg2tile(centerLat, centerLng, zoom);

const tileUrls = [];

for (let dx = -radius; dx <= radius; dx++) {
  for (let dy = -radius; dy <= radius; dy++) {
    const x = centerX + dx;
    const y = centerY + dy;
    tileUrls.push(`https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`);
  }
}

fs.writeFileSync('public/generated-osm-tiles.json', JSON.stringify(tileUrls, null, 2));
console.log(`✅ Generated ${tileUrls.length} tile URLs.`);
