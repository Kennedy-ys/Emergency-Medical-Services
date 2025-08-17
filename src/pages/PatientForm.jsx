import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { ref, set, push } from "firebase/database";
import { queuePatient } from "../utils/patientQueue";
import { v4 as uuidv4 } from "uuid";

export default function PatientForm() {
  const [form, setForm] = useState({
    fullName: "",
    age: "",
    gender: "",
    address: "",
    phone: "",
  });

  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("");

  // ✅ Capture location when form loads
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn("⚠️ Location fetch failed:", err.message);
          setLocation(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.warn("Geolocation not supported.");
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🔄 Form submitted.");

    const patient = {
      ...form,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      location: location || { latitude: null, longitude: null }, // Attach captured location
    };

    await submitPatient(patient);
  };

  const submitPatient = async (patient) => {
    console.log("📝 Patient object:", patient);

    try {
      if (navigator.onLine) {
        console.log("🌐 Online. Trying to push to Firebase...");

        const patientRef = push(ref(db, "patients"));
        const patientWithFirebaseKey = {
          ...patient,
          firebaseKey: patientRef.key, // Store Firebase key for future reference
        };
        await set(patientRef, patient);

        console.log("✅ Submitted to Firebase.");
        setStatus("✅ Submitted online.");
      } else {
        console.log("📴 Offline. Queuing data...");
        await queuePatient(patient);
        setStatus("📴 Offline: Data queued.");
      }
    } catch (error) {
      console.error("❌ Submission failed. Queuing data offline.", error);
      await queuePatient(patient);
      setStatus("⚠️ Failed online, saved offline.");
    }

    setForm({
      fullName: "",
      age: "",
      gender: "",
      address: "",
      phone: "",
    });

    console.log("🧹 Form reset complete.");
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-2">Patient Form</h2>

      <p className="text-xs text-gray-500 mb-2">
        📍 Your location will be recorded with the submission.
      </p>

      {/* ⚠️ Location warning */}
      {location === null && (
        <p className="text-sm text-red-600 mb-2">
          ⚠️ Location not captured. Please enable GPS for accurate mapping.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          name="fullName"
          placeholder="Full Name"
          value={form.fullName}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        />
        <input
          type="number"
          name="age"
          placeholder="Age"
          value={form.age}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        />
        <select
          name="gender"
          value={form.gender}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        >
          <option value="">Select Gender</option>
          <option>Male</option>
          <option>Female</option>
          <option>Other</option>
        </select>
        <input
          type="text"
          name="address"
          placeholder="Address"
          value={form.address}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          value={form.phone}
          onChange={handleChange}
          className="w-full p-2 border"
          required
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Submit
        </button>
        <p className="text-sm mt-2">{status}</p>
      </form>
    </div>
  );
}
