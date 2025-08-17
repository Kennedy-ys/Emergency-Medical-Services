import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { ref, onValue } from "firebase/database";
import Papa from "papaparse";

const ITEMS_PER_PAGE = 10;

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("timestamp");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const patientsRef = ref(db, "patients");
    onValue(patientsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setPatients(list);
      }
    });
  }, []);

  const filtered = patients.filter((p) =>
    `${p.fullName} ${p.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (!a[sortField] || !b[sortField]) return 0;
    if (sortField === "timestamp") {
      return sortAsc
        ? new Date(a[sortField]) - new Date(b[sortField])
        : new Date(b[sortField]) - new Date(a[sortField]);
    }
    return sortAsc
      ? String(a[sortField]).localeCompare(String(b[sortField]))
      : String(b[sortField]).localeCompare(String(a[sortField]));
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(
      patients.map((p) => ({
        FullName: p.fullName,
        Age: p.age,
        Gender: p.gender,
        Phone: p.phone,
        Address: p.address,
        Symptoms: p.symptoms || "",
        Diagnosis: p.diagnosis || "",
        Timestamp: new Date(p.timestamp).toLocaleString(),
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `patients-${new Date().toISOString()}.csv`;
    link.click();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">👥 Patient Records</h2>
        <button
          onClick={exportCSV}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📤 Export CSV
        </button>
      </div>

      <input
        type="text"
        placeholder="🔍 Search by name, gender, phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />

      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300 text-sm">
          <thead className="bg-gray-100">
            <tr>
              {[
                { key: "fullName", label: "Full Name" },
                { key: "age", label: "Age" },
                { key: "gender", label: "Gender" },
                { key: "phone", label: "Phone" },
                { key: "address", label: "Address" },
                { key: "timestamp", label: "Timestamp" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="p-2 text-left cursor-pointer"
                  onClick={() => handleSort(key)}
                >
                  {label} {sortField === key ? (sortAsc ? "▲" : "▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No patients found.
                </td>
              </tr>
            ) : (
              paginated.map((p) => (
                <tr key={`${p.id}-${p.timestamp}`} className="border-t">
                  <td className="p-2">{p.fullName}</td>
                  <td className="p-2">{p.age}</td>
                  <td className="p-2">{p.gender}</td>
                  <td className="p-2">{p.phone}</td>
                  <td className="p-2">{p.address}</td>
                  <td className="p-2">
                    {new Date(p.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1 border rounded ${
              currentPage === i + 1
                ? "bg-blue-500 text-white"
                : "bg-white text-black"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
