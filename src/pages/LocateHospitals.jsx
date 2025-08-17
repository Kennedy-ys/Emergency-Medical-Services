import React from "react";
import { MapPin, ArrowRight } from "react-feather";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for missing marker icons in Leaflet + Vite/React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const dummyHospitals = [
  {
    id: 1,
    name: "St. Mary’s General Hospital",
    address: "12 Adeyemo St, Lagos",
    distance: "2.4 km",
    location: { lat: 6.5244, lng: 3.3792 },
  },
  {
    id: 2,
    name: "Hope Medical Centre",
    address: "7 Ogundele Ave, Ikeja",
    distance: "3.1 km",
    location: { lat: 6.6018, lng: 3.3515 },
  },
  {
    id: 3,
    name: "CityCare Clinic",
    address: "42 Marina Rd, Lagos Island",
    distance: "5.2 km",
    location: { lat: 6.4551, lng: 3.3942 },
  },
];

const LocateHospitals = () => {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 text-center">
        Locate Nearby Hospitals
      </h2>

      <input
        type="text"
        className="w-full px-4 py-3 rounded-lg border border-gray-300 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Search hospitals by name or location"
        disabled
      />

      <div className="flex flex-col gap-6">
        {dummyHospitals.map((hospital) => (
          <div
            key={hospital.id}
            className="bg-white rounded-xl shadow-md p-4 border border-gray-100"
          >
            <div className="mb-3">
              <h3 className="text-lg font-semibold">{hospital.name}</h3>
              <p className="text-sm text-gray-600">{hospital.address}</p>
              <div className="flex items-center text-gray-500 text-sm mt-1">
                <MapPin size={16} className="mr-1" />
                {hospital.distance}
              </div>
            </div>

            <div className="h-48 w-full rounded-lg overflow-hidden mb-3">
              <MapContainer
                center={[hospital.location.lat, hospital.location.lng]}
                zoom={15}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[hospital.location.lat, hospital.location.lng]}>
                  <Popup>{hospital.name}</Popup>
                </Marker>
              </MapContainer>
            </div>

            <button className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm transition">
              View on Map <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LocateHospitals;
