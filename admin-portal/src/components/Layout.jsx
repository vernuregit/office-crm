import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import useAuthStore from "../store/authStore";
import {
  LayoutDashboard, Users, UserSquare2, Link2,
  ClipboardList, FileText, CalendarClock,
  Settings, LogOut, Menu, X, ShieldCheck, ChevronRight,
  Clock,
} from "lucide-react";
import vinpro from "../assets/vinpro.jpg"
const NAV = [
  { to: "/",          icon: LayoutDashboard, label: "Dashboard"      },
  { to: "/employees", icon: Users,           label: "Employees"      },
  { to: "/clients",   icon: UserSquare2,     label: "Clients"        },
  { to: "/assign",    icon: Link2,           label: "Assign Client"  },
  { to: "/tasks",     icon: ClipboardList,   label: "Tasks"          },
  { to: "/invoices",  icon: FileText,        label: "Invoices"       },
  { to: "/leave",     icon: CalendarClock,   label: "Leave Requests" },
  { to: "/settings",  icon: Settings,        label: "Settings"       },
  { to: "/time-logs", icon: Clock,           label: "Time Logs"      },
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
        flex-col h-full bg-white border-r border-gray-100
        ${mobile ? "w-72" : "w-64"} flex-shrink-0
      `}
      style={{ boxShadow: "2px 0 8px rgba(0,0,0,0.04)" }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-10 h-10  flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-200">
          <img src={vinpro} alt="" />
        </div>
        <div>
          <p className="text-sm font-black text-gray-900 tracking-tight">Admin Portal</p>
          <p className="text-xs text-gray-400 font-medium">Management Panel</p>
        </div>
        {mobile && (
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* ── Navigation label ── */}
      <div className="px-5 pt-5 pb-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Navigation</p>
      </div>

      {/* ── Nav Links ── */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group
               ${isActive
                ? "bg-[#00A499] text-white shadow-sm shadow-blue-200"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={17}
                  className={
                    isActive
                      ? "text-white"
                      : "text-gray-400 group-hover:text-gray-700 transition-colors"
                  }
                />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="text-blue-200" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Admin Profile + Logout ── */}
      <div className="p-3 border-t border-gray-100">
        {/* Profile card */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#00A499] flex items-center justify-center text-white text-xs font-black flex-shrink-0 shadow-sm">
            {adminData?.name?.charAt(0) || "A"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">
              {adminData?.name || "Admin"}
            </p>
            <p className="text-xs text-gray-400 truncate">{adminData?.email || ""}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <LogOut size={17} />
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
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white flex-shrink-0"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setOpen(true)}
              className="lg:hidden text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-gray-400 font-medium">Home</span>
              <ChevronRight size={14} className="text-gray-300" />
              <span className="font-bold text-gray-800">{title}</span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2.5">
            {/* Date */}
            <span className="hidden sm:block text-xs text-gray-400 font-medium bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
              {new Date().toLocaleDateString("en-IN", {
                day:   "2-digit",
                month: "short",
                year:  "numeric",
              })}
            </span>

            <div className="w-px h-5 bg-gray-200" />

            {/* Avatar with name */}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 rounded-lg bg-[#00A499] flex items-center justify-center text-white text-[10px] font-black">
                {adminData?.name?.charAt(0) || "A"}
              </div>
              <span className="text-xs font-bold text-gray-700 hidden sm:block">
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