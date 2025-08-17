import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { ref, onValue } from "firebase/database";
import { db } from "../firebaseConfig";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

// Fix Leaflet marker icons for Vite/React
delete L.Icon.Default.prototype._getIconUrl;
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";


L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom SVG patient icon
const patientIcon = L.icon({
  iconUrl:
    "data:image/svg+xml;base64," +
    btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 24" fill="red">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 4.25 4.83 9.09 6.39 10.69a1.003 1.003 0 0 0 1.22 0C14.17 18.09 19 13.25 19 9c0-3.87-3.13-7-7-7zm1 10h-2v2H9v-2H7V9h2V7h2v2h2v2z"/>
    </svg>`),
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

export default function MapView() {
  const [patients, setPatients] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const mapRef = useRef();
  const routingControlRef = useRef(null);

  // Get patients & user location
  useEffect(() => {
    const patientsRef = ref(db, "patients");
    onValue(patientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, value]) => ({
            id,
            ...value,
          }))
          .filter((p) => p.location?.latitude && p.location?.longitude);
        setPatients(list);
      }
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("Geolocation error:", err.message);
        }
      );
    }
  }, []);

  
  const routeToPatient = (patient) => {
    if (!userLocation) return;
    const map = mapRef.current;
    if (!map) return;

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
      routingControlRef.current = null;
      setRouteInfo(null);
    }

    
    const userLatLng = L.latLng(userLocation.latitude, userLocation.longitude);
    const patientLatLng = L.latLng(
      patient.location.latitude,
      patient.location.longitude
    );

    const control = L.Routing.control({
      waypoints: [userLatLng, patientLatLng],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: () => null,
      show: false,
    })
      .on("routesfound", function (e) {
        const route = e.routes[0];
        const { totalDistance, totalTime } = route.summary;
        setRouteInfo({
          distance: (totalDistance / 1000).toFixed(2) + " km",
          duration: Math.ceil(totalTime / 60) + " min",
        });
      })
      .addTo(map);

    routingControlRef.current = control;
  };

  const clearRoute = () => {
    const map = mapRef.current;
    if (routingControlRef.current && map) {
      map.removeControl(routingControlRef.current);
      routingControlRef.current = null;
      setRouteInfo(null);
    }
  };

  //
  const allPositions = [
    ...patients.map((p) => [p.location.latitude, p.location.longitude]),
    ...(userLocation ? [[userLocation.latitude, userLocation.longitude]] : []),
  ];

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        🗺️ Patient Locations
      </h2>

      <div className="relative rounded border shadow overflow-hidden">
        {/* Distance/Duration Box */}
        {routeInfo && (
          <div className="absolute top-2 left-2 bg-white border shadow-md p-2 rounded z-[1000] text-sm">
            <p>
              📍 <strong>Distance:</strong> {routeInfo.distance}
            </p>
            <p>
              ⏱️ <strong>Duration:</strong> {routeInfo.duration}
            </p>
          </div>
        )}

        <MapContainer
          ref={mapRef}
          center={[9.082, 8.6753]} // Nigeria fallback
          zoom={6}
          scrollWheelZoom={true}
          style={{ height: "75vh", width: "100%" }}
          className="rounded"
          whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          />

          {/* Patient Markers */}
          {patients.map((p) => (
            <Marker
              key={p.id}
              position={[p.location.latitude, p.location.longitude]}
              icon={patientIcon}
              eventHandlers={{
                click: () => routeToPatient(p),
              }}
            >
              <Popup >
                <strong>{p.fullName}</strong>
                <br />
                {p.gender}, {p.age} yrs
                <br />
                {p.phone}
                <br />
                {new Date(p.timestamp).toLocaleString()}
                <br />
                {/* Navigate with Google Maps */}
                {userLocation && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${p.location.latitude},${p.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"      className="inline-block mt-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-medium"
                  >
                    🧭 Navigate with Google Maps
                  </a>
                )}
              </Popup>
            </Marker>
          ))}

          {/* User Marker */}
          {userLocation && (
            <Marker position={[userLocation.latitude, userLocation.longitude]}>
              <Popup>
                🧍 You are here <br />
                Lat: {userLocation.latitude.toFixed(4)}, Lng:{" "}
                {userLocation.longitude.toFixed(4)}
              </Popup>
            </Marker>
          )}

          <FitBounds positions={allPositions} />
        </MapContainer>
      </div>

      {/* Clear Route Button */}
      <div className="mt-4">
        <button
          onClick={clearRoute}
          disabled={!routingControlRef.current}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          ❌ Clear Route
        </button>
      </div>
    </div>
  );
}

// Fit bounds to markers
function FitBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);

  return null;
}
