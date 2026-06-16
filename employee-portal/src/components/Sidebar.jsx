import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import {
  LayoutDashboard, ClipboardList,
  TicketCheck, CalendarOff, User, LogOut, Building2,
} from "lucide-react";
import Halo from "../../public/halologo.png";
import Halowhite from "../../public/Logowhite.png";

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "My Tasks", path: "/tasks", icon: ClipboardList },
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
    <aside className="w-64 min-h-screen bg-[#1D7872] border-r border-gray-100 flex flex-col">


      {/* Logo */}
      <div className="px-5 py-0  flex justify-center">
        <img src={Halowhite} alt="Halo CRM" className="w-full h-full object-contain" />
      </div>
      {/* Nav */}
      <nav className="flex-1 px-3 pt-6 space-y-1">
        <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest px-3 mb-3">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-300 ease-out cursor-pointer
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
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-4  space-y-3 mt-32">
        {/* Mini user card */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-xl bg-[#1D7872]/10 border-2 border-white flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">
              {userData?.name?.charAt(0).toUpperCase() || "E"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {userData?.name || "Employee"}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {userData?.designation || "Employee"}
            </p>
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
};

export default Sidebar;