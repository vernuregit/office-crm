import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AuthProvider from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Clients from "./pages/Clients";
import AssignClient from "./pages/AssignClient";
import Tasks from "./pages/Tasks";
import Invoices from "./pages/Invoices";
import LeaveRequests from "./pages/LeaveRequests";
import TimeLogs from "./pages/TimeLogs";
import Settings from "./pages/Settings";
import AdminTickets from "./pages/adminTickets";
// ─── Guarded Route ────────────────────────────────────────────────
const Guarded = ({ children }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

// ─── App Shell (must be inside AuthProvider to use useAuth) ───────
function AppShell() {
  const { loading } = useAuth();


  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Protected */}
        <Route path="/" element={<Guarded><Dashboard /></Guarded>} />
        <Route path="/employees" element={<Guarded><Employees /></Guarded>} />
        {/* <Route path="/clients" element={<Guarded><Clients /></Guarded>} /> */}
        {/* <Route path="/assign" element={<Guarded><AssignClient /></Guarded>} /> */}
        <Route path="/tasks" element={<Guarded><Tasks /></Guarded>} />
        <Route path="/invoices" element={<Guarded><Invoices /></Guarded>} />
        <Route path="/leave" element={<Guarded><LeaveRequests /></Guarded>} />
        <Route path="/time-logs" element={<Guarded><TimeLogs /></Guarded>} />
        <Route path="/settings" element={<Guarded><Settings /></Guarded>} />
        <Route path="/tickets" element={<Guarded><AdminTickets /></Guarded>} />
        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ─── Root Export ──────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}