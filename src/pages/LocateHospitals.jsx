import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { ref, onValue } from "firebase/database";
import { db } from "../firebaseConfig";
import L from "leaflet";
import { GiPathDistance } from "react-icons/gi"
import { RxLapTimer } from "react-icons/rx";
import { RiPhoneFill } from "react-icons/ri";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import markerShadow from "leaflet/dist/images/marker-shadow.png";
import patientImg from "../assets/icons/patient-icon.png";
import hospitalImg from "../assets/icons/hospital-icon.png";

const patientIcon = L.icon({
  iconUrl: patientImg,
  shadowUrl: markerShadow,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

const hospitalIcon = L.icon({
  iconUrl: hospitalImg,
  shadowUrl: markerShadow,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

const LocateHospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const mapRef = useRef();
  const routingControlRef = useRef(null);

  // Get hospitals & user location
  useEffect(() => {
    const hospitalsRef = ref(db, "hospitals");
    return onValue(hospitalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .filter(([_, h]) => !h.archived)
          .map(([id, h]) => ({
            id,
            ...h,
            location: {
              latitude: parseFloat(h.lat),
              longitude: parseFloat(h.lng),
            },
          }));
        setHospitals(list);
      }
    });
    
  }, []);

  useEffect(() => {
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

  const routeToHospital = (hospital) => {
    if (!userLocation) return;
    const map = mapRef.current;
    if (!map) return;

    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
      routingControlRef.current = null;
      setRouteInfo(null);
    }

    const userLatLng = L.latLng(userLocation.latitude, userLocation.longitude);
    const hospitalLatLng = L.latLng(
      hospital.location.latitude,
      hospital.location.longitude
    );

    const control = L.Routing.control({
      waypoints: [userLatLng, hospitalLatLng],
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
    ...hospitals.map((h) => [h.location.latitude, h.location.longitude]),
    ...(userLocation ? [[userLocation.latitude, userLocation.longitude]] : []),
  ];

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        🗺️ hospital Locations
      </h2>

      <div className="relative rounded shadow overflow-hidden">
        {/* Distance/Duration Box */}
        {routeInfo && (
          <div className="absolute top-2 left-13 bg-white border shadow-md p-2 rounded z-[1000] text-sm">
            <p>
              <GiPathDistance /><strong>Distance:</strong> {routeInfo.distance}
            </p>
            <p>
              <RxLapTimer /><strong>Duration:</strong> {routeInfo.duration}
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

          {/* hospital Markers */}
          {hospitals.map((h) => (
            <Marker
              key={h.id}
              position={[h.location.latitude, h.location.longitude]}
              icon={hospitalIcon}
              eventHandlers={{
                click: () => routeToHospital(h),
              }}
            >
              <Popup>
                <strong className="pb-4.5">{h.name}</strong>
                <br />
                {h.address}
                <br />
                <span></span>
                <RiPhoneFill /> {h.phone || "N/A"}
                <br />
                {userLocation && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${h.location.latitude},${h.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-medium"
                  >
                   <RxLapTimer /> Navigate with Google Maps
                  </a>
                )}
              </Popup>
            </Marker>
          ))}

          {/* User Marker */}
          {userLocation && (
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              icon={patientIcon}
            >
              <Popup>
                🧍 You are here
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
};

// Fit bounds to markers
function FitBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [5, 5] });
    }
  }, [positions, map]);

  return null;
}

export default LocateHospitals;
