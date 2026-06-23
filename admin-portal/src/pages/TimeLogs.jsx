import { useEffect, useState } from "react";
import {
  collection, getDocs, doc,
  deleteDoc, query, orderBy
} from "firebase/firestore";
import { db }   from "../firebase/config";
import Layout   from "../components/Layout";
import {
  Clock, Search, Users, Timer,
  Calendar, Trash2,
  CheckCircle2, AlertCircle, X,
  TrendingUp, Activity, RefreshCw
} from "lucide-react";


// ─── Helpers ──────────────────────────────────────────────────────
const fmtDuration = (mins) => {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};

const fmtTime = (ts) => {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

const fmtDate = (val) => {
  if (!val) return "—";
  if (val?.toDate) return val.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Normalize any date value → "YYYY-MM-DD" for comparison
const toDateStr = (val) => {
  if (!val) return "";
  if (val?.toDate) return val.toDate().toISOString().slice(0, 10);
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return "";
};

const today   = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };


// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
    ${type === "success" ? "bg-emerald-500" : "bg-red-500"} text-white text-sm font-semibold`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
  </div>
);


// ─── Session Row ──────────────────────────────────────────────────
// Hook fields: startTime, endTime, duration, date, status
const SessionRow = ({ session, empName, onDelete }) => {
  const isActive = session.status === "active";
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      <td className="py-3 px-4">
        <p className="text-sm font-semibold text-gray-800">{empName}</p>
      </td>
      <td className="py-3 px-4">
        {/* date is stored as "YYYY-MM-DD" string by the hook */}
        <p className="text-xs text-gray-500 font-medium">{fmtDate(session.date)}</p>
      </td>
      <td className="py-3 px-4 font-mono">
        {/* hook stores startTime as Firestore Timestamp */}
        <p className="text-xs text-gray-600">{fmtTime(session.startTime)}</p>
      </td>
      <td className="py-3 px-4 font-mono">
        <p className="text-xs text-gray-600">
          {isActive
            ? <span className="text-emerald-600 font-bold">Active</span>
            : fmtTime(session.endTime)
          }
        </p>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
          ${!isActive
            ? "bg-blue-50 border-blue-100 text-blue-600"
            : "bg-emerald-50 border-emerald-100 text-emerald-600"
          }`}>
          {isActive ? "Running…" : fmtDuration(session.duration)}
        </span>
      </td>
      <td className="py-3 px-4">
        <p className="text-xs text-gray-400 max-w-[160px] truncate">{session.note || "—"}</p>
      </td>
      <td className="py-3 px-4 text-right">
        <button onClick={() => onDelete(session)}
          className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 hover:bg-red-50 hover:border-red-100
                     flex items-center justify-center text-gray-400 hover:text-red-500 transition-all ml-auto
                     opacity-0 group-hover:opacity-100"
          aria-label="Delete session">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
};


// ─── Employee Summary Card ────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-[#00A499]",
];

const EmpSummaryCard = ({ emp, totalMins, sessionCount, isSelected, onClick }) => {
  const initials = emp.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const color    = AVATAR_COLORS[emp.name?.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];

  return (
    <button onClick={onClick}
      className={`w-full text-left border rounded-2xl p-4 transition-all duration-200 shadow-sm
        ${isSelected
          ? "bg-blue-50 border-blue-200 shadow-blue-100"
          : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-md hover:shadow-gray-100/80"
        }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}>
          {initials}
        </div>
        <div className="min-w-0 ">
          <p className="text-sm font-bold text-gray-900 truncate">{emp.name}</p>
          <p className="text-xs text-gray-400">{emp.department || "Employee"}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-xl p-2.5 text-center border
          ${isSelected ? "bg-white border-blue-100" : "bg-gray-50 border-gray-100"}`}>
          <p className="text-base font-black text-blue-600 font-mono">{fmtDuration(totalMins) || "—"}</p>
          <p className="text-xs text-gray-400">Total Time</p>
        </div>
        <div className={`rounded-xl p-2.5 text-center border
          ${isSelected ? "bg-white border-blue-100" : "bg-gray-50 border-gray-100"}`}>
          <p className="text-base font-black text-gray-700">{sessionCount}</p>
          <p className="text-xs text-gray-400">Sessions</p>
        </div>
      </div>
    </button>
  );
};


