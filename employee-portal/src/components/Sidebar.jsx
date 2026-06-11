import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { FolderOpen } from "lucide-react";
import {
  LayoutDashboard, ClipboardList, Users,
  Receipt, CalendarOff, User, LogOut, Building2,
  TicketCheck
} from "lucide-react";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "My Tasks", path: "/tasks", icon: ClipboardList },
  { label: "Clients", path: "/clients", icon: Users },
  { label: "Invoices", path: "/invoices", icon: Receipt },
  { label: "Documents", path: "/documents", icon: FolderOpen },
  { label: "Tickets", path: "/tickets", icon: TicketCheck },
  { label: "Leave", path: "/leave", icon: CalendarOff },
  { label: "Profile", path: "/profile", icon: User },

];

const Sidebar = () => {
  const navigate = useNavigate();
  const { userData } = useAuthStore();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm">

      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A499] flex items-center justify-center shadow-md">
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm tracking-tight">CA Firm</p>
            <p className="text-xs text-gray-600 font-medium">Employee Portal</p>
          </div>
        </div>
      </div>

      {/* Employee Card */}
      <div className="mx-4 my-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A499] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">
              {userData?.name?.charAt(0).toUpperCase() || "E"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{userData?.name}</p>
            <p className="text-xs text-gray-600 font-medium">{userData?.designation || "Employee"}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">
          Main Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer
                ${isActive
                  ? "bg-[#00A499] text-white shadow-md"
                  : "text-gray-500 hover:bg-indigo-50 hover:text-[#00A499]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} className={isActive ? "text-white" : "text-gray-400"} />
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
        >
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;