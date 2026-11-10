import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/** Zooms the map to show every given { lat, lng } point. Re-fits only when the points change. */
export default function FitBounds({ points, padding = 30, maxZoom = 15 }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (!key) return;
    const latLngs = key.split('|').map((pair) => pair.split(',').map(Number));
    map.fitBounds(L.latLngBounds(latLngs), { padding: [padding, padding], maxZoom });
  }, [map, key, padding, maxZoom]);

  return null;
}
