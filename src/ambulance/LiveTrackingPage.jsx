import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebaseConfig";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";

import ambulanceImg from "../assets/icons/ambulance-icon.png";
import hospitalImg from "../assets/icons/hospital-icon.png";
import patientImg from "../assets/icons/patient-icon.png";

const ambulanceIcon = L.icon({
  iconUrl: ambulanceImg,
  iconSize: [30, 30],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const hospitalIcon = L.icon({
  iconUrl: hospitalImg,
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

const patientIcon = L.icon({
  iconUrl: patientImg,
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

// Routing component
const Routing = ({
  ambulance,
  patient,
  hospital,
  setEtaText,
  setEtaColor,
  routePhase,
}) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!ambulance || !patient || !hospital || !map) return;

    // Remove previous routing control
    if (routingRef.current) {
      try {
        map.removeControl(routingRef.current);
      } catch (e) {
        console.warn("Routing cleanup failed", e);
      }
    }

    const waypoints =
      routePhase === "toPatient"
        ? [
            L.latLng(ambulance.lat, ambulance.lng),
            L.latLng(patient.lat, patient.lng),
          ]
        : [
            L.latLng(ambulance.lat, ambulance.lng),
            L.latLng(hospital.lat, hospital.lng),
          ];

    const control = L.Routing.control({
      waypoints,
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false,
      createMarker: () => null,
      show: false,
      fitSelectedRoutes: true,
    }).on("routesfound", (e) => {
      const route = e.routes[0];
      const durationSec = route.summary.totalTime || 0; // fallback
      const distanceM = route.summary.totalDistance || 0;

      const durationMin = Math.round(durationSec / 60);
      const distanceKm = (distanceM / 1000).toFixed(1);
      const etaLabel =
        durationMin >= 60
          ? `${Math.floor(durationMin / 60)}hr ${durationMin % 60}min`
          : `${durationMin}min`;

      setEtaText(`ETA: ${etaLabel}, ${distanceKm} km`);

      // Adjust color based on ETA
      if (durationMin < 15) {
        setEtaColor("bg-yellow-600 animate-pulse");
      } else if (durationMin < 8) {
        setEtaColor("bg-red-500 animate-pulse");
      } else {
        setEtaColor("bg-green-500");
      }
    }).addTo(map);

    routingRef.current = control;

    // Cleanup when phase or component unmounts
    return () => {
      if (routingRef.current) {
        map.removeControl(routingRef.current);
        routingRef.current = null;
      }
    };
  }, [ambulance, patient, hospital, routePhase, map, setEtaText, setEtaColor]);

  return null;
};

// Function to get distance between two points (meters)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // m
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
}

// Main component
const ALiveTrackingPage = () => {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [etaText, setEtaText] = useState("");
  const [etaColor, setEtaColor] = useState("bg-green-500");
  const [routePhase, setRoutePhase] = useState("toPatient"); // 'toPatient' or 'toHospital'

  // Fetch booking data
  useEffect(() => {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const unsubscribe = onValue(bookingRef, (snapshot) => {
      setBooking(snapshot.val());
    });
    return () => unsubscribe();
  }, [bookingId]);

  // Track ambulance location
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const location = { lat: latitude, lng: longitude };
        setAmbulanceLocation(location);

        // Update ambulance position in the database
        update(ref(db, `bookings/${bookingId}`), {
          ambulanceLocation: location,
        });

        if (booking?.ambulanceId) {
          update(ref(db, `ambulances/${booking.ambulanceId}`), {
            lat: location.lat,
            lng: location.lng,
            lastUpdated: new Date().toISOString(),
          });
        }
      },
      (err) => console.error("Geolocation error", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [booking?.ambulanceId, bookingId]);

  const patient = booking?.location;
  const hospital = booking?.hospitalLocation;

  const mapCenter = ambulanceLocation || patient || hospital;

  // Detect proximity to patient and switch route phase
  useEffect(() => {
    if (
      routePhase === "toPatient" &&
      ambulanceLocation &&
      patient
    ) {
      const dist = getDistance(
        ambulanceLocation.lat,
        ambulanceLocation.lng,
        patient.lat,
        patient.lng
      );
      if (dist < 10) { // within 10 meters
        setRoutePhase("toHospital");
      }
    }
  }, [ambulanceLocation, patient, routePhase]);

  return (
    <div className="h-screen w-full">

      {etaText && (
        <div
          className={`absolute top-4 left-17 text-white text-sm px-3 py-1 rounded-full shadow-lg z-[2000] ${etaColor}`}
        >
          {etaText}
        </div>
      )}

      {ambulanceLocation && booking && (
        <MapContainer
          center={mapCenter}
          zoom={14}
          style={{ height: "60vh", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          <Marker
            position={[ambulanceLocation.lat, ambulanceLocation.lng]}
            icon={ambulanceIcon}
          />
          <Marker position={[patient?.lat, patient?.lng]} icon={patientIcon} />
          <Marker position={[hospital?.lat, hospital?.lng]} icon={hospitalIcon} />

          {/* Routing component handles route updates based on phase */}
          <Routing
            ambulance={ambulanceLocation}
            patient={patient}
            hospital={hospital}
            setEtaText={setEtaText}
            setEtaColor={setEtaColor}
            routePhase={routePhase}
          />
        </MapContainer>
      )}

      {/* Your other page content */}
      <div className="p-4 bg-white shadow-md">
        <h2 className="text-lg font-bold mb-2">Booking Info</h2>
        <p><strong>Patient:</strong> {booking?.name}</p>
        <p><strong>Phone:</strong> {booking?.phone}</p>
        <p><strong>Notes:</strong> {booking?.notes}</p>
        <p><strong>Hospital:</strong> {booking?.hospital}</p>

        <div className="mt-4 flex gap-2">
          <button
            className="bg-yellow-600 text-white px-4 py-2 rounded"
            onClick={() =>
              update(ref(db, `bookings/${bookingId}`), {
                status: "Arrived at Patient",
              })
            }
          >
            Arrived at Patient
          </button>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={() =>
              update(ref(db, `bookings/${bookingId}`), {
                status: "En Route to Hospital",
              })
            }
          >
            To Hospital
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded ml-auto"
            onClick={() => {
              if (ambulanceLocation && hospital) {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${ambulanceLocation.lat},${ambulanceLocation.lng}&destination=${hospital.lat},${hospital.lng}&travelmode=driving`;
                window.open(url, "_blank");
              }
            }}
          >
            Google Maps
          </button>
        </div>
      </div>
    </div>
  );
};

export default ALiveTrackingPage;