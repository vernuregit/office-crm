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
  TrendingUp,
  Mail,
  Briefcase,
  Clock,
} from "lucide-react";
import { db } from "../firebase/config";
import Layout from "../components/Layout";
import useAuthStore from "../store/authStore";

/* ─────────────────────── helpers ─────────────────────── */
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

const getDayBounds = (dateStr) => ({
  start: new Date(`${dateStr}T00:00:00`),
  end: new Date(`${dateStr}T23:59:59.999`),
});

const getMonthBounds = (monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
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
  if (!d) return null;
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
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

const getInitials = (name = "") =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

/* ─────────────────────── StatCard ─────────────────────── */
// Icon bg colors and text colors per card type — passed via iconBg / valueColor props
const StatCard = ({ label, value, Icon, iconBg, valueColor }) => (
  <div className="relative overflow-hidden rounded-2xl p-5 bg-white shadow-sm border border-gray-100">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className={`text-2xl font-black ${valueColor}`}>{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center `}>
        <Icon size={18} className="text-gray-500" />
      </div>
    </div>
  </div>
);

/* ─────────────────────── Employee Card ─────────────────────── */
const EmployeeCard = ({ emp, actionLoadingId, onOverride, onMonthlyView }) => {
  const isPresent = emp.finalStatus === "present";
  const checkIn = formatTimeOnly(emp.attendance?.startTime);
  const checkOut = formatTimeOnly(emp.attendance?.endTime);

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
      {/* Status accent bar */}
     
      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Avatar — always green brand color */}
          <div
            className="w-12 h-12 rounded-xl  bg-[#1D7872] flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm"
            
          >
            {getInitials(emp.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-gray-900 truncate">{emp.name || "—"}</h3>
            {emp.email && (
              <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                <Mail size={10} className="shrink-0" />
                {emp.email}
              </p>
            )}
            {emp.department && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                <Briefcase size={10} className="shrink-0" />
                {emp.department}
              </p>
            )}
          </div>
          {/* Status badge */}
          <span
            className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${
              isPresent
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {isPresent ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            {isPresent ? "Present" : "Absent"}
          </span>
        </div>

        {/* Time info — only shown when present */}
        {isPresent && (checkIn || checkOut) && (
          <div className="grid grid-cols-2 gap-2">
            {checkIn && (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-0.5">
                  Check In
                </p>
                <p className="text-sm font-black text-emerald-800 flex items-center gap-1">
                  <Clock size={11} />
                  {checkIn}
                </p>
              </div>
            )}
            {checkOut && (
              <div className="bg-sky-50/60 border border-sky-100 rounded-xl px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 mb-0.5">
                  Check Out
                </p>
                <p className="text-sm font-black text-sky-800 flex items-center gap-1">
                  <Clock size={11} />
                  {checkOut}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Override badge */}
        {emp.overrideApplied && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
            <ShieldCheck size={11} className="text-amber-600 shrink-0" />
            <span className="text-[11px] font-semibold text-amber-700 truncate">
              Override applied{emp.overrideReason ? ` · ${emp.overrideReason}` : ""}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            onClick={() => onOverride(emp, "present")}
            disabled={actionLoadingId === emp.id}
            className="flex flex-col cursor-pointer items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-bold border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 disabled:opacity-50 transition-colors"
          >
            {actionLoadingId === emp.id ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            Present
          </button>

          <button
            onClick={() => onOverride(emp, "absent")}
            disabled={actionLoadingId === emp.id}
            className="flex flex-col cursor-pointer items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-bold border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 disabled:opacity-50 transition-colors"
          >
            {actionLoadingId === emp.id ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <XCircle size={13} />
            )}
            Absent
          </button>

          <button
            onClick={() => onMonthlyView(emp)}
            className="flex flex-col cursor-pointer items-center justify-center gap-1 py-2.5 rounded-xl text-[10px] font-bold border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
          >
            <Eye size={13} />
            Monthly
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────── Override Modal ─────────────────────── */
const OverrideModal = ({ employee, date, onClose, onSave, loading }) => {
  const [status, setStatus] = useState(employee?.finalStatus || "present");
  const [reason, setReason] = useState(employee?.overrideReason || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ status, reason });
  };

  if (!employee) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#1D7872] to-[#145c57] px-6 py-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm transition-colors"
          >
            ✕
          </button>
          <div className="flex items-center gap-3">
            {/* Avatar in modal — always green */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg"
              style={{ background: "linear-gradient(135deg, #1D7872cc, #0d4a46cc)" }}
            >
              {getInitials(employee.name)}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Override Attendance</p>
              <h3 className="text-base font-black text-white">{employee.name || "Employee"}</h3>
              <p className="text-xs text-white/60">{date}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Set Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              {["present", "absent"].map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => setStatus(opt)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 flex items-center justify-center gap-2 transition-all ${
                    status === opt
                      ? opt === "present"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {opt === "present" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Reason <span className="text-gray-300 font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter a reason for this override..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872] focus:bg-white transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-br from-[#1D7872] to-[#145c57] text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
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

/* ─────────────────────── Monthly Modal ─────────────────────── */
const MonthlyAttendanceModal = ({ employee, month, onMonthChange, loading, attendanceByDate, onClose }) => {
  if (!employee) return null;

  const days = getMonthDays(month);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, monthNum] = month.split("-").map(Number);

  const presentCount = days.filter((d) => attendanceByDate[d.dateKey] === "present").length;
  const absentCount = days.filter((d) => attendanceByDate[d.dateKey] === "absent").length;
  const noDataCount = days.filter((d) => !attendanceByDate[d.dateKey]).length;

  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const firstDayOffset = new Date(year, monthNum - 1, 1).getDay();
  const attendanceRate = days.length > 0 ? Math.round((presentCount / (presentCount + absentCount || 1)) * 100) : 0;

  const goMonth = (dir) => {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(y, m - 1 + dir, 1);
    onMonthChange(formatMonthInput(next));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-5xl bg-white rounded-[28px] shadow-2xl overflow-hidden max-h-[94vh] flex flex-col border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1D7872] to-[#0f4a46] px-5 sm:px-6 py-5 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all text-sm"
          >
            ✕
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pr-10">
            <div className="flex items-center gap-3">
              {/* Avatar in monthly modal — always green */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-lg shrink-0"
                style={{ background: "linear-gradient(135deg, #1D7872cc, #0d4a46cc)" }}
              >
                {getInitials(employee.name)}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Monthly Attendance</p>
                <h3 className="text-base font-black text-white">{employee.name || "Employee"}</h3>
                {employee.department && <p className="text-xs text-white/60">{employee.department}</p>}
              </div>
            </div>

            <div className="sm:ml-auto flex items-center gap-2">
              <button onClick={() => goMonth(-1)} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all">
                <ChevronLeft size={16} />
              </button>
              <div className="relative">
                <input
                  type="month"
                  value={month}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="h-9 border-0 rounded-xl pl-4 pr-4 text-sm font-bold text-[#1D7872] bg-white focus:outline-none shadow-sm"
                />
              </div>
              <button onClick={() => goMonth(1)} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[
              { label: "Present", value: presentCount, color: "text-emerald-300" },
              { label: "Absent", value: absentCount, color: "text-rose-300" },
              { label: "No Data", value: noDataCount, color: "text-white/60" },
              { label: "Rate", value: `${attendanceRate}%`, color: "text-amber-300" },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 px-1">
            {[
              { label: "Present", dot: "bg-emerald-400", ring: "ring-emerald-100" },
              { label: "Absent", dot: "bg-rose-400", ring: "ring-rose-100" },
              { label: "No Data / Future", dot: "bg-slate-300", ring: "ring-slate-100" },
              { label: "Today", dot: "bg-[#1D7872]", ring: "ring-[#1D7872]/20" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className={`w-2.5 h-2.5 rounded-full ${l.dot} ring-4 ${l.ring}`} />
                {l.label}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-16 flex items-center justify-center gap-3 text-slate-400 shadow-sm border border-slate-200">
              <Loader2 size={18} className="animate-spin" />
              Loading monthly data…
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 py-2">
                    {d}
                  </div>
                ))}

                {Array.from({ length: firstDayOffset }, (_, i) => (
                  <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[90px]" />
                ))}

                {days.map((d) => {
                  const status = attendanceByDate[d.dateKey] || null;
                  const isToday = d.date.toDateString() === today.toDateString();

                  return (
                    <div
                      key={d.dateKey}
                      className={`relative rounded-2xl border p-2 sm:p-3 min-h-[70px] sm:min-h-[90px] transition-all ${
                        status === "present"
                          ? "border-emerald-200 bg-emerald-50/70"
                          : status === "absent"
                          ? "border-rose-200 bg-rose-50/70"
                          : "border-slate-200 bg-slate-50/70"
                      } ${isToday ? "ring-2 ring-[#1D7872]/25 border-[#1D7872]/40" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`text-sm font-black leading-none ${
                          status === "present" ? "text-emerald-800" : status === "absent" ? "text-rose-800" : "text-slate-600"
                        }`}>
                          {d.day}
                        </span>
                        {isToday && (
                          <span className="inline-flex items-center rounded-full bg-[#1D7872] text-white text-[9px] font-black px-1.5 py-0.5">
                            Today
                          </span>
                        )}
                      </div>

                      {status === "present" ? (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white/80 border border-emerald-200 rounded-full px-1.5 py-0.5">
                          <CheckCircle2 size={9} /> P
                        </div>
                      ) : status === "absent" ? (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-white/80 border border-rose-200 rounded-full px-1.5 py-0.5">
                          <XCircle size={9} /> A
                        </div>
                      ) : null}

                      <span
                        className={`absolute right-2 bottom-2 block w-2 h-2 rounded-full ${
                          status === "present" ? "bg-emerald-400" : status === "absent" ? "bg-rose-400" : "bg-slate-300"
                        }`}
                      />
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

/* ─────────────────────── Main Component ─────────────────────── */
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
      const employeesSnap = await getDocs(query(collection(db, "employees"), orderBy("name", "asc")));
      const employeeList = employeesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      const { start, end } = getDayBounds(selectedDate);

      const sessionsSnap = await getDocs(
        query(collectionGroup(db, "sessions"), where("startTime", ">=", start), where("startTime", "<=", end))
      );

      const dailyAttendance = {};
      sessionsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const employeeUid = getEmployeeUidFromSession(docSnap, data);
        if (!employeeUid) return;
        const nextSession = { ...data, sessionId: docSnap.id, employeeUid };
        if (shouldReplaceSession(dailyAttendance[employeeUid], nextSession)) {
          dailyAttendance[employeeUid] = nextSession;
        }
      });

      const overrideEntries = await Promise.all(
        employeeList.map(async (emp) => {
          const employeeUid = emp.uid || emp.employeeUid || emp.id;
          const overrideRef = doc(db, "attendanceOverrides", getOverrideDocId(employeeUid, selectedDate));
          const overrideSnap = await getDoc(overrideRef);
          return { employeeUid, exists: overrideSnap.exists(), data: overrideSnap.exists() ? overrideSnap.data() : null };
        })
      );

      const nextOverrideMap = {};
      overrideEntries.forEach((entry) => { if (entry.exists) nextOverrideMap[entry.employeeUid] = entry.data; });

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
        query(collectionGroup(db, "sessions"), where("startTime", ">=", start), where("startTime", "<=", end))
      );

      const sessionMap = {};
      sessionsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = getEmployeeUidFromSession(docSnap, data);
        if (uid !== employeeUid) return;
        const dateKey = getDateKey(data.startTime);
        if (!dateKey) return;
        const nextSession = { ...data, sessionId: docSnap.id, employeeUid: uid };
        if (shouldReplaceSession(sessionMap[dateKey], nextSession)) sessionMap[dateKey] = nextSession;
      });

      const days = getMonthDays(monthStr);
      const overrides = await Promise.all(
        days.map(async (d) => {
          const overrideRef = doc(db, "attendanceOverrides", getOverrideDocId(employeeUid, d.dateKey));
          const snap = await getDoc(overrideRef);
          return { dateKey: d.dateKey, exists: snap.exists(), data: snap.exists() ? snap.data() : null };
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
        if (sessionMap[d.dateKey]) { nextMonthlyMap[d.dateKey] = "present"; return; }
        const currentDay = new Date(d.date);
        currentDay.setHours(0, 0, 0, 0);
        if (currentDay <= today) nextMonthlyMap[d.dateKey] = "absent";
      });

      setMonthlyAttendanceMap(nextMonthlyMap);
    } catch (error) {
      console.error("Failed to load monthly attendance:", error);
      setMonthlyAttendanceMap({});
    } finally {
      setMonthlyLoading(false);
    }
  };

  useEffect(() => { loadAttendance(); }, [selectedDate]);
  useEffect(() => { if (monthlyEmployee) loadMonthlyAttendance(monthlyEmployee, monthlyViewMonth); }, [monthlyEmployee, monthlyViewMonth]);

  const departments = useMemo(() => {
    const unique = new Set(employees.map((e) => e.department).filter(Boolean));
    return ["all", ...Array.from(unique)];
  }, [employees]);

  const mergedEmployees = useMemo(() => {
    return employees.map((emp) => {
      const employeeUid = emp.uid || emp.employeeUid || emp.id;
      const attendance =
        attendanceMap[emp.id] || attendanceMap[emp.uid] || attendanceMap[emp.employeeUid] || attendanceMap[employeeUid] || null;
      const override =
        overrideMap[emp.id] || overrideMap[emp.uid] || overrideMap[emp.employeeUid] || overrideMap[employeeUid] || null;
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
      const matchesDepartment = departmentFilter === "all" || emp.department === departmentFilter;
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
        ? Math.round((mergedEmployees.filter((e) => e.finalStatus === "present").length / mergedEmployees.length) * 100)
        : 0,
  };

  const handleOpenOverride = (employee, status) =>
    setSelectedEmployee({ ...employee, finalStatus: status, overrideReason: employee.overrideReason || "" });

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
      selectedEmployee.employeeUid ||
      selectedEmployee.uid ||
      selectedEmployee.id;

    const cleanReason = reason?.trim() || "";
    const overrideDocId = getOverrideDocId(employeeUid, selectedDate);

    const payload = {
      employeeUid,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name || "",
      date: selectedDate,
      selectedDate,
      status,
      reason: cleanReason,
      markedBy: user?.uid || null,
      markedByName: userData?.name || "Admin",
      updatedAt: serverTimestamp(),
      createdAt: selectedEmployee.overrideData?.createdAt || serverTimestamp(),
    };

    await setDoc(
      doc(db, "attendanceOverrides", overrideDocId),
      payload,
      { merge: true }
    );

    setOverrideMap((prev) => ({
      ...prev,
      [employeeUid]: {
        ...payload,
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
};;

  const displayDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <Layout title="Attendance">
      <div className="px-5 py-5 space-y-6 overflow-x-hidden">

        {/* Page header */}
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#1D7872] mb-1">CRM Dashboard</p>
            <h1 className="text-2xl font-black text-gray-900">Employee Attendance</h1>
            <p className="text-sm text-gray-400 mt-1">{displayDate}</p>
          </div>
          <button
            onClick={loadAttendance}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#1D7872] to-[#145c57] text-white text-sm font-bold hover:opacity-90 transition-all shadow-md shrink-0"
          >
            <RefreshCcw size={14} />
            Refresh Data
          </button>
        </div>

        {/* Stat cards — white bg, colored icon pill + colored value text */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Employees"
            value={stats.total}
            Icon={Users}
            iconBg="bg-gray-400"
            valueColor="text-gray-700"
          />
          <StatCard
            label="Present Today"
            value={stats.present}
            Icon={UserCheck}
            iconBg="bg-[#1D7872]"
            valueColor="text-[#1D7872]"
          />
          <StatCard
            label="Absent Today"
            value={stats.absent}
            Icon={UserX}
            iconBg="bg-rose-500"
            valueColor="text-rose-600"
          />
          <StatCard
            label="Attendance Rate"
            value={`${stats.attendanceRate}%`}
            Icon={TrendingUp}
            iconBg="bg-amber-500"
            valueColor="text-amber-600"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872] bg-gray-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872] transition-colors appearance-none"
              >
                {departments.map((dep) => (
                  <option key={dep} value={dep}>{dep === "all" ? "All Departments" : dep}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <UserCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872] transition-colors appearance-none"
              >
                <option value="all">All Status</option>
                <option value="present">Present Only</option>
                <option value="absent">Absent Only</option>
              </select>
            </div>

            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20 focus:border-[#1D7872] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Employee grid */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 flex flex-col items-center justify-center gap-3 text-gray-400 shadow-sm">
            <Loader2 size={28} className="animate-spin text-[#1D7872]" />
            <p className="text-sm font-semibold">Loading attendance data…</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 flex flex-col items-center justify-center gap-3 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Users size={22} className="text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-500">No employees found</p>
            <p className="text-xs text-gray-400">Try adjusting your filters</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Showing {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  <CheckCircle2 size={10} /> {stats.present} Present
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
                  <XCircle size={10} /> {stats.absent} Absent
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  actionLoadingId={actionLoadingId}
                  onOverride={handleOpenOverride}
                  onMonthlyView={handleOpenMonthlyView}
                />
              ))}
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
          onClose={() => { setMonthlyEmployee(null); setMonthlyAttendanceMap({}); }}
        />
      )}
    </Layout>
  );
};

export default AdminAttendance;