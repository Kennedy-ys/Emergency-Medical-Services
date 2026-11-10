/** Coordinates are always { lat, lng } in the UI. */

/** Default map view: central Calabar. */
export const CALABAR = { lat: 4.9757, lng: 8.3417 };

/** Straight-line distance in metres between two { lat, lng } points. */
export function distanceM(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** "850 m" or "3.2 km". */
export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** "1 min", "12 min". Never shows zero. */
export function formatDuration(seconds) {
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}
