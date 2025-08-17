import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents
} from "react-leaflet";
import L from "leaflet";

// Default Leaflet marker fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png"
});

const LocationMarker = ({ onSelect }) => {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onSelect(`${e.latlng.lat},${e.latlng.lng}`);
    }
  });

  return position === null ? null : <Marker position={position} />;
};

const MapPicker = ({ onSelect }) => {
  const [center, setCenter] = useState([6.5244, 3.3792]); // Default to Lagos

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        onSelect(`${pos.coords.latitude},${pos.coords.longitude}`);
      });
    }
  }, [onSelect]);

  return (
    <div className="mt-3">
      <p className="text-sm text-gray-600 mb-1">Click map to select pickup point</p>
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: "300px", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker onSelect={onSelect} />
      </MapContainer>
    </div>
  );
};

export default MapPicker;
