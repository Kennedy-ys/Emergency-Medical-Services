import React, { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { db } from "../firebaseConfig";
import { onValue, ref } from "firebase/database";
import "leaflet-routing-machine";

// Fix default marker icons for Vite + Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

// 🔵 User Marker Component
function UserLocationMarker({ setUserPosition }) {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      setUserPosition({ latitude, longitude });

      const userIcon = new L.Icon({
        iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      L.marker([latitude, longitude], { icon: userIcon })
        .addTo(map)
        .bindPopup("📍 You are here")
        .openPopup();

      map.setView([latitude, longitude], 13);
    });
  }, [map, setUserPosition]);

  return null;
}

// ➡️ Routing Component
function RouteToPatient({ patientLocation, userPosition }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!patientLocation || !userPosition) return;

    // Remove previous route if any
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    const control = L.Routing.control({
      waypoints: [
        L.latLng(userPosition.latitude, userPosition.longitude),
        L.latLng(patientLocation.latitude, patientLocation.longitude),
      ],
      routeWhileDragging: false,
      show: false,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: () => null, // don't show default markers
    }).addTo(map);

    routingControlRef.current = control;

    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
    };
  }, [map, patientLocation, userPosition]);

  return null;
}

export default function OfflineMap() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [userPosition, setUserPosition] = useState(null);

  useEffect(() => {
    const patientsRef = ref(db, "patients");
    const unsubscribe = onValue(patientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const patientList = Object.values(data).filter(
          (p) => p.location?.latitude && p.location?.longitude
        );
        setPatients(patientList);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full h-screen">
      <MapContainer
        center={[9.05, 7.45]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <UserLocationMarker setUserPosition={setUserPosition} />

        {patients.map((patient) => (
          <Marker
            key={patient.id}
            position={[
              patient.location.latitude,
              patient.location.longitude,
            ]}
            eventHandlers={{
              click: () => setSelectedPatient(patient),
            }}
          >
            <Popup>
              <strong>{patient.fullName}</strong>
              <br />
              {patient.age} yrs, {patient.gender}
              <br />
              {patient.phone}
            </Popup>
          </Marker>
        ))}

        {selectedPatient && userPosition && (
          <RouteToPatient
            patientLocation={selectedPatient.location}
            userPosition={userPosition}
          />
        )}
      </MapContainer>
    </div>
  );
}
