// src/pages/LocateHospitals.jsx
import React, { useEffect, useState } from "react";
import { MapPin, ArrowRight, User } from "react-feather";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { ref, onValue } from "firebase/database";
import { db } from "../firebaseConfig";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icon issues in React/Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom blue icon for user
const userIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
  className: "user-marker",
});

// Haversine formula to calc distance between coords (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

const LocateHospitals = () => {
  const [hospitals, setHospitals] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Load hospitals from Firebase
  useEffect(() => {
    const hospitalsRef = ref(db, "hospitals");
    const unsubscribe = onValue(hospitalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setHospitals(list);
      }
    });
    return () => unsubscribe();
  }, []);

  //Search hospitals by name
  const filteredHospitals = hospitals.filter((hospital) =>
    hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) || (hospital.type && hospital.type.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.error("Geolocation error:", err);
        }
      );
    }
  }, []);

  // Add distances if we have user location
  const hospitalsWithDistance = hospitals
    .map((h) => {
      if (userLocation && h.lat && h.lng) {
        return {
          ...h,
          distance: calculateDistance(
            userLocation.lat,
            userLocation.lng,
            h.lat,
            h.lng
          ),
        };
      }
      return h;
    })
    .sort((a, b) => (a.distance || 9999) - (b.distance || 9999));

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4 text-center">
        Locate Nearby Hospitals
      </h2>

       {/* Search Bar */}
        <input
          type="text"
          placeholder="Search hospitals..."
          className="w-full p-2 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

      {/* Big Map with User + Hospitals */}
      <div className="h-80 w-full rounded-lg overflow-hidden mb-6">
        <MapContainer
          center={
            userLocation
              ? [userLocation.lat, userLocation.lng]
              : [6.5244, 3.3792] // fallback: Lagos
          }
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}
          {hospitalsWithDistance.map(
            (h) =>
              h.lat &&
              h.lng && (
                <Marker key={h.id} position={[h.lat, h.lng]}>
                  <Popup>{h.name}</Popup>
                </Marker>
              )
          )}
        </MapContainer>
      </div>

      {/* Hospital List */}
      <div className="flex flex-col gap-6">
        {hospitalsWithDistance.map((hospital) => (
          <div
            key={hospital.id}
            className="bg-white rounded-xl shadow-md p-4 border border-gray-100"
          >
            <div className="mb-3">
              <h3 className="text-lg font-semibold">{hospital.name}</h3>
              <p className="text-sm text-gray-600">{hospital.address}</p>
              {hospital.distance && (
                <div className="flex items-center text-gray-500 text-sm mt-1">
                  <MapPin size={16} className="mr-1" />
                  {hospital.distance} km away
                </div>
              )}
            </div>

            <button
              className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm transition"
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`,
                  "_blank"
                )
              }
            >
              Get Directions <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocateHospitals;
