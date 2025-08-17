// src/driver/DriverBookings.jsx
import { Link } from "react-router-dom";
import { BsPerson } from "react-icons/bs";
import { IoLogOutOutline } from "react-icons/io5";
import { RxDashboard } from "react-icons/rx";
import { LuAlignLeft } from "react-icons/lu";
import { BiTask } from "react-icons/bi";
import React, { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { ref, onValue, update, onDisconnect } from "firebase/database";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DriverLocationTracker from "./DriverLocationTracker";

const DriverBookings = () => {
  const [driver, setDriver] = useState({});
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [driverId, setdriverId] = useState(null);

  useEffect(() => {
    const userCred = auth.currentUser;
    if (!userCred) return;

    const driverId = userCred.uid;
    const connectionRef = ref(db, `drivers/${driverId}/connectionState`);
    const lastSeenRef = ref(db, `drivers/${driverId}/lastSeen`);

    // Set to online when connected
    update(ref(db, `drivers/${driverId}`), { connectionState: "Online" });

    // On disconnect → offline & set last seen
    onDisconnect(connectionRef).set("Offline");
    onDisconnect(lastSeenRef).set(new Date().toISOString());
  }, []);

  const handleLogout = async () => {
    console.log("Attempting Logout");
    const auth = getAuth();
    const userCred = auth.currentUser;
    const driverId = userCred?.uid;

    //update driver status to offline
    if (driverId) {
      await update(ref(db, `drivers/${driverId}`), { status: "Unavailable" });
    }

    await signOut(auth)
      .then(() => {
        navigate("/driver/login");
        toast.success("Logged out successfully!");
      })
      .catch((error) => {
        toast.error("Logout failed. Please try again.");
        console.log("logout error: ", error);
      });
  };

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      navigate("/driver/login");
      return;
    }
    setdriverId(uid);

    //Fetch driver data
    const driverRef = ref(db, `drivers/${uid}`);
    onValue(driverRef, (snap) => {
      if (snap.exists()) setDriver(snap.val());
    });
  }, []);

  //Fetch bookings
  useEffect(() => {
    const driverBookingsRef = ref(db, `bookings`);
    let previousBookingIds = [];

    const unsubscribe = onValue(driverBookingsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setBookings([]);
        previousBookingIds = [];
        return;
      }
      const data = snapshot.val();
      const assigned = Object.entries(data)
        .filter(([__, booking]) => booking.status === "pending")
        .map(([id, booking]) => ({ id, ...booking }));

      // Detect new assigned bookings
      const currentBookingIds = assigned.map((b) => b.id);
      const newBookingIds = currentBookingIds.filter(
        (id) => !previousBookingIds.includes(id)
      );
      if (newBookingIds.length > 0) {
        playNotification();
      }
      previousBookingIds = currentBookingIds;

      setBookings(assigned);
    });

    return () => unsubscribe();
  }, [driverId]);

  const playNotification = () => {
    const audio = new Audio("../assets/sounds/notification.mp3");
    audio.play();
    document.body.classList.add("flash-animation");
    setTimeout(() => {
      document.body.classList.remove("flash-animation");
    }, 2000);
  };

  const acceptBooking = async (bookingId) => {
    if (!driverId) return toast.error("Drivers ID not set yet!");
    try {
      // Update the booking itself
      const bookingRef = ref(db, `bookings/${bookingId}`);
      await update(bookingRef, {
        AssignedDriverId: driverId,
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });

      // Save the active booking ID under the driver profile
      const driverActiveRef = ref(db, `drivers/${driverId}`);
      await update(driverActiveRef, {
        currentBookingId: bookingId,
        status: "busy",
      });

      toast.success("Booking accepted!");
      navigate(`/driver/track/${bookingId}`);
    } catch (error) {
      console.error("Error accepting booking:", error);
      toast.error("Failed to accept booking.");
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      const bookingRef = ref(db, `bookings/${bookingId}`);
      await update(bookingRef, {
        AssignedDriverId: null,
        status: "pending",
      });

      // Clear active booking from driver profile
      const driverActiveRef = ref(db, `drivers/${driverId}`);
      await update(driverActiveRef, {
        currentBookingId: null,
      });

      toast.success("Booking cancelled successfully!");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking.");
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white font-medium text-blue-950 flex flex-col justify-between rounded-tr-xl rounded-br-xl">
        <div>
          <div className="px-6 py-3 text-2xl text font-bold border-b border-blue-200">
            EMS Connect
          </div>
          <nav className="mt-6 space-y-2">
            <Link
              to="/driver/dashboard"
              className="flex items-center px-6 py-3 m-1 hover:text-blue-600 rounded transition"
            >
              <RxDashboard className="mr-3 text-2xl" /> Dashboard
            </Link>
            <Link
              to="/driver/bookings"
              className="flex items-center px-6 py-3 m-1 bg-blue-600 text-white rounded transition"
            >
              <BiTask className="mr-3 text-2xl" /> Bookings
            </Link>
            <Link
              to="/driver/profile"
              className="flex items-center px-6 py-3  m-1 hover:text-blue-600 rounded transition"
            >
              <BsPerson className="mr-3 text-2xl" /> Profile
            </Link>
            <Link
              onClick={handleLogout}
              to="/driver/login"
              className="flex items-center px-6 py-3 m-1 hover:text-blue-600 rounded transition"
            >
              <IoLogOutOutline className="mr-3 text-2xl" /> Logout
            </Link>
          </nav>
        </div>
        <div className="px-6 py-3  border-t border-blue-100 text-sm opacity-75">
          EMS Connect • Driver Panel
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
         <DriverLocationTracker />
        {/*Header*/}
        <header className="mb-6 flex items-center">
          <LuAlignLeft className="mr-5 text-3xl text-gray-800 cursor-pointer" />
          <h1 className="text-3xl font-bold text-gray-800">Bookings</h1>
        </header>

        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Available Bookings</h2>

          {bookings.length === 0 ? (
            <p className="text-gray-500">No pending bookings right now.</p>
          ) : (
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 bg-white rounded shadow">
                  <p>
                    <strong>Patient:</strong> {booking.name}
                  </p>
                  <p>
                    <strong>Phone:</strong> {booking.phone}
                  </p>
                  <p>
                    <strong>Pickup:</strong> {booking.location.lat},{" "}
                    {booking.location.lng}
                  </p>
                  <p>
                    <strong>Hospital:</strong> {booking.hospital}
                  </p>
                  <p className="text-sm text-gray-400">
                    {new Date(booking.timestamp).toLocaleString()}
                  </p>
                  <button
                    onClick={() => acceptBooking(booking.id)}
                    className="mt-3 mr-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => cancelBooking(booking.id)}
                    className="mt-3  px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DriverBookings;