// ─── Delete Confirm ───────────────────────────────────────────────
const DeleteModal = ({ session, empName, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={20} className="text-red-500" />
      </div>
      <h3 className="text-base font-black text-gray-900 mb-1">Delete Session</h3>
      <p className="text-sm text-gray-500 font-medium mb-6">
        Remove <span className="text-gray-900 font-bold">{empName}'s</span>{" "}
        session on <span className="text-gray-900 font-bold">{fmtDate(session?.date)}</span>?
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all">
          {loading ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);


// ─── Time Logs Page ───────────────────────────────────────────────
export default function TimeLogs() {
  const [employees,    setEmployees]    = useState([]);
  const [allSessions,  setAllSessions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [selectedEmp,  setSelectedEmp]  = useState("all");
  const [dateFrom,     setDateFrom]     = useState(weekAgo());
  const [dateTo,       setDateTo]       = useState(today());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delLoading,   setDelLoading]   = useState(false);
  const [toast,        setToast]        = useState(null);
  const [fetchError,   setFetchError]   = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    setLoading(true);
    setFetchError("");
    try {
      // 1. Load all employees
      const empSnap = await getDocs(collection(db, "employees"));
      const emps    = empSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setEmployees(emps);

      // 2. Fetch each employee's sessions from:
      //    timeLogs/{uid}/sessions  ← exact path useWorkTimer writes to
      const sessionPromises = emps.map(async (emp) => {
        try {
          const snap = await getDocs(
            query(
              collection(db, "timeLogs", emp.uid, "sessions"),
              orderBy("startTime", "desc")   // ← hook uses startTime, not clockIn
            )
          );
          return snap.docs.map(d => ({
            id:           d.id,
            employeeUid:  emp.uid,
            employeeName: emp.name,
            ...d.data(),
          }));
        } catch { return []; }
      });

      const nested = await Promise.all(sessionPromises);
      const sessions = nested.flat();

      // Sort newest first (startTime may be null on very new docs before Firestore resolves)
      sessions.sort((a, b) => {
        const aTs = a.startTime?.toDate?.().getTime() ?? 0;
        const bTs = b.startTime?.toDate?.().getTime() ?? 0;
        return bTs - aTs;
      });

      setAllSessions(sessions);

      if (sessions.length === 0) {
        setFetchError("No sessions found under timeLogs/{uid}/sessions. Make sure employees have clocked in.");
      }
    } catch (err) {
      console.error("TimeLogs fetch error:", err);
      setFetchError("Failed to load time logs: " + (err.message || "Unknown error"));
      showToast("Failed to load time logs", "error");
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "timeLogs", deleteTarget.employeeUid, "sessions", deleteTarget.id));
      setAllSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
      showToast("Session deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
    setDelLoading(false);
    setDeleteTarget(null);
  };

  // ── Filtering ─────────────────────────────────────────────────
  // session.date is a plain "YYYY-MM-DD" string (set by the hook)
  // so direct string comparison works perfectly here
  const filtered = allSessions.filter(s => {
    const matchEmp    = selectedEmp === "all" || s.employeeUid === selectedEmp;
    const matchSearch = s.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
                        s.note?.toLowerCase().includes(search.toLowerCase());
    const sessionDate = s.date || toDateStr(s.startTime); // fallback if date missing
    const matchFrom   = !dateFrom || sessionDate >= dateFrom;
    const matchTo     = !dateTo   || sessionDate <= dateTo;
    return matchEmp && matchSearch && matchFrom && matchTo;
  });

  const empTotals = employees.map(emp => {
    const empSessions = filtered.filter(s => s.employeeUid === emp.uid);
    return {
      emp,
      // only sum completed sessions (active ones have duration: null)
      totalMins:    empSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      sessionCount: empSessions.length,
    };
  }).filter(e => e.sessionCount > 0 || selectedEmp === e.emp.uid);

  const totalMinsAll   = filtered.reduce((s, x) => s + (x.duration || 0), 0);
  const activeSessions = allSessions.filter(s => s.status === "active").length;
  const avgMins        = (() => {
    const done = filtered.filter(s => s.status === "completed" && s.duration > 0);
    if (!done.length) return 0;
    return Math.round(done.reduce((s, x) => s + x.duration, 0) / done.length);
  })();

  const statCards = [
    { label: "Total Hours",  val: fmtDuration(totalMinsAll) || "0m", icon: Clock,      iconBg: "bg-blue-50",    iconBorder: "border-blue-100",    iconColor: "text-blue-600",    valColor: "text-blue-700"    },
    { label: "Sessions",     val: filtered.length,                    icon: Activity,   iconBg: "bg-gray-50",    iconBorder: "border-gray-200",    iconColor: "text-gray-500",    valColor: "text-gray-800"    },
    { label: "Active Now",   val: activeSessions,                     icon: Timer,      iconBg: "bg-emerald-50", iconBorder: "border-emerald-100", iconColor: "text-emerald-600", valColor: "text-emerald-700" },
    { label: "Avg. Session", val: fmtDuration(avgMins) || "—",        icon: TrendingUp, iconBg: "bg-indigo-50",  iconBorder: "border-indigo-100",  iconColor: "text-indigo-600",  valColor: "text-indigo-700"  },
  ];

  const dateCls = `bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700
                   focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all shadow-sm`;

  return (
    <Layout title="Time Logs">

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.iconBg} ${s.iconBorder} border flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div>
              <p className={`text-xl font-black font-mono ${s.valColor}`}>{s.val}</p>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error banner ── */}
      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-5 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-700">No sessions loaded</p>
            <p className="text-xs text-amber-600 font-medium mt-0.5">{fetchError}</p>
          </div>
          <button onClick={fetchAll}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100
                       hover:bg-amber-200 border border-amber-200 px-3 py-1.5 rounded-xl transition-all">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* ── LEFT: Employee Summaries ── */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users size={13} /> Employees
          </h2>

          <button onClick={() => setSelectedEmp("all")}
            className={`w-full text-left border rounded-2xl p-3.5 transition-all shadow-sm
              ${selectedEmp === "all"
                ? "bg-blue-50 border-blue-200 shadow-blue-100"
                : "bg-white border-gray-100 hover:border-gray-200"
              }`}>
            <p className="text-sm font-bold text-gray-900">All Employees</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              {employees.length} members · {fmtDuration(totalMinsAll) || "0m"}
            </p>
          </button>

          {loading
            ? [...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl h-24 border border-gray-100 animate-pulse" />
              ))
            : empTotals.length === 0
              ? employees.slice(0, 6).map(emp => (
                  <EmpSummaryCard key={emp.uid} emp={emp}
                    totalMins={0} sessionCount={0}
                    isSelected={selectedEmp === emp.uid}
                    onClick={() => setSelectedEmp(selectedEmp === emp.uid ? "all" : emp.uid)}
                  />
                ))
              : empTotals.map(({ emp, totalMins, sessionCount }) => (
                  <EmpSummaryCard key={emp.uid} emp={emp}
                    totalMins={totalMins} sessionCount={sessionCount}
                    isSelected={selectedEmp === emp.uid}
                    onClick={() => setSelectedEmp(selectedEmp === emp.uid ? "all" : emp.uid)}
                  />
                ))
          }
        </div>

        {/* ── RIGHT: Sessions Table ── */}
        <div className="lg:col-span-3">

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search employee or note…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800
                           placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                           focus:border-blue-400 transition-all shadow-sm" />
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-gray-400 flex-shrink-0" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={dateCls} />
              <span className="text-gray-300 text-xs">→</span>
              <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={dateCls} />
            </div>

            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs font-bold text-gray-400 hover:text-gray-700 border border-gray-200
                         bg-white px-3 py-2.5 rounded-xl transition-all shadow-sm">
              All Time
            </button>

            <button onClick={fetchAll}
              className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center
                         text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
                  <Clock size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">No sessions found</p>
                <p className="text-xs text-gray-400 font-medium mt-1">
                  {allSessions.length > 0
                    ? "Try adjusting the date range or click \"All Time\""
                    : "No clock-in sessions recorded yet"
                  }
                </p>
                {allSessions.length > 0 && (dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="mt-3 text-blue-600 text-xs font-bold hover:underline">
                    Clear date filter →
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      {["Employee", "Date", "Clock In", "Clock Out", "Duration", "Note", ""].map((h, i) => (
                        <th key={h + i} className={`py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider
                          ${i === 6 ? "text-right" : "text-left"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(session => (
                      <SessionRow
                        key={`${session.employeeUid}-${session.id}`}
                        session={session}
                        empName={session.employeeName}
                        onDelete={s => setDeleteTarget(s)}
                      />
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400 font-medium">
                    {filtered.length} session{filtered.length !== 1 ? "s" : ""}
                    {allSessions.length !== filtered.length && ` (${allSessions.length} total)`}
                  </p>
                  <p className="text-xs font-black text-blue-600 font-mono">
                    Total: {fmtDuration(totalMinsAll) || "0m"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteModal
          session={deleteTarget}
          empName={deleteTarget.employeeName}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={delLoading}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}