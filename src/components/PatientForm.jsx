import React, { useState, useEffect } from "react";
import { db } from "../firebaseConfig";
import { ref, push } from "firebase/database";
import { openDB } from "idb";

const PatientForm = () => {
  const [patient, setPatient] = useState({ name: "", age: "", condition: "" });

  // Handle input change
  const handleChange = (e) => {
    setPatient({ ...patient, [e.target.name]: e.target.value });
  };

  // Save to Firebase or queue offline
  const handleSubmit = async (e) => {
    e.preventDefault();
    const isOnline = navigator.onLine;

    if (isOnline) {
      try {
        await push(ref(db, "patients"), patient);
        alert("Patient data submitted online.");
      } catch (error) {
        console.error("Firebase error:", error);
      }
    } else {
      const dbLocal = await openDB("EMS_DB", 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("offline-patients")) {
            db.createObjectStore("offline-patients", { autoIncrement: true });
          }
        },
      });
      await dbLocal.add("offline-patients", patient);
      alert("Offline: Patient data saved locally.");
    }

    setPatient({ name: "", age: "", condition: "" });
  };

  // Sync offline patients when online
  useEffect(() => {
    const syncOfflineData = async () => {
      if (navigator.onLine) {
        const dbLocal = await openDB("EMS_DB", 1);
        const tx = dbLocal.transaction("offline-patients", "readwrite");
        const store = tx.objectStore("offline-patients");
        const allOffline = await store.getAll();

        for (const entry of allOffline) {
          await push(ref(db, "patients"), entry);
        }

        await store.clear();
        console.log("Offline data synced.");
      }
    };

    window.addEventListener("online", syncOfflineData);
    return () => window.removeEventListener("online", syncOfflineData);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white shadow rounded max-w-md mx-auto mt-6">
      <h2 className="text-xl font-bold mb-4">Add Patient</h2>

      <input
        type="text"
        name="name"
        placeholder="Name"
        value={patient.name}
        onChange={handleChange}
        required
        className="block w-full border px-3 py-2 mb-3 rounded"
      />
      <input
        type="number"
        name="age"
        placeholder="Age"
        value={patient.age}
        onChange={handleChange}
        required
        className="block w-full border px-3 py-2 mb-3 rounded"
      />
      <input
        type="text"
        name="condition"
        placeholder="Condition"
        value={patient.condition}
        onChange={handleChange}
        required
        className="block w-full border px-3 py-2 mb-3 rounded"
      />
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Submit</button>
    </form>
  );
};

export default PatientForm;
