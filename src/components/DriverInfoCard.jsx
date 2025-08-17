import React, { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { ref, onValue } from "firebase/database";

const DriverInfoCard = () => {
  const [driver, setDriver] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return; // not logged in yet

    const driverId = user.uid;
    const driverRef = ref(db, `drivers/${driverId}`);

    const unsubscribe = onValue(driverRef, (snapshot) => {
      if (snapshot.exists()) {
        setDriver(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, []);

  if (!driver) {
    return (
      <div className="p-4 bg-gray-100 rounded shadow">
        Loading driver info...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-white rounded shadow">
      <img
        src={driver.photoURL || "https://mtt-bucket-upload-new.s3.us-east-2.amazonaws.com/profile_photos/FE/25/2785723147_20250710023721.png"}
        alt="Driver"
        className="w-16 h-16 rounded-full object-cover"
      />
      <div className="flex-1">
        <h2 className="text-lg font-semibold">{driver.name || "Ambulance Driver"}</h2>
        <p className="text-sm text-gray-500">Serial No: {driver.ambulanceNumber || "N/A"}</p>
        <p className="text-sm text-gray-500">
          ETA: {driver.eta ? `${driver.eta} mins` : "Calculating..."}
        </p>
      </div>
      {driver.phone && (
        <a
          href={`tel:${driver.phone}`}
          aria-label={`Call ${driver.name || "Ambulance Driver"}`}
          className="bg-blue-500 text-white px-3 py-2 rounded shadow"
        >
          Call
        </a>
      )}
    </div>
  );
};

export default DriverInfoCard;
