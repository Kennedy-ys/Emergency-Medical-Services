import React, { useEffect, useState } from "react";
import { ref, set } from "firebase/database";
import { db } from "../firebaseConfig";

const AmbulanceLocationUpdater = ({ bookingId }) => {
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    if (!bookingId) {
      setStatus("No booking ID provided");
      return;
    }

    let intervalId;

    const updateLocation = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;

            const locationRef = ref(db, `ambulanceLocations/${bookingId}`);
            set(locationRef, {
              lat: latitude,
              lng: longitude,
              updatedAt: Date.now(),
            });

            setStatus(`Updated: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          },
          (error) => {
            console.error("Error getting location:", error);
            setStatus("Failed to get location");
          }
        );
      } else {
        setStatus("Geolocation not supported");
      }
    };

    updateLocation(); // run immediately
    intervalId = setInterval(updateLocation, 5000); // every 5 seconds

    return () => clearInterval(intervalId);
  }, [bookingId]);

  return (
    <div className="bg-blue-100 text-blue-800 text-sm p-2 rounded shadow max-w-sm mx-auto mt-4 text-center">
      Ambulance Tracker: {status}
    </div>
  );
};

export default AmbulanceLocationUpdater;
