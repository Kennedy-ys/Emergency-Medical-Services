import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

/**
 * Draws the driving route between two { lat, lng } points and removes it on
 * unmount or when either end changes.
 *
 * @param {{ from: {lat:number,lng:number}|null, to: {lat:number,lng:number}|null,
 *           onSummary?: (summary: { distanceM: number, durationS: number } | null) => void }} props
 */
export default function RouteLayer({ from, to, onSummary }) {
  const map = useMap();
  const onSummaryRef = useRef(onSummary);
  useEffect(() => {
    onSummaryRef.current = onSummary;
  });

  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;

  useEffect(() => {
    if ([fromLat, fromLng, toLat, toLng].some((n) => typeof n !== 'number')) return undefined;

    const control = L.Routing.control({
      waypoints: [L.latLng(fromLat, fromLng), L.latLng(toLat, toLng)],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      createMarker: () => null,
      show: false,
    })
      .on('routesfound', (e) => {
        const { totalDistance, totalTime } = e.routes[0].summary;
        onSummaryRef.current?.({ distanceM: totalDistance, durationS: totalTime });
      })
      .on('routingerror', () => onSummaryRef.current?.(null))
      .addTo(map);

    return () => {
      try {
        map.removeControl(control);
      } catch {
        // The routing library throws if removed while a request is still in flight.
      }
      onSummaryRef.current?.(null);
    };
  }, [map, fromLat, fromLng, toLat, toLng]);

  return null;
}
