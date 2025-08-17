import React, { useState, useEffect } from "react";
import { ref, push } from "firebase/database";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const BookingForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    condition: "",
    location: { lat: "", lng: "" },
    hospital: "",
    notes: "",
  });

  const hospitals = [
  { name: "University of Calabar Teaching Hospital", lat: 4.9717, lng: 8.3417 },
  { name: "General Hospital Calabar", lat: 4.9501, lng: 8.3250 },
  { name: "Asuquo Ekpo Medical Center", lat: 4.9612, lng: 8.3409 },
  { name: "St. Joseph Catholic Hospital", lat: 4.9618, lng: 8.3355 },
  { name: "Prime Medical Clinic Calabar", lat: 4.9789, lng: 8.3451 },
];

  const navigate = useNavigate();

  // Auto-detect geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setFormData((prev) => ({
            ...prev,
            location: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            },
          })),
        (err) => console.warn("Geolocation error", err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedHospitalCoords = hospitals[formData.hospital];
      if (!selectedHospitalCoords) {
        return toast.error("Please select a valid hospital.");
      }
      const bookingRef = ref(db, "ambulanceBookings");
      const newBookingRef = await push(bookingRef, {
        ...formData,
        hospitalLocation: selectedHospitalCoords,
        status: "pending", // Can be accepted/assigned later
        timestamp: Date.now(),
      });

      // Redirect to a tracking page
      navigate(`/track/${newBookingRef.key}`);
      toast.success("Booking submitted successfully!");
      setFormData({
        name: "",
        phone: "",
        condition: "",
        location: { lat: "", lng: "" },
        hospital: "",
        notes: "",
      });
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Booking failed. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl mx-auto bg-white p-6 rounded-lg shadow-md space-y-4"
    >
      <h2 className="text-2xl font-bold mb-4">Book an Ambulance</h2>

      <input
        type="text"
        name="name"
        placeholder="Full Name"
        className="w-full border p-2 rounded"
        value={formData.name}
        onChange={handleChange}
        required
      />
      <input
        type="tel"
        name="phone"
        placeholder="Phone Number"
        className="w-full border p-2 rounded"
        value={formData.phone}
        onChange={handleChange}
        required
      />
      <input
        type="text"
        name="condition"
        placeholder="Emergency Condition"
        className="w-full border p-2 rounded"
        value={formData.condition}
        onChange={handleChange}
        required
      />

      <select
        name="hospital"
        className="w-full border p-2 rounded"
        value={formData.hospital}
        onChange={handleChange}
        required
      >
        <option value="">Select Destination Hospital</option>
            {hospitals.map((h, i) => (
              <option key={i} value={h.name}>{h.lat}{h.lng}</option>
            ))}
      </select>

      <textarea
        name="notes"
        placeholder="Additional Notes"
        className="w-full border p-2 rounded"
        value={formData.notes}
        onChange={handleChange}
        rows={3}
      />

      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded"
      >
        🚑 Request Ambulance
      </button>
    </form>
  );
};

export default BookingForm;