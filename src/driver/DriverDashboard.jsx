// src/driver/DriverDashboard.jsx
import { Link } from "react-router-dom";
import { BsPerson } from "react-icons/bs";
import { IoLogOutOutline } from "react-icons/io5";
import { RxDashboard } from "react-icons/rx";
import { LuAlignLeft } from "react-icons/lu";
import { BiTask } from "react-icons/bi";
import React, { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth"
import { auth, db } from "../firebaseConfig";
import { ref, onValue, update, onDisconnect } from "firebase/database";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast"
import DriverLocationTracker from "./DriverLocationTracker";

const DriverDashboard = () => {
  const [driver, setDriver] = useState({});
  const navigate = useNavigate();
  const [bookingsCount, setBookingsCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

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
      await update(ref(db, `drivers/${driverId}`), { status: "Unavailable"});
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
    //Fetch driver data
    const driverRef = ref(db, `drivers/${uid}`);
    onValue(driverRef, (snap) => {
      if (snap.exists()) setDriver(snap.val());
    });

    //Fetch bookings count
    const bookingsRef = ref(db, `bookings`);
    onValue(bookingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const available = Object.values(data).filter(
          (b) => b.status === "pending"
        );
        const completed = Object.values(data).filter(
          (b) => b.driverId === uid && b.status === "completed"
        );
        setBookingsCount(available.length);
        setCompletedCount(completed.length);
      }
    });
  }, []);

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
              className="flex items-center px-6 py-3 m-1 bg-blue-600 text-white rounded transition"
            >
              <RxDashboard className="mr-3 text-2xl" /> Dashboard
            </Link>
            <Link
              to="/driver/bookings"
              className="flex items-center px-6 py-3 m-1 hover:text-blue-600 rounded transition"
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
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        </header>
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-400 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Hello, {driver.name}</h1>
            <p className="mt-1 text-lg">
              Welcome back! Let’s save some lives today.
            </p>
          </div>
        </div>

        {/* Cards Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Available Bookings */}
          <div className="bg-white rounded-xl p-6 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold text-gray-800">
              Available Bookings
            </h2>
            <p className="mt-3 text-3xl font-bold text-blue-600">
              {bookingsCount}
            </p>
            <button
              onClick={() => navigate("/driver/bookings")}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              View Bookings
            </button>
          </div>

          {/* Completed Bookings */}
          <div className="bg-white rounded-xl p-6 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold text-gray-800">
              Completed Trips
            </h2>
            <p className="mt-3 text-3xl font-bold text-green-600">
              {completedCount}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DriverDashboard;
