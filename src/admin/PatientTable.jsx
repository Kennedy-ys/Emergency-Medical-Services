import { useEffect, useState } from "react";
import { ref, onValue, remove, set } from "firebase/database";
import toast from "react-hot-toast";
import { db } from "../firebaseConfig";
import { getAuth } from "firebase/auth";
import Papa from "papaparse";

function PatientTable() {
  const [patients, setPatients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("timestamp");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    const patientRef = ref(db, "patients");
    onValue(patientRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]) => ({
          firebaseKey: id, // Store firebase key for deletion
          ...value,
        }));
        setPatients(list);
        setFiltered(list);
      }
    });
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    const filteredList = patients.filter((p) =>
      Object.values(p).some((val) => String(val).toLowerCase().includes(lower))
    );
    setFiltered(filteredList);
    setPage(1);
  }, [search, patients]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    if (!a[sortField] || !b[sortField]) return 0;

    if (sortField === "timestamp") {
      return sortAsc
        ? new Date(a.timestamp) - new Date(b.timestamp)
        : new Date(b.timestamp) - new Date(a.timestamp);
    }

    if (sortField === "age") {
      return sortAsc ? a.age - b.age : b.age - a.age;
    }

    return sortAsc
      ? String(a[sortField]).localeCompare(String(b[sortField]))
      : String(b[sortField]).localeCompare(String(a[sortField]));
  });

  const handleDeletePatient = async () => {
    if (!confirmDelete) return;

    const auth = getAuth();
    const currentuser = auth.currentUser;
    const firebaseKey = confirmDelete.firebaseKey; // Use firebaseKey if available

    const archivedRef = ref(db, `archivedPatients/${firebaseKey}`);
    const originalRef = ref(db, `patients/${firebaseKey}`);

    const archivedData = {
        ...confirmDelete,
        deletedBy: currentuser?.email || "Unknown",
        deletedAt: new Date().toISOString(),
      };

    try {
      console.log("📦 Archiving patient:", confirmDelete.fullName);

      await set(archivedRef, archivedData); // Backup to archive
      await remove(originalRef); // Remove from main list
      setConfirmDelete(null);
      setSelected(null);

      toast.success("✅ Patient archived and deleted.");
    } catch (err) {
      toast.error("Failed to delete patient.");
      console.error("❌ Failed to delete patient:", err);
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(
      filtered.map((p) => ({
        FullName: p.fullName,
        Age: p.age,
        Gender: p.gender,
        Phone: p.phone,
        Address: p.address,
        Timestamp: new Date(p.timestamp).toLocaleString(),
        location: p.location
          ? `${p.location.latitude}, ${p.location.longitude}`
          : "N/A",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "patients.csv";
    a.click();
  };

  const currentPage = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 text-sm">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        👥 Patients
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <input
          type="text"
          placeholder="🔍 Search by name, gender, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 mb-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition w-fit"
        >
          📤 Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border rounded-lg overflow-hidden text-left">
          <thead>
            <tr className="bg-blue-100">
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => handleSort("fullName")}
              >
                Name {sortField === "fullName" ? (sortAsc ? "🔽" : "🔼") : ""}
              </th>
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => handleSort("gender")}
              >
                Gender {sortField === "gender" ? (sortAsc ? "🔽" : "🔼") : ""}
              </th>
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => handleSort("age")}
              >
                Age {sortField === "age" ? (sortAsc ? "🔽" : "🔼") : ""}
              </th>
              <th className="px-4 py-2">Phone</th>
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => handleSort("timestamp")}
              >
                Submitted{" "}
                {sortField === "timestamp" ? (sortAsc ? "🔽" : "🔼") : ""}
              </th>
              <th className="px-4 py-2">Map</th>
            </tr>
          </thead>
          <tbody>
            {currentPage.map((p, i) => (
              <tr
                key={`${p.id}-${p.timestamp}`}
                onClick={() => setSelected(p)}
                className={`cursor-pointer hover:bg-blue-50 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                }`}
              >
                <td className="px-4 py-2">{p.fullName}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-1 rounded text-white text-xs font-semibold ${
                      p.gender === "Male"
                        ? "bg-blue-600"
                        : p.gender === "Female"
                        ? "bg-pink-500"
                        : "bg-gray-600"
                    }`}
                  >
                    {p.gender || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-2">{p.age}</td>
                <td className="px-4 py-2">{p.phone}</td>
                <td className="px-4 py-2">
                  {p.timestamp && !isNaN(new Date(p.timestamp))
                    ? new Date(p.timestamp).toLocaleString()
                    : "N/A"}
                </td>
                <td className="px-4 py-2">
                  <a
                    href={`https://www.google.com/maps?q=${p.location?.latitude},${p.location?.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📍 View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
        <span className="text-xs">
          Page {page} of {Math.ceil(filtered.length / perPage)}
        </span>
        <div className="space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            onClick={() =>
              setPage((p) =>
                Math.min(Math.ceil(filtered.length / perPage), p + 1)
              )
            }
            disabled={page >= Math.ceil(filtered.length / perPage)}
            className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black opacity-97 flex items-center justify-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4 relative"
            onClick={(e) => e.stopPropagation()} // Prevent backdrop click from closing
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 text-white bg-red-600 hover:bg-red-700 rounded-full px-2 py-1 text-xs"
            >
              ✖
            </button>
            <h3 className="text-lg font-semibold mb-3">👤 Patient Details</h3>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Full Name:</strong> {selected.fullName}
              </p>
              <p>
                <strong>Gender:</strong> {selected.gender}
              </p>
              <p>
                <strong>Age:</strong> {selected.age}
              </p>
              <p>
                <strong>Phone:</strong> {selected.phone}
              </p>
              <p>
                <strong>Submitted:</strong>{" "}
                {new Date(selected.timestamp).toLocaleString()}
              </p>
              <a
                href={`https://www.google.com/maps?q=${selected.location?.latitude},${selected.location?.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-green-600 hover:bg-green-700 text-white no-underline px-3 py-1 rounded text-xs font-medium mt-2"
              >
                🗺️ View on Google Maps
              </a>
              <button
                onClick={() => setConfirmDelete(selected)}
                className="bg-red-600 text-white text-xs px-3 py-1 rounded hover:bg-red-700 ml-1.5"
              >
                🗑️ Delete
              </button>

              {confirmDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded shadow-md text-center max-w-sm w-full">
                    <h3 className="text-lg font-semibold mb-2">
                      Confirm Deletion
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Are you sure you want to delete{" "}
                      <strong>{confirmDelete.fullName}</strong>?
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={handleDeletePatient}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                      >
                        Yes, Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PatientTable;
