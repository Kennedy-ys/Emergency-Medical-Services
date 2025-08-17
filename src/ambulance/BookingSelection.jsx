// import React, { useEffect, useState, useRef } from "react";
// import { db } from "../firebaseConfig";
// import { ref, onValue, get, update } from "firebase/database";
// import { useNavigate } from "react-router-dom";
// import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
// // import { useAmbulanceProfile } from "../hooks/useAmbulanceProfile";
// import toast from "react-hot-toast";
// import AmbulanceTracker from "./AmbulanceTracker";

// const AmbulanceBookingSelection = () => {
//   const [sidebarOpen, setSidebarOpen] = useState(false);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const dropdownRef = useRef();
//   const [bookings, setBookings] = useState([]);
//   const [ambulanceId, setAmbulanceId] = useState(null);
//   const navigate = useNavigate();
//   const auth = getAuth();
//   const [user, setUser] = useState(auth.currentUser);
//   const { profile, loading, error } = useAmbulanceProfile(user?.uid);

//   // 🚪 Logout handler
//   const handleLogout = () => {
//     const auth = getAuth();
//     signOut(auth)
//       .then(() => {
//         navigate("/ambulance/login");
//         toast.success("Logged out successfully!");
//       })
//       .catch(() => toast.error("Logout failed. Please try again."));
//   };

//   const handleProfileClick = () => {
//     // Replace 'ambulance-001' with actual ID if dynamic
//     navigate("/profile/ambulance-001");
//   };

//   // 📡 Dropdown close on outside click
//   useEffect(() => {
//     const handleClickOutside = (e) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
//         setDropdownOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // 📥 Get available bookings for this ambulance
//   useEffect(() => {
//     if (!profile?.id) return;
//     const bookingsRef = ref(db, "bookings");

//     const unsubscribe = onValue(bookingsRef, (snapshot) => {
//       const data = snapshot.val();
//       const filtered = [];

//       for (let key in data) {
//         const booking = data[key];
//         if (
//           booking.status === "pending" &&
//           (!booking.ambulanceId || booking.ambulanceId === profile.id)
//         ) {
//           filtered.push({ id: key, ...booking });
//         }
//       }

//       setBookings(filtered);
//     });

//     return () => unsubscribe();
//   }, [ambulanceId]);

//   // ✅ Accept a booking
//   const acceptBooking = async (bookingId) => {
//     if (!profile?.id) return toast.error("Ambulance ID not set yet!");
//     try {
//       const bookingRef = ref(db, `bookings/${bookingId}`);
//       await update(bookingRef, {
//         ambulanceId: profile.id,
//         status: "accepted",
//         acceptedAt: new Date().toISOString(),
//       });
//       toast.success("Booking accepted!");
//       navigate(`/ambulance/track/${bookingId}`);
//     } catch (err) {
//       console.error("Booking accept error:", err);
//       toast.error("Failed to accept booking.");
//     }
//   };

//   // ⏳ Loading indicator
//   if (loading) {
//     return (
//       <div className="flex items-center justify-center h-screen text-lg">
//         Loading ambulance data...
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-max bg-gray-100">
//       {/* Sidebar */}
//       {sidebarOpen && (
//         <div className="w-64 bg-white h-screen fixed left-0 top-0 z-20 shadow-lg rounded-tr-xl rounded-br-xl p-7">
//           <h2 className="text-2xl font-bold text-center text-blue-600 mb-4">
//             EMS Connect
//           </h2>
//           <nav className="space-y-4">
//             <a
//               className="pl-7 block text-gray-700 hover:text-blue-600"
//               onClick={() => navigate("/ambulance/dashboard")}
//             >
//               Dashboard
//             </a>
//             <a
//               className="pl-7 block font-medium text-blue-600"
//               onClick={() => navigate("/ambulance/bookings")}
//             >
//               Bookings
//             </a>
//             <a
//               className="pl-7 block text-gray-700 hover:text-blue-600"
//               onClick={() => navigate("/ambulance/profile")}
//             >
//               Profile
//             </a>
//           </nav>
//         </div>
//       )}

//       {/* Main Content */}
//       <div className={`flex flex-col flex-grow ${sidebarOpen ? "ml-64" : ""}`}>
//         {/* Topbar */}
//         <div className="w-full bg-[#2c2f48] text-white flex justify-between items-center px-4 py-3 shadow-md">
//           <div className="flex items-center gap-4">
//             <button onClick={() => setSidebarOpen(!sidebarOpen)}>
//               <svg
//                 className="w-6 h-6"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   d="M4 6h16M4 12h16M4 18h16"
//                 />
//               </svg>
//             </button>
//             <span className="text-xl font-bold">DRIVER DASHBOARD</span>
//           </div>

//           {/* Right-side user dropdown */}
//           <div className="flex items-center gap-6 relative">
//             <div className="relative">
//               <svg
//                 className="w-6 h-6"
//                 fill="none"
//                 stroke="currentColor"
//                 strokeWidth="2"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C8.67 6.165 8 7.388 8 9v5.159c0 .538-.214 1.055-.595 1.436L6 17h5m4 0v1a3 3 0 11-6 0v-1m6 0H9"
//                 />
//               </svg>
//               <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1.5">
//                 05
//               </span>
//             </div>

