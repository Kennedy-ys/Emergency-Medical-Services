import { MapContainer, TileLayer } from 'react-leaflet';
import { CALABAR } from '../../lib/geo';

/**
 * The one map setup for the app: tiles, attribution and the default view.
 * Screens add markers and layers as children.
 */
export default function BaseMap({
  center = CALABAR,
  zoom = 13,
  height = '60vh',
  className = '',
  children,
}) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      style={{ height, width: '100%' }}
      className={`rounded-lg ${className}`}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      {children}
    </MapContainer>
  );
}
