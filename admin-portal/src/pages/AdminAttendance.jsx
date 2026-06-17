import { useEffect, useMemo, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Calendar,
  Building2,
  Clock3,
  RefreshCcw,
  Loader2,
  ShieldCheck,
  Edit3,
  Eye,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { db } from "../firebase/config";
import Layout from "../components/Layout";
import useAuthStore from "../store/authStore";

const formatDateInput = (date = new Date()) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatMonthInput = (date = new Date()) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
};

const getDayBounds = (dateStr) => {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { start, end };
};

const getMonthBounds = (monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

const getMonthDays = (monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();

  return Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month - 1, day);
    const dateKey = `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
    return { day, date, dateKey };
  });
};

const safeToDate = (value) => {
  if (!value) return null;
  if (value?.seconds) return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d) ? null : d;
};

const formatTimeOnly = (value) => {
  const d = safeToDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getEmployeeUidFromSession = (docSnap, data) => {
  if (data?.employeeUid) return data.employeeUid;
  if (data?.uid) return data.uid;
  if (data?.userId) return data.userId;

  const pathParts = docSnap.ref.path.split("/");
  return pathParts[1] || null;
};

const shouldReplaceSession = (prev, next) => {
  if (!prev) return true;

  const prevStart = safeToDate(prev.startTime);
  const nextStart = safeToDate(next.startTime);
  const prevEnd = safeToDate(prev.endTime);
  const nextEnd = safeToDate(next.endTime);

  if (!prevEnd && nextEnd) return true;
  if (prevEnd && nextEnd && nextEnd > prevEnd) return true;
  if (prevStart && nextStart && nextStart > prevStart) return true;

  return false;
};

const getOverrideDocId = (employeeUid, dateStr) => `${employeeUid}_${dateStr}`;

const getDateKey = (value) => {
  const d = safeToDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const StatCard = ({ label, value, Icon, color, bg }) => (
  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 min-w-0">
    <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
      <Icon size={18} className={color} />
    </div>
    <div className="min-w-0">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
    </div>
  </div>
);

const OverrideModal = ({ employee, date, onClose, onSave, loading }) => {
  const [status, setStatus] = useState(employee?.finalStatus || "present");
  const [reason, setReason] = useState(employee?.overrideReason || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ status, reason });
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
              <Edit3 size={16} className="text-sky-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-gray-900 truncate">
                Attendance Override
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {employee.name || "Employee"} • {date}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500 shrink-0"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872]"
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Reason
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this attendance?"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872]"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-[#1D7872] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Save Override
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MonthlyAttendanceModal = ({
  employee,
  month,
  onMonthChange,
  loading,
  attendanceByDate,
  onClose,
}) => {
  if (!employee) return null;

  const days = getMonthDays(month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, monthNum] = month.split("-").map(Number);

  const presentCount = days.filter((d) => attendanceByDate[d.dateKey] === "present").length;
  const absentCount = days.filter((d) => attendanceByDate[d.dateKey] === "absent").length;
  const noDataCount = days.filter((d) => !attendanceByDate[d.dateKey]).length;

  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const firstDayOffset = new Date(year, monthNum - 1, 1).getDay();

  const goMonth = (dir) => {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m - 1 + dir, 1);
    onMonthChange(formatMonthInput(next));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-6xl bg-white rounded-[28px] shadow-[0_25px_80px_-15px_rgba(15,23,42,0.35)] overflow-hidden max-h-[94vh] flex flex-col border border-slate-200">
        {/* top-right close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-2xl border border-slate-200 bg-white/95 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all shadow-sm"
        >
          ✕
        </button>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4 pr-14">
            <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">
                    Select Month
                  </p>
                  <h4 className="text-lg font-black text-slate-900">{monthLabel}</h4>
                  <p className="text-sm text-slate-500 mt-1">
                    Browse monthly attendance history and daily status.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {employee.name || "Employee"}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => goMonth(-1)}
                    className="w-11 h-11 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-all shadow-sm shrink-0"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="relative flex-1 min-w-[190px]">
                    <Calendar
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="month"
                      value={month}
                      onChange={(e) => onMonthChange(e.target.value)}
                      className="w-full h-11 border border-slate-200 rounded-2xl pl-10 pr-4 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872] shadow-sm"
                    />
                  </div>

                  <button
                    onClick={() => goMonth(1)}
                    className="w-11 h-11 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-all shadow-sm shrink-0"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 shadow-sm min-h-[122px]">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                </div>
                <p className="text-[30px] leading-none font-black text-emerald-600">{presentCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mt-2">
                  Present Days
                </p>
              </div>

              <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white px-4 py-3 shadow-sm min-h-[122px]">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center mb-2">
                  <XCircle size={15} className="text-rose-600" />
                </div>
                <p className="text-[30px] leading-none font-black text-rose-600">{absentCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mt-2">
                  Absent Days
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-3 shadow-sm min-h-[122px]">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center mb-2">
                  <CalendarDays size={15} className="text-slate-600" />
                </div>
                <p className="text-[30px] leading-none font-black text-slate-700">{noDataCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-2">
                  No Data / Future
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-full bg-emerald-400 ring-4 ring-emerald-100" />
                Present
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-full bg-rose-400 ring-4 ring-rose-100" />
                Absent
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-full bg-slate-300 ring-4 ring-slate-100" />
                No Data / Future
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="w-3 h-3 rounded-full bg-[#1D7872] ring-4 ring-[#1D7872]/10" />
                Today
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 flex items-center justify-center gap-3 text-slate-500 shadow-sm">
              <Loader2 size={18} className="animate-spin" />
              Loading monthly attendance...
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm">
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-[11px] sm:text-xs font-black uppercase tracking-[0.18em] text-slate-400 py-2"
                  >
                    {day}
                  </div>
                ))}

                {Array.from({ length: firstDayOffset }, (_, i) => (
                  <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px]" />
                ))}

                {days.map((d) => {
                  const status = attendanceByDate[d.dateKey] || null;
                  const isToday = d.date.toDateString() === today.toDateString();

                  const baseClass =
                    status === "present"
                      ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                      : status === "absent"
                      ? "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
                      : "border-slate-200 bg-gradient-to-br from-slate-50 to-white";

                  return (
                    <div
                      key={d.dateKey}
                      className={`relative rounded-3xl border p-3 sm:p-3.5 min-h-[88px] sm:min-h-[108px] transition-all shadow-sm hover:shadow-md ${baseClass} ${
                        isToday ? "ring-2 ring-[#1D7872]/20 border-[#1D7872]/30" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-col">
                          <p className="text-sm sm:text-base font-black text-slate-800 leading-none">
                            {d.day}
                          </p>
                          <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1">
                            {d.date.toLocaleDateString("en-IN", { weekday: "short" })}
                          </span>
                        </div>

                        {isToday && (
                          <span className="inline-flex items-center rounded-full bg-[#1D7872] text-white text-[10px] font-black px-2 py-1 shadow-sm">
                            Today
                          </span>
                        )}
                      </div>

                      {status === "present" ? (
                        <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-emerald-700 bg-white/90 border border-emerald-200 rounded-full px-2.5 py-1 shadow-sm">
                          <CheckCircle2 size={12} />
                          Present
                        </div>
                      ) : status === "absent" ? (
                        <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-rose-700 bg-white/90 border border-rose-200 rounded-full px-2.5 py-1 shadow-sm">
                          <XCircle size={12} />
                          Absent
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-500 bg-white/80 border border-slate-200 rounded-full px-2.5 py-1">
                          <CalendarDays size={12} />
                          No data
                        </div>
                      )}

                      <div className="absolute right-3 bottom-3">
                        <span
                          className={`block w-2.5 h-2.5 rounded-full ${
                            status === "present"
                              ? "bg-emerald-400"
                              : status === "absent"
                              ? "bg-rose-400"
                              : "bg-slate-300"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminAttendance = () => {
  const { userData, user } = useAuthStore();

  const [employees, setEmployees] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [overrideMap, setOverrideMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [savingOverride, setSavingOverride] = useState(false);

  const [monthlyEmployee, setMonthlyEmployee] = useState(null);
  const [monthlyViewMonth, setMonthlyViewMonth] = useState(formatMonthInput());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyAttendanceMap, setMonthlyAttendanceMap] = useState({});

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const employeesSnap = await getDocs(
        query(collection(db, "employees"), orderBy("name", "asc"))
      );

      const employeeList = employeesSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const { start, end } = getDayBounds(selectedDate);

      const sessionsSnap = await getDocs(
        query(
          collectionGroup(db, "sessions"),
          where("startTime", ">=", start),
          where("startTime", "<=", end)
        )
      );

      const dailyAttendance = {};
      sessionsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const employeeUid = getEmployeeUidFromSession(docSnap, data);
        if (!employeeUid) return;

        const nextSession = {
          ...data,
          sessionId: docSnap.id,
          employeeUid,
        };

        const prevSession = dailyAttendance[employeeUid];
        if (shouldReplaceSession(prevSession, nextSession)) {
          dailyAttendance[employeeUid] = nextSession;
        }
      });

      const overrideEntries = await Promise.all(
        employeeList.map(async (emp) => {
          const employeeUid = emp.uid || emp.employeeUid || emp.id;
          const overrideRef = doc(
            db,
            "attendanceOverrides",
            getOverrideDocId(employeeUid, selectedDate)
          );
          const overrideSnap = await getDoc(overrideRef);
          return {
            employeeUid,
            exists: overrideSnap.exists(),
            data: overrideSnap.exists() ? overrideSnap.data() : null,
          };
        })
      );

      const nextOverrideMap = {};
      overrideEntries.forEach((entry) => {
        if (entry.exists) {
          nextOverrideMap[entry.employeeUid] = entry.data;
        }
      });

      setEmployees(employeeList);
      setAttendanceMap(dailyAttendance);
      setOverrideMap(nextOverrideMap);
    } catch (error) {
      console.error("Failed to load admin attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyAttendance = async (employee, monthStr) => {
    if (!employee) return;

    setMonthlyLoading(true);
    try {
      const employeeUid = employee.employeeUid || employee.uid || employee.id;
      const { start, end } = getMonthBounds(monthStr);

      const sessionsSnap = await getDocs(
        query(
          collectionGroup(db, "sessions"),
          where("startTime", ">=", start),
          where("startTime", "<=", end)
        )
      );

      const sessionMap = {};
      sessionsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = getEmployeeUidFromSession(docSnap, data);
        if (uid !== employeeUid) return;

        const dateKey = getDateKey(data.startTime);
        if (!dateKey) return;

        const nextSession = {
          ...data,
          sessionId: docSnap.id,
          employeeUid: uid,
        };

        const prevSession = sessionMap[dateKey];
        if (shouldReplaceSession(prevSession, nextSession)) {
          sessionMap[dateKey] = nextSession;
        }
      });

      const days = getMonthDays(monthStr);
      const overrides = await Promise.all(
        days.map(async (d) => {
          const overrideRef = doc(
            db,
            "attendanceOverrides",
            getOverrideDocId(employeeUid, d.dateKey)
          );
          const snap = await getDoc(overrideRef);
          return {
            dateKey: d.dateKey,
            exists: snap.exists(),
            data: snap.exists() ? snap.data() : null,
          };
        })
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const nextMonthlyMap = {};

      days.forEach((d) => {
        const overrideEntry = overrides.find((o) => o.dateKey === d.dateKey);

        if (overrideEntry?.exists && overrideEntry.data?.status) {
          nextMonthlyMap[d.dateKey] = overrideEntry.data.status;
          return;
        }

        if (sessionMap[d.dateKey]) {
          nextMonthlyMap[d.dateKey] = "present";
          return;
        }

        const currentDay = new Date(d.date);
        currentDay.setHours(0, 0, 0, 0);

        if (currentDay <= today) {
          nextMonthlyMap[d.dateKey] = "absent";
        }
      });

      setMonthlyAttendanceMap(nextMonthlyMap);
    } catch (error) {
      console.error("Failed to load monthly attendance:", error);
      setMonthlyAttendanceMap({});
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  useEffect(() => {
    if (monthlyEmployee) {
      loadMonthlyAttendance(monthlyEmployee, monthlyViewMonth);
    }
  }, [monthlyEmployee, monthlyViewMonth]);

  const departments = useMemo(() => {
    const unique = new Set(employees.map((e) => e.department).filter(Boolean));
    return ["all", ...Array.from(unique)];
  }, [employees]);

  const mergedEmployees = useMemo(() => {
    return employees.map((emp) => {
      const employeeUid = emp.uid || emp.employeeUid || emp.id;

      const attendance =
        attendanceMap[emp.id] ||
        attendanceMap[emp.uid] ||
        attendanceMap[emp.employeeUid] ||
        attendanceMap[employeeUid] ||
        null;

      const override =
        overrideMap[emp.id] ||
        overrideMap[emp.uid] ||
        overrideMap[emp.employeeUid] ||
        overrideMap[employeeUid] ||
        null;

      const sessionPresent = !!attendance;
      const finalStatus = override?.status || (sessionPresent ? "present" : "absent");

      return {
        ...emp,
        employeeUid,
        attendance,
        sessionPresent,
        present: finalStatus === "present",
        finalStatus,
        overrideApplied: !!override,
        overrideReason: override?.reason || "",
        overrideData: override || null,
      };
    });
  }, [employees, attendanceMap, overrideMap]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();

    return mergedEmployees.filter((emp) => {
      const matchesSearch =
        !term ||
        emp.name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term) ||
        emp.role?.toLowerCase().includes(term) ||
        emp.department?.toLowerCase().includes(term);

      const matchesDepartment =
        departmentFilter === "all" || emp.department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "present" && emp.finalStatus === "present") ||
        (statusFilter === "absent" && emp.finalStatus === "absent");

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [mergedEmployees, search, departmentFilter, statusFilter]);

  const stats = {
    total: mergedEmployees.length,
    present: mergedEmployees.filter((e) => e.finalStatus === "present").length,
    absent: mergedEmployees.filter((e) => e.finalStatus === "absent").length,
    attendanceRate:
      mergedEmployees.length > 0
        ? Math.round(
            (mergedEmployees.filter((e) => e.finalStatus === "present").length /
              mergedEmployees.length) *
              100
          )
        : 0,
  };

  const handleOpenOverride = (employee, status) => {
    setSelectedEmployee({
      ...employee,
      finalStatus: status,
      overrideReason: employee.overrideReason || "",
    });
  };

  const handleOpenMonthlyView = (employee) => {
    setMonthlyEmployee(employee);
    setMonthlyViewMonth(selectedDate.slice(0, 7));
  };

  const handleSaveOverride = async ({ status, reason }) => {
    if (!selectedEmployee) return;

    setSavingOverride(true);
    setActionLoadingId(selectedEmployee.id);

    try {
      const employeeUid =
        selectedEmployee.employeeUid || selectedEmployee.uid || selectedEmployee.id;

      const overrideRef = doc(
        db,
        "attendanceOverrides",
        getOverrideDocId(employeeUid, selectedDate)
      );

      await setDoc(
        overrideRef,
        {
          employeeUid,
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name || "",
          selectedDate,
          status,
          reason: reason?.trim() || "",
          markedBy: user?.uid || null,
          markedByName: userData?.name || "Admin",
          updatedAt: serverTimestamp(),
          createdAt: selectedEmployee.overrideData?.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      setOverrideMap((prev) => ({
        ...prev,
        [employeeUid]: {
          employeeUid,
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name || "",
          selectedDate,
          status,
          reason: reason?.trim() || "",
          markedBy: user?.uid || null,
          markedByName: userData?.name || "Admin",
          createdAt: selectedEmployee.overrideData?.createdAt || new Date(),
        },
      }));

      setSelectedEmployee(null);
    } catch (error) {
      console.error("Failed to save attendance override:", error);
    } finally {
      setSavingOverride(false);
      setActionLoadingId(null);
    }
  };

  return (
    <Layout title="Attendance">
      <div className="px-5 py-5 space-y-5 overflow-x-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-gray-900 break-words">
              Employee Attendance
            </h1>
            <p className="text-sm text-gray-500 mt-1 break-words">
              Admin can view and override present or absent status for the selected date
            </p>
          </div>

          <button
            onClick={loadAttendance}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D7872] text-white text-sm font-bold hover:opacity-90 transition-all shadow-sm shrink-0"
          >
            <RefreshCcw size={15} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
          <StatCard
            label="Total Employees"
            value={stats.total}
            Icon={Users}
            color="text-indigo-600"
            bg="bg-indigo-50"
          />
          <StatCard
            label="Present"
            value={stats.present}
            Icon={UserCheck}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <StatCard
            label="Absent"
            value={stats.absent}
            Icon={UserX}
            color="text-red-600"
            bg="bg-red-50"
          />
          <StatCard
            label="Attendance Rate"
            value={`${stats.attendanceRate}%`}
            Icon={Clock3}
            color="text-amber-600"
            bg="bg-amber-50"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative min-w-0">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872]"
              />
            </div>

            <div className="relative min-w-0">
              <Building2
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872]"
              >
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep === "all" ? "All Departments" : dep}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872]"
              >
                <option value="all">All Status</option>
                <option value="present">Present Only</option>
                <option value="absent">Absent Only</option>
              </select>
            </div>

            <div className="relative min-w-0">
              <Calendar
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872]"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm flex items-center justify-center gap-3 text-gray-500 overflow-hidden">
            <Loader2 size={18} className="animate-spin" />
            Loading attendance...
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-black text-gray-900">Employee List</h2>
              <p className="text-xs text-gray-500 mt-1">
                Attendance list for {selectedDate}
              </p>
            </div>

            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed border-collapse">
                <thead className="bg-gray-50">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-[320px]">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-[120px]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-[120px]">
                      Check In
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-[120px]">
                      Check Out
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-[320px]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-gray-400 font-medium"
                      >
                        No employees found
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const isPresent = emp.finalStatus === "present";
                      const checkIn = formatTimeOnly(emp.attendance?.startTime);
                      const checkOut = formatTimeOnly(emp.attendance?.endTime);

                      return (
                        <tr key={emp.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="px-4 py-4 align-middle">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {emp.name || "—"}
                              </p>
                              <div className="flex flex-col gap-1 mt-1">
                                {emp.email && (
                                  <span className="text-xs text-gray-500 truncate">
                                    {emp.email}
                                  </span>
                                )}
                                {emp.department && (
                                  <span className="text-[11px] font-semibold text-gray-400">
                                    {emp.department}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-middle">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                                isPresent
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {isPresent ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                              {isPresent ? "Present" : "Absent"}
                            </span>
                          </td>

                          <td className="px-4 py-4 align-middle text-sm font-semibold text-gray-700">
                            {checkIn}
                          </td>

                          <td className="px-4 py-4 align-middle text-sm font-semibold text-gray-700">
                            {checkOut}
                          </td>

                          <td className="px-4 py-4 align-middle">
                            <div className="min-w-[260px] flex flex-col gap-2">
                              <button
                                onClick={() => handleOpenOverride(emp, "present")}
                                disabled={actionLoadingId === emp.id}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 disabled:opacity-50 whitespace-nowrap"
                              >
                                {actionLoadingId === emp.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={13} />
                                )}
                                Present
                              </button>

                              <button
                                onClick={() => handleOpenOverride(emp, "absent")}
                                disabled={actionLoadingId === emp.id}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 whitespace-nowrap"
                              >
                                {actionLoadingId === emp.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <XCircle size={13} />
                                )}
                                Absent
                              </button>

                              <button
                                onClick={() => handleOpenMonthlyView(emp)}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border border-[#85B7EB] bg-[#E6F1FB] hover:bg-[#dcecff] text-[#1D7872] whitespace-nowrap"
                              >
                                <Eye size={13} />
                                Monthly Attendance
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedEmployee && (
        <OverrideModal
          employee={selectedEmployee}
          date={selectedDate}
          onClose={() => setSelectedEmployee(null)}
          onSave={handleSaveOverride}
          loading={savingOverride}
        />
      )}

      {monthlyEmployee && (
        <MonthlyAttendanceModal
          employee={monthlyEmployee}
          month={monthlyViewMonth}
          onMonthChange={setMonthlyViewMonth}
          loading={monthlyLoading}
          attendanceByDate={monthlyAttendanceMap}
          onClose={() => {
            setMonthlyEmployee(null);
            setMonthlyAttendanceMap({});
          }}
        />
      )}
    </Layout>
  );
};

export default AdminAttendance;