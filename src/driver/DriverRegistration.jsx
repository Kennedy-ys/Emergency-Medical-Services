// src/pages/driver/DriverRegistration.jsx
import React, { useState } from "react";
import { auth, db } from "../firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set } from "firebase/database";
import { useNavigate } from "react-router-dom";

export default function DriverRegistration() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    ambulanceNumber: "",
    licensePlate: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      await updateProfile(userCredential.user, {
        displayName: formData.name,
      });

      await set(ref(db, `drivers/${userCredential.user.uid}`), {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        ambulanceNumber: formData.ambulanceNumber,
        licensePlate: formData.licensePlate,
        role: "driver",
        status: "offline",
        createdAt: new Date().toISOString(),
      });

      setLoading(false);
      navigate("/driver/login");
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          Ambulance Driver Registration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300"
          />
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300"
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300"
          />
          <input
            type="text"
            name="ambulanceNumber"
            placeholder="Ambulance Number"
            value={formData.ambulanceNumber}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300"
          />
          <input
            type="text"
            name="licensePlate"
            placeholder="License Plate"
            value={formData.licensePlate}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border rounded-lg focus:ring focus:ring-blue-300"
          />

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="text-sm text-center text-gray-600">
          Already have an account?{" "}
          <span
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={() => navigate("/driver/login")}
          >
            Login here
          </span>
        </p>
      </div>
    </div>
  );
}
