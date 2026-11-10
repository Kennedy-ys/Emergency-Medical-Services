import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Marker, Popup } from 'react-leaflet';
import BaseMap from '../../components/map/BaseMap';
import FitBounds from '../../components/map/FitBounds';
import RouteLayer from '../../components/map/RouteLayer';
import { hospitalIcon, patientIcon } from '../../components/map/markers';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { useGeolocation } from '../../hooks/useGeolocation';
import { distanceM, formatDistance, formatDuration } from '../../lib/geo';
import { useHospitals } from './api';

const LOCATION_NOTE = {
  prompt: 'Allow location access to see distances and directions.',
  denied:
    'Location access is off, so distances and directions are hidden. Turn it on in your browser settings.',
  unavailable: 'We could not get your location, so distances and directions are hidden.',
};

export default function HospitalsPage() {
  const { data, isPending, isError, refetch } = useHospitals();
  const { status: locationStatus, position, request } = useGeolocation();
  const [selectedId, setSelectedId] = useState(null);
  const [route, setRoute] = useState(null);

  // Nearest first once we know where the visitor is; otherwise by name.
  const hospitals = useMemo(() => {
    const rows = (data ?? []).map((h) => ({
      ...h,
      distance: position ? distanceM(position, h) : null,
    }));
    if (position) rows.sort((a, b) => a.distance - b.distance);
    return rows;
  }, [data, position]);

  const selected = hospitals.find((h) => h.id === selectedId) ?? null;
  const points = position ? [...hospitals, position] : hospitals;

  const clearRoute = () => {
    setSelectedId(null);
    setRoute(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <Link to="/" className="font-medium text-brand hover:underline">
          Back to home
        </Link>
        <h1 className="mt-2 mb-4 text-2xl font-bold text-gray-900">Hospitals near you</h1>

        {isPending && <LoadingState label="Loading hospitals…" className="mb-4" />}
        {isError && (
          <ErrorState message="Could not load hospitals." onRetry={refetch} className="mb-4" />
        )}

        {locationStatus !== 'granted' && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-gray-900">
            <p>{LOCATION_NOTE[locationStatus]}</p>
            {locationStatus === 'unavailable' && (
              <Button variant="secondary" onClick={request}>
                Try again
              </Button>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-xl shadow-sm">
          <BaseMap height="50vh">
            {hospitals.map((h) => (
              <Marker
                key={h.id}
                position={[h.lat, h.lng]}
                icon={hospitalIcon}
                eventHandlers={{ click: () => setSelectedId(h.id) }}
              >
                <Popup>
                  <strong>{h.name}</strong>
                  {h.address && (
                    <>
                      <br />
                      {h.address}
                    </>
                  )}
                </Popup>
              </Marker>
            ))}
            {position && (
              <Marker position={[position.lat, position.lng]} icon={patientIcon}>
                <Popup>You are here</Popup>
              </Marker>
            )}
            <FitBounds points={points} />
            {selected && position && (
              <RouteLayer from={position} to={selected} onSummary={setRoute} />
            )}
          </BaseMap>
        </div>

        {selected && (
          <Card
            className="mt-4 flex flex-wrap items-center justify-between gap-3"
            aria-live="polite"
          >
            <div>
              <p className="text-lg font-semibold text-gray-900">{selected.name}</p>
              <p className="text-gray-600">
                {!position
                  ? 'Turn on location to see the route.'
                  : route
                    ? `${formatDistance(route.distanceM)} by road, about ${formatDuration(route.durationS)}`
                    : 'Finding the route…'}
              </p>
            </div>
            <Button variant="secondary" onClick={clearRoute}>
              Clear route
            </Button>
          </Card>
        )}

        {!isPending && !isError && hospitals.length === 0 && (
          <EmptyState title="No hospitals listed yet" className="mt-4">
            For an emergency, call{' '}
            <a href="tel:112" className="font-semibold text-brand underline">
              112
            </a>
            .
          </EmptyState>
        )}

        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {hospitals.map((h) => (
            <Card as="li" key={h.id}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">{h.name}</h2>
                {h.distance != null && (
                  <span className="shrink-0 text-gray-600">{formatDistance(h.distance)}</span>
                )}
              </div>
              {h.address && <p className="text-gray-600">{h.address}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {h.phone && (
                  <a
                    href={`tel:${h.phone}`}
                    className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-4 font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Call {h.phone}
                  </a>
                )}
                {position && (
                  <>
                    <Button variant="ghost" onClick={() => setSelectedId(h.id)}>
                      Show route
                    </Button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-lg px-4 font-semibold text-brand hover:bg-brand-tint"
                    >
                      Open in Google Maps
                    </a>
                  </>
                )}
              </div>
            </Card>
          ))}
        </ul>
      </main>
    </div>
  );
}
