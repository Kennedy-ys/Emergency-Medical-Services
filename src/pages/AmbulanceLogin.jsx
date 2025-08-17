// import React, { useState } from "react";
// import { getDatabase, ref, get, set } from "firebase/database";
// import { signInWithEmailAndPassword } from "firebase/auth";
// import { auth } from "../firebaseConfig";
// import { useNavigate } from "react-router-dom";

// const AmbulanceLogin = () => {
//   const navigate = useNavigate();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");

//   const handleLogin = async (e) => {
//   e.preventDefault();
//   setError("");
//   try {
//     const userCredential = await signInWithEmailAndPassword(auth, email, password);
//     const { uid } = userCredential.user;

//     const db = getDatabase();
//     const ambulanceRef = ref(db, `ambulances/${uid}`);

//     const snapshot = await get(ambulanceRef);

//     if (!snapshot.exists()) {
//       // Create new ambulance record with default fields
//       await set(ambulanceRef, {
//         id: uid,
//         status: "available",
//         assignedBookingId: null,
//         location: { lat: null, lng: null },
//         lastActive: new Date().toISOString(),
//       });
//       console.log("🚑 New ambulance record created.");
//     } else {
//       console.log("🚑 Ambulance record exists.");
//     }

//     navigate("/ambulance/dashboard");
//   } catch (err) {
//     setError("Invalid credentials or network error.");
//     console.error(err.message);
//   }
// };


//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-150 via-blue-90 to-blue-50 flex items-center justify-center p-4">
//       <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
//         <h2 className="text-3xl font-bold text-center mb-6 text-blue-700">
//           Ambulance Login
//         </h2>
//         {error && (
//           <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">
//             {error}
//           </div>
//         )}
//         <form onSubmit={handleLogin} className="space-y-4">
//           <input
//             type="email"
//             placeholder="Email address"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//             className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
//           />
//           <input
//             type="password"
//             placeholder="Password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//             className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
//           />
//           <button
//             type="submit"
//             className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 rounded-lg transition duration-200"
//           >
//             Log In
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// };

// export default AmbulanceLogin;



import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { registerDriver, fetchAmbulanceIdForUser } from '../utils/dbHelpers';
import { useNavigate } from 'react-router-dom';

const AmbulanceLogin = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const auth = getAuth();
  const navigate = useNavigate();

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleLogin = async () => {
    setError('');
    setSuccessMessage('');
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Invalid email format.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const uid = user.uid; 
      console.log("🚑 User logged in:", user);
      const ambulanceId = await fetchAmbulanceIdForUser(uid);
      console.log(" ambulanceId: ", ambulanceId);

      if (ambulanceId) {
        localStorage.setItem('ambulanceId', ambulanceId);
      }
      setSuccessMessage('Logged in successfully!');
      setTimeout(() => {
        navigate("/ambulance/dashboard");
      }, 1500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setSuccessMessage('');
    if (!email || !password || !name || !phone) {
      setError('Please fill in all fields.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Invalid email format.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const driverData = {
        driverName: name,
        driverPhone: phone,
        driverPhoto: '',
        uid,
        location: { lat: 0, lng: 0 },
      };
      await registerDriver(driverData);
      setSuccessMessage('Registration successful! Redirecting...');
      
      // Reset form
      setEmail('');
      setPassword('');
      setName('');
      setPhone('');
      
      setTimeout(() => {
        setIsRegistering(false);
        setSuccessMessage('');
        navigate("/ambulance/dashboard");
      }, 1500);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto my-12 p-6 bg-white rounded shadow-lg">
      {isRegistering ? (
        <div>
          <h2 className="text-2xl font-semibold text-center mb-4">Driver Registration</h2>
          {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}
          {successMessage && <div className="text-green-600 mb-2 text-sm">{successMessage}</div>}
          <input
            className="w-full p-3 mb-3 border border-gray-300 rounded text-lg"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <input
            className="w-full p-3 mb-3 border border-gray-300 rounded text-lg"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <input
            className="w-full p-3 mb-3 border border-gray-300 rounded text-lg"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
          <input
            className="w-full p-3 mb-4 border border-gray-300 rounded text-lg"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded text-lg disabled:opacity-50"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
          <p className="text-center mt-4 text-sm">
            Already have an account?{' '}
            <button
              className="underline text-blue-600 hover:text-blue-800"
              onClick={() => { setIsRegistering(false); setError(''); setSuccessMessage(''); }}
            >
              Login
            </button>
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-semibold text-center mb-4">Driver Login</h2>
          {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}
          {successMessage && <div className="text-green-600 mb-2 text-sm">{successMessage}</div>}
          <input
            className="w-full p-3 mb-3 border border-gray-300 rounded text-lg"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <input
            className="w-full p-3 mb-4 border border-gray-300 rounded text-lg"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded text-lg disabled:opacity-50"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <p className="text-center mt-4 text-sm">
            Don't have an account?{' '}
            <button
              className="underline text-blue-600 hover:text-blue-800"
              onClick={() => { setIsRegistering(true); setError(''); setSuccessMessage(''); }}
            >
              Sign up
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

export default AmbulanceLogin;