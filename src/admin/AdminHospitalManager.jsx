// src/admin/AdminHospitalManager.jsx
import React, { useEffect, useState } from "react";
import { ref, onValue, push, update } from "firebase/database";
import { db } from "../firebaseConfig";
import { useAdminStatus } from "../hooks/useAdminStatus";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useNavigate } from "react-router-dom";

// Default hospital icon
const hospitalIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30],
});

// 🔹 Map picker component
function MapPicker({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
}

export default function AdminHospitalManager() {
  const [hospitals, setHospitals] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 5;
  const isAdmin = useAdminStatus();
  const navigate = useNavigate();

  // Form state
  const [form, setForm] = useState({
    name: "",
    address: "",
    lat: "",
    lng: "",
  });

  // Load hospitals
  useEffect(() => {
    const hospitalsRef = ref(db, "hospitals");
    return onValue(hospitalsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setHospitals(list);
    });
  }, []);

  if (!isAdmin) {
    // Redirect if not an admin
    navigate("/admin-login");

  }

  // Filter + Pagination
  const filtered = hospitals.filter((h) => {
    if (!showArchived && h.archived) return false;
    return h.name.toLowerCase().includes(search.toLowerCase());
  });

  const paginated = filtered.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  // Handle form changes
  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // Save hospital
  const handleSave = async () => {
    if (!form.name || !form.lat || !form.lng) return alert("Fill all fields");

    if (editingHospital) {
      await update(ref(db, `hospitals/${editingHospital.id}`), form);
    } else {
      await push(ref(db, "hospitals"), { ...form, archived: false });
    }

    setForm({ name: "", address: "", lat: "", lng: "" });
    setEditingHospital(null);
    setModalOpen(false);
  };

  // Edit hospital
  const handleEdit = (hospital) => {
    setEditingHospital(hospital);
    setForm({
      name: hospital.name,
      address: hospital.address || "",
      lat: hospital.lat,
      lng: hospital.lng,
    });
    setModalOpen(true);
  };

  // Archive / Restore
  const toggleArchive = async (hospital) => {
    await update(ref(db, `hospitals/${hospital.id}`), {
      archived: !hospital.archived,
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Manage Hospitals</h1>

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Search hospitals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-full sm:w-1/3"
        />
        <button
          onClick={() => {
            setEditingHospital(null);
            setForm({ name: "", address: "", lat: "", lng: "" });
            setModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Add Hospital
        </button>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          {showArchived ? "Hide Archived" : "Show Archived"}
        </button>
      </div>

      {/* Hospitals list */}
      <div className="bg-white shadow rounded">
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Address</th>
              <th className="p-2 border">Lat</th>
              <th className="p-2 border">Lng</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((h) => (
              <tr
                key={h.id}
                className={h.archived ? "bg-red-50" : ""}
              >
                <td className="p-2 border">{h.name}</td>
                <td className="p-2 border">{h.address}</td>
                <td className="p-2 border">{h.lat}</td>
                <td className="p-2 border">{h.lng}</td>
                <td className="p-2 border flex gap-2">
                  <button
                    onClick={() => handleEdit(h)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleArchive(h)}
                    className={`${
                      h.archived
                        ? "bg-green-600"
                        : "bg-red-600"
                    } text-white px-2 py-1 rounded`}
                  >
                    {h.archived ? "Restore" : "Archive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>
          Page {currentPage} / {Math.ceil(filtered.length / perPage)}
        </span>
        <button
          disabled={currentPage >= Math.ceil(filtered.length / perPage)}
          onClick={() => setCurrentPage((p) => p + 1)}
          className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">
              {editingHospital ? "Edit Hospital" : "Add Hospital"}
            </h2>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Hospital Name"
              className="border p-2 rounded w-full mb-2"
            />
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Address"
              className="border p-2 rounded w-full mb-2"
            />
            <div className="flex gap-2">
              <input
                type="text"
                name="lat"
                value={form.lat}
                onChange={handleChange}
                placeholder="Latitude"
                className="border p-2 rounded w-1/2"
              />
              <input
                type="text"
                name="lng"
                value={form.lng}
                onChange={handleChange}
                placeholder="Longitude"
                className="border p-2 rounded w-1/2"
              />
            </div>
            <button
              onClick={() => setMapModalOpen(true)}
              className="mt-2 bg-blue-500 text-white px-3 py-1 rounded"
            >
              Pick on Map
            </button>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-1 bg-gray-400 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      {mapModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-4 rounded shadow-lg max-w-2xl w-full">
            <h2 className="text-lg font-semibold mb-2">Pick Hospital Location</h2>
            <MapContainer
              center={[6.5244, 3.3792]} // Lagos default
              zoom={12}
              style={{ height: "400px", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapPicker
                onSelect={(latlng) => {
                  setForm({ ...form, lat: latlng.lat, lng: latlng.lng });
                  setMapModalOpen(false);
                }}
              />
              {form.lat && form.lng && (
                <Marker
                  position={[form.lat, form.lng]}
                  icon={hospitalIcon}
                />
              )}
            </MapContainer>
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setMapModalOpen(false)}
                className="px-3 py-1 bg-gray-500 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
