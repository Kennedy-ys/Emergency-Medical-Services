import React, { useEffect, useState } from "react";
import { ref, set } from "firebase/database";
import { db } from "../firebaseConfig";
import { onAuthStateChanged, getAuth } from "firebase/auth";

const AmbulanceTracker = () => {
  const [position, setPosition] = useState(null);
  const [ambulanceId, setAmbulanceId] = useState("ambulance-001"); // You can set dynamically later

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // You could fetch ambulance ID from Firestore if stored with user info
        console.log("Ambulance user logged in:", user.email);
      }
    });

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPosition(coords);

        if (ambulanceId) {
          const ambRef = ref(db, `ambulances/${ambulanceId}/location`);
          set(ambRef, {
            ...coords,
            lastUpdated: new Date().toISOString(),
          });
        }

      },
      (err) => {
        console.error("Location error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ambulanceId]);// Adjust dependency if ambulanceId changes dynamically

  return (
    <div className="p-4 text-green-600 font-semibold">
      {position ? (
        <p>Tracking active 🚑 at Lat: {position.lat}, Lng: {position.lng}</p>
      ) : (
        <p>Waiting for GPS...</p>
      )}
    </div>
  );
};

export default AmbulanceTracker;
