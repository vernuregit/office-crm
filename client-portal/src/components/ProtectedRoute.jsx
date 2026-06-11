import { Navigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthStore();

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
    </div>
  );

  return user ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
   