// src/driver/DriverProfile.jsx
import { Link } from "react-router-dom";
import { BsPerson } from "react-icons/bs";
import { IoLogOutOutline } from "react-icons/io5";
import { RxDashboard } from "react-icons/rx";
import { LuAlignLeft } from "react-icons/lu";
import { BiTask } from "react-icons/bi";
import React, { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import toast from "react-hot-toast";
import { auth, db } from "../firebaseConfig";
import { ref, onValue } from "firebase/database";
import { useNavigate } from "react-router-dom";
import DriverLocationTracker from "./DriverLocationTracker";

const DriverProfile = () => {
  const [driver, setDriver] = useState({});
  const navigate = useNavigate();

  const handleLogout = () => {
    console.log("Attempting Logout");
    const auth = getAuth();
    signOut(auth)
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
              className="flex items-center px-6 py-3 m-1 hover:text-blue-600 rounded transition"
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
              className="flex items-center px-6 py-3 m-1 bg-blue-600 text-white rounded transition
              "
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
          <h1 className="text-3xl font-bold text-gray-800">Profile</h1>
        </header>
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-400 text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Hello, {driver.name}</h1>
            <p className="mt-1 text-lg">
              Ambulance ID: {driver.ambulanceNumber}
            </p>
          </div>
          <img
            src="https://mtt-bucket-upload-new.s3.us-east-2.amazonaws.com/profile_photos/FE/25/2785723147_20250710023721.png"
            alt="Driver"
            className="w-30 h-30 object-cover rounded-full border-4 border-white shadow-lg"
          />
        </div>
      </main>
    </div>
  );
};

export default DriverProfile;
