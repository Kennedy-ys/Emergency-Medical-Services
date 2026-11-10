import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

/** Movements smaller than this (3 decimal places, about 110 m) do not trigger a new route. */
const round = (n) => (typeof n === 'number' ? Math.round(n * 1000) / 1000 : null);

/**
 * Draws the driving route between two { lat, lng } points.
 *
 * Only the routing service of leaflet-routing-machine is used; the line is
 * drawn here. Its on-map control is avoided because it adds an itinerary
 * button to the map and throws when it is removed while a request is in flight.
 * The previous line stays on screen until the next one arrives, so the route
 * does not flicker as the ambulance moves.
 *
 * @param {{ from: {lat:number,lng:number}|null, to: {lat:number,lng:number}|null,
 *           onSummary?: (summary: { distanceM: number, durationS: number } | null) => void }} props
 */
export default function RouteLayer({ from, to, onSummary }) {
  const map = useMap();
  const line = useRef(null);
  const onSummaryRef = useRef(onSummary);
  useEffect(() => {
    onSummaryRef.current = onSummary;
  });

  const fromLat = round(from?.lat);
  const fromLng = round(from?.lng);
  const toLat = round(to?.lat);
  const toLng = round(to?.lng);

  useEffect(() => {
    if ([fromLat, fromLng, toLat, toLng].some((n) => n === null)) return undefined;
    let cancelled = false;

    L.Routing.osrmv1().route(
      [L.Routing.waypoint(L.latLng(fromLat, fromLng)), L.Routing.waypoint(L.latLng(toLat, toLng))],
      (error, routes) => {
        if (cancelled) return;
        if (error || !routes?.length) {
          // Keep the last line and estimate rather than blanking them on one failed lookup.
          if (!line.current) onSummaryRef.current?.(null);
          return;
        }
        const [route] = routes;
        line.current?.remove();
        line.current = L.polyline(route.coordinates, {
          color: '#dc2626',
          weight: 5,
          opacity: 0.8,
        }).addTo(map);
        onSummaryRef.current?.({
          distanceM: route.summary.totalDistance,
          durationS: route.summary.totalTime,
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [map, fromLat, fromLng, toLat, toLng]);

  // Remove the line when the destination changes or the layer goes away,
  // but not each time the starting point moves.
  useEffect(
    () => () => {
      line.current?.remove();
      line.current = null;
      onSummaryRef.current?.(null);
    },
    [map, toLat, toLng]
  );

  return null;
}
