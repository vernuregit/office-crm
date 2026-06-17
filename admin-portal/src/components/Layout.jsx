import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import useAuthStore from "../store/authStore";
import {
  LayoutDashboard, Users, ClipboardList, CalendarClock,
  Settings, LogOut, Menu, X, ChevronRight, Clock,
} from "lucide-react";
import Halo from "../../public/halologo.png";
import Halowhite from "../../public/Logowhite.png";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employees", icon: Users, label: "Employees" },
  { to: "/tasks", icon: ClipboardList, label: "Tasks" },
  { to: "/leave", icon: CalendarClock, label: "Leave Requests" },
  { to: "/tickets", icon: ClipboardList, label: "Tickets" },
  { to: "/attendance", icon: CalendarClock, label: "Attendance" },
  { to: "/time-logs", icon: Clock, label: "Time Logs" },
  { to: "/settings", icon: Settings, label: "Settings" },


];

export default function Layout({ children, title }) {
  const { adminData } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`
        ${mobile ? "flex" : "hidden lg:flex"}
        flex-col h-full bg-[#1D7872] border-r border-gray-100
        ${mobile ? "w-72" : "w-64"} flex-shrink-0
      `}
    >
      {/* ── Logo ── */}
      {/* Logo */}
      <div className="px-5 py-0  flex justify-center">
        <img src={Halowhite} alt="Halo CRM" className="w-full h-full object-contain" />
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 pt-5 pb-2 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold
               transition-all duration-300 ease-out cursor-pointer
               ${isActive
                ? "bg-white text-black shadow-md shadow-blue-900/20 -translate-y-0.5"
                : "text-white/90 hover:bg-gray-50 hover:text-gray-900 hover:-translate-y-0.5 hover:shadow-sm"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={isActive
                    ? "text-black"
                    : "text-white/90 group-hover:text-gray-600 transition-colors duration-200"
                  }
                />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={13} className="text-blue-300" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Admin Profile + Logout ── */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        {/* Profile strip */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-gray-50 border border-gray-100">
          <div className="w-8 h-8 rounded-xl bg-[#1D7872] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {adminData?.name?.charAt(0) || "A"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate leading-tight">
              {adminData?.name || "Admin"}
            </p>
            <p className="text-xs text-gray-400 truncate">{adminData?.email || ""}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex  items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white border border-red-100 hover:bg-red-50 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-0.5  bg-red-500 hover:text-red-500 hover:shadow-md hover:shadow-red-200 active:translate-y-0"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Desktop Sidebar ── */}
      <Sidebar />

      {/* ── Mobile Overlay ── */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top Header ── */}
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#1D7872] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden text-gray-400 hover:text-gray-700 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-white/90 font-medium">Home</span>
              <ChevronRight size={13} className="text-white/90" />
              <span className="font-bold text-white">{title}</span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Date pill */}
            <span className="hidden sm:block text-xs text-white font-medium bg-[#1D7872] border border-[#1D7872] rounded-full px-3 py-1.5">
              {new Date().toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
              })}
            </span>

            <div className="w-px h-4 bg-gray-200" />

            {/* Admin avatar chip */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5 cursor-default">
              <div className="w-5 h-5 rounded-lg bg-[#1D7872] flex items-center justify-center text-white text-[10px] font-bold">
                {adminData?.name?.charAt(0) || "A"}
              </div>
              <span className="text-xs font-semibold text-gray-700 hidden sm:block">
                {adminData?.name?.split(" ")[0] || "Admin"}
              </span>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}