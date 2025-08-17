// src/pages/BookingPage.jsx
import React, { useState } from "react";
import BookingForm from "../components/forms/BookingForm";
import LiveTrackingMap from "../components/maps/LiveTrackingMap"; // Optional, render after booking
import { createAmbulanceBooking } from "../services/bookingService";

const BookingPage = () => {
  const [bookingData, setBookingData] = useState(null);

  const handleBookingSubmit = async (formData) => {
    try {
      const bookingId = await createAmbulanceBooking(formData);
      setBookingData({ ...formData, bookingId });
    } catch (error) {
      console.error("Booking failed:", error);
      alert("Failed to book ambulance. Please try again.");
    }
  };

  return (
    <div className="booking-page">
      <h1>Book an Ambulance</h1>

      {/* Booking form */}
      {!bookingData ? (
        <BookingForm onSubmit={handleBookingSubmit} />
      ) : (
        <>
          <p>Booking successful! Tracking your ambulance now…</p>
          <LiveTrackingMap booking={bookingData} />
        </>
      )}
    </div>
  );
};

export default BookingPage;
