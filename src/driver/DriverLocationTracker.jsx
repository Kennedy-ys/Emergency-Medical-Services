import React, { useEffect, useState } from "react";
import { ref, set, get } from "firebase/database";
import { auth, db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

const DriverLocationTracker = () => {
  const [position, setPosition] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      navigate("/driver/login");
      return;
    }

    // Fetch the driver's active booking (if any)
    const driverRef = ref(db, `drivers/${uid}/activeBookingId`);
    get(driverRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          setBookingId(snapshot.val());
        }
      })
      .catch((err) => console.error("Error fetching active booking:", err));

    // Start tracking
    if (!navigator.geolocation) {
      setErrorMsg("Your browser does not support GPS tracking.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPosition(coords);

        const locationData = {
          ...coords,
          lastUpdated: new Date().toISOString(),
        };

        // Always update driver's location in profile
        set(ref(db, `drivers/${uid}/location`), locationData);

       
      },
      (err) => {
        console.error("Location error:", err);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMsg("GPS permission denied. Please enable it to continue.");
          setTimeout(() => navigate("/driver/dashboard"), 3000);
        } else {
          setErrorMsg("Unable to fetch location. Please check GPS settings.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [navigate, bookingId]);

  return (
    <div className="font-thin p-0 m-0">
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}
      {!errorMsg && !position && <p>Waiting for GPS...</p>}
    </div>
  );
};

export default DriverLocationTracker;
