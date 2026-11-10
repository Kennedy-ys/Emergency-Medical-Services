import { useEffect, useMemo, useRef } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import BaseMap from './BaseMap';
import { patientIcon } from './markers';

function Pin({ value, onChange }) {
  const map = useMap();
  const markerRef = useRef(null);

  useMapEvents({
    click: (event) => onChange({ lat: event.latlng.lat, lng: event.latlng.lng }),
  });

  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (lat == null || lng == null) return;
    // Keep the pin in view without undoing the user's own zooming.
    if (!map.getBounds().pad(-0.2).contains([lat, lng])) {
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    }
  }, [map, lat, lng]);

  const handlers = useMemo(
    () => ({
      dragend: () => {
        const point = markerRef.current?.getLatLng();
        if (point) onChange({ lat: point.lat, lng: point.lng });
      },
    }),
    [onChange]
  );

  if (lat == null || lng == null) return null;
  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={patientIcon}
      draggable
      eventHandlers={handlers}
      alt="Pickup location"
    />
  );
}

/**
 * A map for choosing a point: tap anywhere or drag the pin.
 * @param {{ value: {lat:number,lng:number}|null, onChange: (point:{lat:number,lng:number}) => void,
 *           height?: string }} props
 */
export default function LocationPicker({ value, onChange, height = '40vh' }) {
  return (
    <BaseMap center={value ?? undefined} zoom={value ? 16 : 13} height={height}>
      <Pin value={value} onChange={onChange} />
    </BaseMap>
  );
}
