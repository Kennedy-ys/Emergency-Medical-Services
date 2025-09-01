// src/driver/DriverTrackingPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { auth, db } from "../firebaseConfig";
import { MapContainer, Popup, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ambulanceImg from "../assets/icons/ambulance-icon.png";
import hospitalImg from "../assets/icons/hospital-icon.png";
import patientImg from "../assets/icons/patient-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";


const ambulanceIcon = L.icon({
  iconUrl: ambulanceImg,
  iconSize: [30, 30],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const hospitalIcon = L.icon({
  iconUrl: hospitalImg,
  shadowUrl: markerShadow,
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

// Routing logic
const Routing = ({ ambulance, patient, hospital, setEtaText, setEtaColor, routePhase }) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!ambulance || !patient || !hospital || !map) return;

    if (routingRef.current) {
      try {
        map.removeControl(routingRef.current);
      } catch (e) {
        console.warn("Routing cleanup failed", e);
      }
    }

    const waypoints =
      routePhase === "toPatient"
        ? [L.latLng(ambulance.lat, ambulance.lng), L.latLng(patient.lat, patient.lng)]
        : [L.latLng(ambulance.lat, ambulance.lng), L.latLng(hospital.lat, hospital.lng)];

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
      const durationSec = route.summary.totalTime || 0;
      const distanceM = route.summary.totalDistance || 0;

      const durationMin = Math.round(durationSec / 60);
      const distanceKm = (distanceM / 1000).toFixed(1);
      const etaLabel =
        durationMin >= 60
          ? `${Math.floor(durationMin / 60)}hr ${durationMin % 60}min`
          : `${durationMin}min`;

      setEtaText(`ETA: ${etaLabel}, ${distanceKm} km`);

    // Adjust color based on ETA
      if (durationMin < 8) {
        setEtaColor("bg-red-500 animate-pulse");
      } else if (durationMin < 15) {
        setEtaColor("bg-yellow-600 animate-pulse");
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
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DriverTrackingPage = () => {
  const { bookingId } = useParams();
  const driverId = auth.currentUser?.uid;
  const [booking, setBooking] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [etaText, setEtaText] = useState("");
  const [etaColor, setEtaColor] = useState("bg-green-500");
  const [routePhase, setRoutePhase] = useState("toPatient");
  const navigate = useNavigate();

  // Listen for booking data
  useEffect(() => {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const unsub = onValue(bookingRef, (snap) => setBooking(snap.val()));
    return () => unsub();

  }, [bookingId]);

  // Watch GPS and update driver + booking
  useEffect(() => {
    if (!driverId) return;
    const driverLocRef = ref(db, `drivers/${driverId}/location`);
    const unsub = onValue(driverLocRef, (snap) => {
      if (snap.exists()) {
        setDriverLocation(snap.val());
      }
    });

    return () => unsub();
  }, [driverId]);

  // If booking is cancelled
  useEffect(() => {
    if (!booking || !driverId) return;
    if (booking.status === "cancelled") {
      const driverRef = ref(db, `drivers/${driverId}`);
      update(driverRef, { 
        status: "available",
        currentBookingId: null,
      })
      .then(() => {
        navigate("/driver/bookings")
        toast.success("Booking was cancelled by patient")
      }).catch((err) => {
        console.error("Error updating driver status:", err);
        toast.error("Failed to update driver status");
      })
    }
  }, [booking, driverId]); 

  const patient = booking?.location;
  const hospital = booking?.hospitalLocation;
  const mapCenter = driverLocation || patient || hospital;

  // Switch to hospital route when at patient
  useEffect(() => {
    if (routePhase === "toPatient" && driverLocation && patient) {
      const dist = getDistance(driverLocation.lat, driverLocation.lng, patient.lat, patient.lng);
      if (dist < 10) {
        setRoutePhase("toHospital");
      }
    }
  }, [driverLocation, patient, routePhase]);

  return (
    <div className="h-screen w-full">
      {etaText && (
        <div className={`absolute font-semibold top-4 left-17 text-white text-sm px-3 py-1 rounded-full shadow-lg z-[2000] ${etaColor}`}>
          {etaText}
        </div>
      )}

      {driverLocation && booking && (
        <MapContainer center={mapCenter} zoom={14} style={{ height: "60vh", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={ambulanceIcon} />
          <Marker position={[patient?.lat, patient?.lng]} icon={patientIcon} />
          <Marker position={[hospital?.lat, hospital?.lng]} icon={hospitalIcon} />

          <Routing
            ambulance={driverLocation}
            patient={patient}
            hospital={hospital}
            setEtaText={setEtaText}
            setEtaColor={setEtaColor}
            routePhase={routePhase}
          />
        </MapContainer>
      )}

      <div className="p-4 bg-white h-60 shadow-md ">
        <h2 className="text-lg font-bold mb-2">Booking Info</h2>
        <p><strong>Patient:</strong> {booking?.name}</p>
        <p><strong>Phone No:</strong> {booking?.phone}</p>
        <p><strong>Notes:</strong> {booking?.notes}</p>
        <p><strong>Hospital:</strong> {booking?.hospital}</p>

        <div className="mt-4 flex gap-2">
          <button
            className="bg-yellow-600 text-white px-4 py-2 rounded"
            onClick={() => update(ref(db, `drivers/${driverId}`), { status: "Arrived at Patient" })}
          >
            Arrived at Patient
          </button>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => update(ref(db, `drivers/${driverId}`), { status: "En Route to Hospital" })}
          >
            To Hospital
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded ml-auto"
            onClick={() => {
              if (driverLocation && hospital) {
                const url = `https://www.google.com/maps/dir/?api=1&origin=${driverLocation.lat},${driverLocation.lng}&destination=${hospital.lat},${hospital.lng}&travelmode=driving`;
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

export default DriverTrackingPage;
