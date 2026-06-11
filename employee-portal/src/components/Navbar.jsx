import { Bell }         from "lucide-react";
import useAuthStore     from "../store/authStore";

const Navbar = ({ title }) => {
  const { userData } = useAuthStore();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric",
    month: "long",  day: "numeric",
  });

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>
        <p className="text-xs text-gray-400 font-medium">{today}</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative w-9 h-9 rounded-xl bg-gray-50  flex items-center justify-center transition-colors">
          <Bell size={17} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-[#00A499] flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">
              {userData?.name?.charAt(0).toUpperCase() || "E"}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-tight">{userData?.name}</p>
            <p className="text-xs text-gray-600 font-medium">{userData?.designation || "Employee"}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
