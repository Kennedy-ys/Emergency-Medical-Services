import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ref, onValue } from "firebase/database";
import { db } from "../firebaseConfig";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});

const BookingTracker = () => {
  const { bookingId } = useParams();
  const [ambulanceLoc, setAmbulanceLoc] = useState(null);
  const [patientLoc, setPatientLoc] = useState(null);

  useEffect(() => {
    const bookingRef = ref(db, `bookings/${bookingId}`);

    const unsubscribe = onValue(bookingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAmbulanceLoc(data.ambulanceLocation || null);
        setPatientLoc(data.patient || null);
      }
    });

    return () => unsubscribe();
  }, [bookingId]);

  return (
    <div className="h-screen w-full">
      {patientLoc ? (
        <MapContainer
          center={[patientLoc.lat, patientLoc.lng]}
          zoom={13}
          className="h-full w-full z-10"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {/* Patient Marker */}
          <Marker position={[patientLoc.lat, patientLoc.lng]}>
            <Popup>You are here (Patient)</Popup>
          </Marker>

          {/* Ambulance Marker */}
          {ambulanceLoc && (
            <Marker position={[ambulanceLoc.lat, ambulanceLoc.lng]}>
              <Popup>Ambulance is en route</Popup>
            </Marker>
          )}
        </MapContainer>
      ) : (
        <div className="text-center pt-10 text-gray-600">Loading booking...</div>
      )}
    </div>
  );
};

export default BookingTracker;