//             <div className="relative" ref={dropdownRef}>
//               <div
//                 onClick={() => setDropdownOpen(!dropdownOpen)}
//                 className="flex items-center gap-2 cursor-pointer"
//               >
//                 {user?.photoURL ? (
//                   <img
//                     src={user.photoURL}
//                     className="w-8 h-8 rounded-full"
//                     alt="avatar"
//                   />
//                 ) : (
//                   <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-semibold uppercase">
//                     {(user?.displayName?.charAt(0) || user?.email?.charAt(0)) ??
//                       "U"}
//                   </div>
//                 )}
//                 <span className="hidden sm:block">
//                   {user?.displayName || user?.email?.split("@")[0]}
//                 </span>
//               </div>

//               {dropdownOpen && (
//                 <div className="absolute right-0 mt-2 w-40 bg-white text-black rounded shadow-lg z-10">
//                   <ul className="py-2">
//                     <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
//                       <button onClick={handleProfileClick}>Profile</button>
//                     </li>
//                     <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
//                       <button onClick={handleLogout}>Logout</button>
//                     </li>
//                   </ul>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Page Content */}
//         <div className="p-4">
//           <h2 className="text-xl font-bold mb-4">📋 Available Bookings</h2>
//           <AmbulanceTracker />

//           {bookings.length === 0 ? (
//             <p className="text-gray-500">No pending bookings right now.</p>
//           ) : (
//             <div className="grid gap-4">
//               {bookings.map((booking) => (
//                 <div key={booking.id} className="p-4 bg-white rounded shadow">
//                   <p>
//                     <strong>Patient:</strong> {booking.name}
//                   </p>
//                   <p>
//                     <strong>Phone:</strong> {booking.phone}
//                   </p>
//                   <p>
//                     <strong>Pickup:</strong> {booking.location.lat},{" "}
//                     {booking.location.lng}
//                   </p>
//                   <p>
//                     <strong>Hospital:</strong> {booking.hospital}
//                   </p>
//                   <p className="text-sm text-gray-400">
//                     {new Date(booking.timestamp).toISOString()}
//                   </p>
//                   <button
//                     onClick={() => acceptBooking(booking.id)}
//                     className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
//                   >
//                     ✅ Accept Booking
//                   </button>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AmbulanceBookingSelection;



import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import toast from "react-hot-toast";
import AmbulanceTracker from "./AmbulanceTracker";

const AmbulanceBookingSelection = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [ambulanceId, setAmbulanceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

    useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            setUser(currentUser);
        } else {
            navigate("/ambulance/login");
        }
    });
    return () => unsubscribe();
    }, [navigate]);

    const handleLogout = () => {
    const auth = getAuth();
    signOut(auth)
        .then(() => {
        navigate("/ambulance/login");
        toast.success("Logged out successfully!");
        })
        .catch((error) => {
        toast.error("Logout failed. Please try again.");
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

  // Fetch current ambulance ID from user claims or fallback
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    if (user) {
      // Ideally, your backend sets this in a custom claim
      user.getIdTokenResult().then((idTokenResult) => {
        const ambId = idTokenResult.claims.ambulanceId || "ambulance-001"; // fallback
        setAmbulanceId(ambId);
      });
    }
  }, []);

  // Fetch pending bookings
  useEffect(() => {
    const bookingsRef = ref(db, "bookings");

    const unsubscribe = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      const filtered = [];

      for (let key in data) {
        const booking = data[key];
        if (
          booking.status === "pending" &&
          (!booking.ambulanceId || booking.ambulanceId === ambulanceId)
        ) {
          filtered.push({ id: key, ...booking });
        }
      }

      setBookings(filtered);
    });

    return () => unsubscribe();
  }, [ambulanceId]);

  const acceptBooking = async (bookingId) => {
    if (!ambulanceId) return toast.error("Ambulance ID not set yet!")
    try {
      const bookingRef = ref(db, `bookings/${bookingId}`);
      await update(bookingRef, {
        ambulanceId: ambulanceId,
        status: "accepted",
        acceptedAt: new Date().toISOString(),
      });
      toast.success("Booking accepted!");
      navigate(`/ambulance/track/${bookingId}`);
    } catch (error) {
      console.error("Error accepting booking:", error);
      toast.error("Failed to accept booking.");
    }
  };

  return (
    <div className="flex h-max bg-gray-100">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 bg-white h-screen fixed left-0 top-0 z-20 shadow-lg rounded-tr-xl rounded-br-xl p-7">
          <h2 className="text-2xl font-bold text-center text-blue-600 mb-4">EMS Connect</h2>
          <nav className="space-y-4">
            <a
              href="/ambulance/dashboard"
              className="pl-7 block text-gray-700 hover:text-blue-600 hover:font-semibold"
                onClick={() => navigate("/ambulance/dashboard")}
            >
              Dashboard
            </a>
            <a
              href="/ambulance/bookings"
              className="pl-7 block  font-medium text-blue-600"
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

        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">📋 Available Bookings</h2>

        <AmbulanceTracker />


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
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    ✅ Accept Booking
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AmbulanceBookingSelection;
