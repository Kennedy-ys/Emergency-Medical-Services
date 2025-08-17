import { useEffect, useState } from "react";
import { ref, onValue, remove, set } from "firebase/database";
import { db } from "../firebaseConfig";
import toast from "react-hot-toast";
import Papa from "papaparse";

export default function ArchivedPatientsTable() {
  const [archived, setArchived] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Fetch archived patients
  useEffect(() => {
    const archivedRef = ref(db, "archivedPatients");
    onValue(archivedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]) => ({
          firebaseKey: id,
          ...value,
        }));
        setArchived(list);
        setFiltered(list);
      } else {
        setArchived([]);
        setFiltered([]);
      }
    });
  }, []);

  // Handle search
  useEffect(() => {
    const lower = search.toLowerCase();
    const filteredList = archived.filter((p) =>
      Object.values(p).some((val) => String(val).toLowerCase().includes(lower))
    );
    setFiltered(filteredList);
    setPage(1);
  }, [search, archived]);

  const exportCSV = () => {
    const csv = Papa.unparse(
      filtered.map((p) => ({
        FullName: p.fullName,
        Age: p.age,
        Gender: p.gender,
        Phone: p.phone,
        Address: p.address,
        DeletedBy: p.deletedBy || "N/A",
        DeletedAt: p.deletedAt ? new Date(p.deletedAt).toLocaleString() : "N/A",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "archived_patients.csv";
    a.click();
  };

  const handleRestore = async (patient) => {
    const originalRef = ref(db, `patients/${patient.firebaseKey}`);
    const archivedRef = ref(db, `archivedPatients/${patient.firebaseKey}`);

    try {
      const { firebaseKey, deletedBy, deletedAt, ...restoredData } = patient;
      await set(originalRef, restoredData);
      await remove(archivedRef);
      toast.success("♻️ Patient restored.");
    } catch (err) {
      toast.error("Failed to restore patient.");
      console.error(err);
    }
  };

  const currentPage = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 text-sm">
      <h2 className="text-xl font-bold mb-4">🗃️ Archived Patients</h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <input
          type="text"
          placeholder="🔍 Search archived patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border shadow-sm border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition w-fit"
        >
          📤 Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border text-left overflow-hidden rounded-lg">
          <thead>
            <tr className="bg-blue-100">
              <th className="px-4 py-2">Full Name</th>
              <th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">Age</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Deleted By</th>
              <th className="px-4 py-2">Deleted At</th>
              <th className="px-4 py-2">Restore</th>
            </tr>
          </thead>
          <tbody>
            {currentPage.map((p, i) => (
              <tr
                key={p.firebaseKey}
                className={`${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-blue-50`}
              >
                <td className="px-4 py-2">{p.fullName}</td>
                <td className="px-4 py-2">{p.gender}</td>
                <td className="px-4 py-2">{p.age}</td>
                <td className="px-4 py-2">{p.phone}</td>
                <td className="px-4 py-2">{p.deletedBy || "N/A"}</td>
                <td className="px-4 py-2">
                  {p.deletedAt ? new Date(p.deletedAt).toLocaleString() : "N/A"}
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => setConfirmRestore(p)}
                    className="bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700 ml-1.5 transition"
                  >
                    ♻️ Restore
                  </button>
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

      {confirmRestore && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded shadow-md text-center max-w-sm w-full">
      <h3 className="text-lg font-semibold mb-2">Confirm Restore</h3>
      <p className="text-sm text-gray-600 mb-4">
        Restore <strong>{confirmRestore.fullName}</strong> back to the main patient list?
      </p>
      <div className="flex justify-center gap-3">
        <button
          onClick={() => {
            handleRestore(confirmRestore);
            setConfirmRestore(null);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          ✅ Yes, Restore
        </button>
        <button
          onClick={() => setConfirmRestore(null)}
          className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </div>
);
}
// This component displays a table of archived patients, allows searching, restoring, and exporting to CSV.
// It uses Firebase for data storage and retrieval, and react-hot-toast for notifications.