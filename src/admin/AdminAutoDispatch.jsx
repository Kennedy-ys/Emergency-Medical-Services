import { ref, onValue, update, get } from "firebase/database";
import { db } from "../firebaseConfig";
import React, { useEffect, useState} from "react";
import toast from "react-hot-toast";

// Haversine formula to get distance between 2 coords
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function AdminAutoDispatch() {
  useEffect(() => {
    const bookingsRef = ref(db, "bookings");
    const unsubscribe = onValue(bookingsRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const bookings = snapshot.val();

      for (const bookingId in bookings) {
        const booking = bookings[bookingId];

        // Only auto-assign pending bookings
        if (booking.status === "pending") {
          const driversRef = ref(db, "drivers");
          const driversSnap = await get(driversRef);

          if (!driversSnap.exists()) return;

          const drivers = driversSnap.val();
          let closestDriver = null;
          let minDistance = Infinity;

          Object.entries(drivers).forEach(([driverId, driver]) => {
            if (driver.status === "available") {
              const dist = getDistance(
                booking.location.lat,
                booking.location.lng,
                driver.location.lat,
                driver.location.lng
              );
              if (dist < minDistance) {
                minDistance = dist;
                closestDriver = { driverId, ...driver };
              }
            }
          });

          if (closestDriver) {
            // Assign booking to closest driver
            await update(ref(db, `bookings/${bookingId}`), {
              AssignedDriverId: closestDriver.driverId,
              status: "assigned"
            });

            // Mark driver as busy
            await update(ref(db, `drivers/${closestDriver.driverId}`), {
              status: "busy"
            });

            toast.success(
              `Booking ${bookingId} auto-assigned to ${closestDriver.name}`);

            console.log(
              `Booking ${bookingId} auto-assigned to ${closestDriver.name}`
            );
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return null; // This component runs silently in the background
}

export default AdminAutoDispatch;
