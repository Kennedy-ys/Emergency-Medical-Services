import { useEffect, useState } from "react";
import { getDatabase, ref, onValue, update, remove } from "firebase/database";
import { format } from "date-fns";
import avatarImg from "../assets/avatar.png";
import toast from "react-hot-toast";

export default function ReviewModeration() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    const db = getDatabase();
    const reviewsRef = ref(db, "reviews");

    const unsubscribe = onValue(reviewsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setReviews(list.reverse()); // Most recent first
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredReviews = reviews
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => {
      if (sortOrder === "newest") return b.timestamp - a.timestamp;
      else return a.timestamp - b.timestamp;
    });

  const handleStatusUpdate = async (id, status) => {
    const db = getDatabase();
    await update(ref(db, `reviews/${id}`), { status });
    toast.success(`Review marked as ${status}`);
  };

  const handleDelete = async (id) => {
    const db = getDatabase();
    await remove(ref(db, `reviews/${id}`));
    toast.success("Review deleted.");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-blue-800 mb-6">
        Review Moderation
      </h1>
      {reviews.length === 0 ? (
        <p className="text-gray-500">No reviews yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
            <div>
              <label className="mr-2 text-sm font-medium text-gray-700">
                Filter:
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="p-2 border border-gray-300 rounded"
              >
                <option value="all">All</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="mr-2 text-sm font-medium text-gray-700">
                Sort:
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="p-2 border border-gray-300 rounded"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          <table className="w-full table-auto text-sm border border-gray-200 rounded shadow">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReviews.map((review) => (
                <tr key={review.id} className="border-t">
                  <td className="px-4 py-3 flex items-center gap-3">
                    <img
                      src={review.avatar || avatarImg}
                      alt="avatar"
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p className="font-semibold">{review.name}</p>
                      <p className="text-xs text-gray-500">{review.role}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs break-words">
                    {review.message}
                  </td>
                  <td className="px-4 py-3 text-yellow-500">
                    {Array(review.rating).fill("⭐").join("")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        review.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : review.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {review.status || "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {review.timestamp
                      ? format(review.timestamp, "dd MMM yyyy, h:mm a")
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button
                      onClick={() => handleStatusUpdate(review.id, "approved")}
                      className="text-green-600 hover:underline"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(review.id, "rejected")}
                      className="text-yellow-600 hover:underline"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(review.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {confirmDeleteId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded shadow-md text-center max-w-sm w-full">
                <h3 className="text-lg font-semibold mb-2">Confirm Deletion</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete this review?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={async () => {
                      await handleDelete(confirmDeleteId);
                      setConfirmDeleteId(null);
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
