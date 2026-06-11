import { Navigate }  from "react-router-dom";
import useAuthStore  from "../store/authStore";
import { Loader2 }   from "lucide-react";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthStore();

  // ✅ Wait for Firebase to finish checking auth
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
    </div>
  );

  // ✅ Only redirect after loading is done
  if (!user) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;
