import React, { useEffect, useState } from "react";
import { ref, set } from "firebase/database";
import { db } from "../firebaseConfig";

const MockAmbulanceUpdater = ({ ambulanceId = "ambulance-001" }) => {
  const [coords, setCoords] = useState({ lat: 4.951, lng: 8.325 });

  useEffect(() => {
    const interval = setInterval(() => {
      const newLat = coords.lat + (Math.random() - 0.5) * 0.0002;
      const newLng = coords.lng + (Math.random() - 0.5) * 0.0002;
      const updatedCoords = { lat: newLat, lng: newLng };

      setCoords(updatedCoords);

      // Update Firebase location
      const locationRef = ref(db, `ambulances/${ambulanceId}/location`);
      set(locationRef, updatedCoords);
    }, 3000);

    return () => clearInterval(interval);
  }, [coords.lat, coords.lng]);

  return (
    <div className="p-4 bg-gray-200 text-sm rounded">
      🚑 Mocking location for <strong>{ambulanceId}</strong><br />
      Current: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
    </div>
  );
};

export default MockAmbulanceUpdater;
