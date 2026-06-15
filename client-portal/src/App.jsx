import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { initAuthListener } from "./firebase/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices"
import ServiceStatus from "./pages/ServiceStatus"
import Documents from "./pages/Documents";
import ChatBot from "./pages/ChatBot";
import Support from "./pages/Support";
// Placeholder pages (we'll build these next)
const Placeholder = ({ name }) => (
  <div className="flex items-center justify-center h-full">
    <p className="text-gray-400 text-lg">{name} — Coming Soon</p>
  </div>
);

function App() {
  useEffect(() => { initAuthListener(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        {/* <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} /> */}
        <Route path="/service-status" element={<ProtectedRoute><ServiceStatus /></ProtectedRoute>} />
        {/* <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} /> */}
        {/* <Route path="/chatbot" element={<ProtectedRoute><ChatBot /></ProtectedRoute>} /> */}
        <Route path="/support" element={<ProtectedRoute><Support />       </ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
