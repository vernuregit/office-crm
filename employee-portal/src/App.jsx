import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { initAuthListener } from "./firebase/auth";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MyTasks from "./pages/MyTasks";
import Clients from "./pages/Clients";
import Leave from "./pages/Leave";
import Profile from "./pages/Profile";
import Invoices from "./pages/Invoices";
import EmployeeTickets from "./pages/EmployeeTickets";
import Documents from "./pages/Documents";
import LearningEmployee from "./pages/LearningEmployee";

const Placeholder = ({ name }) => (
  <div className="flex items-center justify-center h-screen bg-[#F5F7FF]">
    <p className="text-gray-400 text-lg font-medium">{name} — Coming Soon</p>
  </div>
);

function App() {
  useEffect(() => { initAuthListener(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        {/* <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} /> */}
        {/* <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} /> */}
        <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/tickets" element={<ProtectedRoute><EmployeeTickets /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/learning" element={<ProtectedRoute><LearningEmployee name="Learning" /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
