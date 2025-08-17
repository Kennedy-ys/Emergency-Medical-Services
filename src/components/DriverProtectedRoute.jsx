import { Navigate } from "react-router-dom";
import { useDriverAuth } from "../hooks/useDriverAuth";

export default function DriverProtectedRoute({ children }) {
  const { user, role, loading } = useDriverAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-lg font-semibold text-gray-700">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/driver/login" />;
  }

  if (role !== "driver") {
    return <Navigate to="/" />;
  }

  return children;
}
