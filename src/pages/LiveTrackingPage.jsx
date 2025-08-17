// src/pages/LiveTrackingPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue, update } from "firebase/database";
import { db } from "../firebaseConfig";
import ambulanceImg from "../assets/icons/ambulance-icon.png";
import hospitalImg from "../assets/icons/hospital-icon.png";
import patientImg from "../assets/icons/patient-icon.png";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  Popup
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import "leaflet-routing-machine";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

// --- Icons ---
const ambulanceIcon = L.icon({
  iconUrl: ambulanceImg,
  iconSize: [30, 30],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});
const hospitalIcon = L.icon({
  iconUrl: hospitalImg,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});
const patientIcon = L.icon({
  iconUrl: patientImg,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

// --- Routing Component ---
const Routing = ({ ambulance, patient, hospital, setEtaText, setEtaColor, routePhase }) => {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!ambulance || !patient || !hospital || !map) return;

    if (routingRef.current) {
      map.removeControl(routingRef.current);
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

      if (durationMin < 8) {
        setEtaColor("bg-red-500 animate-pulse");
      } else if (durationMin < 15) {
        setEtaColor("bg-yellow-600 animate-pulse");
      } else {
        setEtaColor("bg-green-500");
      }
    }).addTo(map);

    routingRef.current = control;

    return () => {
      if (routingRef.current) {
        map.removeControl(routingRef.current);
        routingRef.current = null;
      }
    };
  }, [ambulance, patient, hospital, routePhase, map, setEtaText, setEtaColor]);

  return null;
};

// --- Fit map to markers ---
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
}

// --- Main Page ---
const LiveTrackingPage = () => {
  const { bookingId } = useParams();
  const [driverId, setDriverId] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [patientLocation, setPatientLocation] = useState(null);
  const [bookingData, setBookingData] = useState(null);
  const [etaText, setEtaText] = useState("");
  const [etaColor, setEtaColor] = useState("bg-green-500");
  const [routePhase, setRoutePhase] = useState("toPatient");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [position, setPosition] = useState(null);
  const navigate = useNavigate();


  useEffect(() => {
    if (!navigator.geolocation) {
      toast.error("Your browser does not support GPS Tracking ❌ ");
    }
    const watchID = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { latitude, longitude } = pos.coords;
        setPosition({ 
          lat: latitude,
          lng: longitude
         });

          const locationData = coords;
          // always update user's location
          set(ref(db, `bookings/${bookingId}/location`), locationData);

      },
      (err) => {
        console.error("Location error:", err);
        toast.error("Unable to get your location, please check your GPS settings.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchID);
  }, [bookingId]);

  // --- Booking data ---
  useEffect(() => {
    const bookingRef = ref(db, `bookings/${bookingId}`);
    return onValue(bookingRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      setBookingData(data);

      if (data.location?.lat && data.location?.lng) {
        setPatientLocation({ lat: data.location.lat, lng: data.location.lng });
      }
      if (data.AssignedDriverId) {
        setDriverId(data.AssignedDriverId);
      }
    });
  }, [bookingId]);

  const handleCancelBooking = async () => {
    try {
      // Update booking status
      const bookingRef = ref(db, `bookings/${bookingId}`);
      await update(bookingRef, {
        status: "cancelled",
        cancellation: {
          by: "patient",
          timestamp: Date.now(),
          reason: "User cancelled from LiveTrackingPage",
        },
      });

      setShowCancelModal(false);
      navigate("/ambulance-booking");
      toast.success("Booking cancelled successfully ✅");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking ❌");
    }
  };

  // --- Driver info & location ---
  useEffect(() => {
    if (!driverId) return;

    const driverRef = ref(db, `drivers/${driverId}`);
    const unsubDriver = onValue(driverRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setDriverInfo(data);
    });

    const locationRef = ref(db, `drivers/${driverId}/location`);
    const unsubLocation = onValue(locationRef, (snapshot) => {
      const loc = snapshot.val();
      if (loc?.lat && loc?.lng) {
        setDriverLocation({ lat: loc.lat, lng: loc.lng });
      }
    });

    return () => {
      unsubDriver();
      unsubLocation();
    };
  }, [driverId]);

  const hospitalLocation = bookingData?.hospitalLocation
    ? { lat: bookingData.hospitalLocation.lat, lng: bookingData.hospitalLocation.lng }
    : null;

  const allPositions = [driverLocation, patientLocation, hospitalLocation].filter(Boolean);

  // --- Switch to hospital route when near patient ---
  useEffect(() => {
    if (routePhase === "toPatient" && driverLocation && patientLocation) {
      const dist = L.latLng(driverLocation).distanceTo(L.latLng(patientLocation));
      if (dist < 30) { // within 30m
        setRoutePhase("toHospital");
      }
    }
  }, [driverLocation, patientLocation, routePhase]);

  return (
    <div className="h-screen w-full relative">
      {etaText && (
        <div className={`absolute top-4 font-semibold left-17 text-white text-sm px-3 py-1 rounded-full shadow-lg z-[2000] ${etaColor}`}>
          {etaText}
        </div>
      )}

      {patientLocation && (
        <MapContainer center={[patientLocation.lat, patientLocation.lng]}  style={{ height: "60vh", width: "100%" }} zoom={14} className="z-0">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Patient marker */}
          <Marker position={[patientLocation.lat, patientLocation.lng]} icon={patientIcon}>
            <Popup>Patient Location</Popup>
          </Marker>

          {/* Driver marker */}
          {driverLocation && <Marker position={[driverLocation.lat, driverLocation.lng]} icon={ambulanceIcon} />}

          {/* Hospital marker */}
          {hospitalLocation && (
            <Marker position={[hospitalLocation.lat, hospitalLocation.lng]} icon={hospitalIcon}>
              <Popup>{bookingData?.hospitalLocation?.name || "Hospital"}</Popup>
            </Marker>
          )}

          <FitBounds positions={allPositions} />

          {/* Routing */}
          {driverLocation && patientLocation && hospitalLocation && (
            <Routing
              ambulance={driverLocation}
              patient={patientLocation}
              hospital={hospitalLocation}
              setEtaText={setEtaText}
              setEtaColor={setEtaColor}
              routePhase={routePhase}
            />
          )}
        </MapContainer>
      )}

      {/* Bottom Info */}
      <div className={`absolute h-60 w-full bg-white shadow-md p-4 z-10  ${etaColor}`}>
        {!driverId ? (
          <p className=" animate-pulse" >Waiting for Driver's Confirmation</p>
        ) : (
          <div>
            <h3 className="text-lg font-bold mb-2">Driver Info</h3>
            {driverInfo ? (
              <>
                <p><strong>Name:</strong> {driverInfo.name}</p>
                <p><strong>Ambulance No:</strong> {driverInfo.ambulanceNumber}</p>
                <p><strong>Phone N0:</strong> {driverInfo.phone}</p>
                
              </>
            ) : (
              <p className="animate-pulse">Loading driver details...</p>
            )}
          </div>
        )}
         {/* Cancel button */}
      <button
        onClick={() => setShowCancelModal(true)}
        className="mt-4 w-full rounded-xl bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Cancel Booking
      </button>

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800">
              Cancel Booking?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Are you sure you want to cancel this booking? The driver will be notified.
            </p>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
              >
                No, Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default LiveTrackingPage;
