import React, { useState, useRef, useEffect } from "react";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AmbulanceTracker from "./AmbulanceTracker";

const AmbulanceLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef();
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/ambulance/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = () => {
    console.log("Attempting Logout");
    const auth = getAuth();
    signOut(auth)
      .then(() => {
        console.log("logged out successfully");
        navigate("/ambulance/login");
        toast.success("Logged out successfully!");
      })
      .catch((error) => {
        toast.error("Logout failed. Please try again.");
        console.log("logout error: ", error);
      });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 bg-white h-screen fixed left-0 top-0 z-20 shadow-lg rounded-tr-3xl rounded-br-3xl p-7">
          <h2 className="text-2xl font-bold text-center text-blue-600 mb-4">EMS Connect</h2>
          <nav className="space-y-4">
            <a
              href="/ambulance/dashboard"
              className="pl-7 block text-blue-600 font-semibold"
              onClick={() => navigate("/ambulance/dashboard")}
            >
              Dashboard
            </a>
            <a
              href="/ambulance/bookings"
              className="pl-7 block text-gray-700 hover:text-blue-600 hover:font-semibold"
              onClick={() => navigate("/ambulance/bookings")}
            >
              Bookings
            </a>
            <a
              href="/ambulance/profile"
              className="pl-7 block text-gray-700 hover:text-blue-600 hover:font-semibold"
              onClick={() => navigate("/ambulance/profile")}
            >
              Profile
            </a>
          </nav>
        </div>
      )}
      {/* Main Content */}
      <div className={`flex flex-col flex-grow ${sidebarOpen ? "ml-64" : ""}`}>
        {/* Topbar */}
        <div className="rounded-tl-sm rounded-bl-sm w-full bg-[#2c2f48] text-white flex justify-between items-center px-4 py-3 shadow-md">
          {/* Left: Toggle + Label */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className=" text-white focus:outline-none cursor-w-resize rtl:cursor-e-resize"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-xl font-bold">ADMIN</span>
          </div>

          {/* Right: Bell + Avatar */}
          <div className="flex items-center gap-6 relative">
            {/* Bell */}
            <div className="relative">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C8.67 6.165 8 7.388 8 9v5.159c0 .538-.214 1.055-.595 1.436L6 17h5m4 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5">
                99
              </span>
            </div>

            {/* Avatar */}
            <div className="relative" ref={dropdownRef}>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="User Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-semibold uppercase">
                    {(user?.displayName?.charAt(0) || user?.email?.charAt(0)) ??
                      "U"}
                  </div>
                )}
                <span className="hidden sm:block">
                  {user?.displayName || user?.email?.split("@")[0]}
                </span>
              </div>

              {/* Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white text-black rounded shadow-lg z-10 transition-opacity duration-200">
                  <ul className="py-2">
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                      Profile
                    </li>
                    <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                      <button onClick={handleLogout}>Logout</button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="p-4 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-4">Ambulance Dashboard</h1>
          <AmbulanceTracker />
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className="text-3xl text-blue-600">
                <i className="fas fa-ambulance" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Total Bookings</p>
                <p className="text-xl font-bold">45</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className="text-3xl text-green-600">
                <i className="fas fa-check-circle" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Completed Trips</p>
                <p className="text-xl font-bold">33</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow p-5 flex items-center gap-4">
              <div className="text-3xl text-yellow-600">
                <i className="fas fa-route" />
              </div>
              <div>
                <p className="text-gray-500 text-sm">Active Trips</p>
                <p className="text-xl font-bold">12</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbulanceLayout;
