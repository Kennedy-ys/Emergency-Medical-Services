// src/pages/AmbulanceBooking.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ref, push } from "firebase/database";
import { db } from "../firebaseConfig";
import toast from "react-hot-toast";
import hospitalImg from "../assets/icons/hospital-icon.png";
import patientImg from "../assets/icons/patient-icon.png";
import HospitalSelect from "../components/HospitalSelect";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { MapContainer, TileLayer, Marker, useMap, Popup } from "react-leaflet";
import { queuePatient } from "../utils/patientQueue"; // For offline

const hospitalIcon = L.icon({
  iconUrl: hospitalImg,
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

const patientIcon = L.icon({
  iconUrl: patientImg,
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -35],
});

const hospitals = [
  { name: "University of Calabar Teaching Hospital", lat: 4.954459674491282, lng: 8.349155108472956 },
  { name: "General Hospital Calabar, Mary Slessor Ave", lat: 4.956201824517111, lng: 8.336618468145364 },
  { name: "Nigerian Navy Reference Hospital Calabar, Murtala Mohammed Hwy", lat: 5.003471538582233, lng: 8.333811188370452 },
  { name: "Federal Neuro-Psychiatric Hospital, Calabar Rd", lat: 4.955880440230755, lng: 8.318562704521664 },
  { name: "Calabar Women And Children Hospital, Murtala Mohammed Hwy", lat: 5.0354731711099285, lng: 8.347727127321482 },
];

const AmbulanceBooking = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
    hospital: "",
  });

  const selectedHospital = hospitals.find(h => h.name === form.hospital);

  // Define the Routing component inside AmbulanceBooking
  const Routing = ({ location, hospital }) => {
    const map = useMap();

    useEffect(() => {
      if (!location || !hospital) return;

      if (map.routingControl) {
        map.removeControl(map.routingControl);
      }

      const routingControl = L.Routing.control({
        waypoints: [
          L.latLng(location[0], location[1]),
          L.latLng(hospital[0], hospital[1]),
        ],
        lineOptions: {
          styles: [{ color: "blue", weight: 4 }],
        },
        createMarker: () => null,
        addWaypoints: false,
        routeWhileDragging: false,
        show: false,
        fitSelectedRoutes: true,
      }).addTo(map);

      map.routingControl = routingControl;

      return () => {
        if (map.routingControl) {
          map.removeControl(map.routingControl);
          delete map.routingControl;
        }
      };
    }, [location, hospital, map]);

    return null;
  };

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
      },
      (err) => {
        console.error("Location error:", err);
        toast.error("Unable to get your location.");
      }
    );
  }, []);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.hospital || !location) {
      toast.error("Please fill all fields and allow location access.");
      return;
    }

    const booking = {
      ...form,
      location: location,
      hospitalLocation: selectedHospital,
      timestamp: new Date().toISOString(),
      status: "pending",
      AssignedDriverId: null,
    };

    try {
      if (!navigator.onLine) {
        await queuePatient(booking);
        toast.success("You're offline. Booking saved for sync.");
        navigate("/track/offline");
      } else {
        const newRef = push(ref(db, "bookings"), booking);
        const bookingId = newRef.key;
        toast.success("Ambulance requested!");
        navigate(`/track/${bookingId}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Booking failed. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 py-10 px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl text-center font-bold text-blue-700 mb-4">Book an Ambulance</h2>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input
            type="text"
            name="name"
            placeholder="Your Full Name"
            className="border-b-2 border-b-blue-200  rounded-b-md outline-none p-3 w-full"
            value={form.name}
            onChange={handleChange}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            className="border-b-2 border-b-blue-200  rounded-b-md outline-none p-3 w-full"
            value={form.phone}
            onChange={handleChange}
          />
          <HospitalSelect hospitals={hospitals} form={form} setForm={setForm} />
          <textarea
            name="notes"
            placeholder="Additional notes or emergency details"
            className="border-b-2 border-b-blue-200  rounded-b-md outline-none p-3 w-full resize-none"
            value={form.notes}
            onChange={handleChange}
          />

          <button
            type="submit"
            className="bg-blue-600 text-white py-3 px-6 rounded font-medium hover:bg-blue-700"
          >
            Submit Booking
          </button>
        </form>

        {/* Map and Routing */}
        {location && selectedHospital ? (
          <div className="mt-6 rounded overflow-hidden h-64">
            <MapContainer
              center={{
                lat: location.lat,
                lng: location.lng,
              }}
              zoom={13}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[location.lat, location.lng]} icon={patientIcon} >
                <Popup>
                  <p>
                    Your Here
                  </p>
                </Popup>
              </Marker>
              <Marker
                position={[selectedHospital.lat, selectedHospital.lng]}
                icon={hospitalIcon}
                
              >
                <Popup>
                <p>
                  {selectedHospital.name}
                </p>
              </Popup>
              </Marker>
              
              {/* Routing Path */}
              <Routing
                location={[location.lat, location.lng]}
                hospital={[selectedHospital.lat, selectedHospital.lng]}
              />
            </MapContainer>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">
            {form.hospital && !location
              ? "Location unavailable. Map may not load."
              : "Select a hospital to view directions."}
          </p>
        )}
      </div>
    </div>
  );
};

export default AmbulanceBooking;