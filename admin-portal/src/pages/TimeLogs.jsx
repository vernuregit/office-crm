import { useEffect, useState } from "react";
import {
  collection, collectionGroup, getDocs, doc,
  deleteDoc, query, orderBy
} from "firebase/firestore";
import { db } from "../firebase/config";
import Layout from "../components/Layout";
import {
  Clock, Search, Users, Timer,
  Calendar, Trash2,
  CheckCircle2, AlertCircle, X,
  TrendingUp, Activity, RefreshCw,
  ArrowLeft, ChevronRight
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


const toDateStr = (val) => {
  if (!val) return "";
  if (val?.toDate) return val.toDate().toISOString().slice(0, 10);
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return "";
};


const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};


const avatarGradients = [
  "from-violet-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-violet-600",
  "from-cyan-500 to-teal-600",
  "from-indigo-500 to-blue-600",
];
const getGradient = (name = "") => avatarGradients[(name.charCodeAt(0) || 0) % avatarGradients.length];



// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl
    shadow-2xl text-white text-sm font-semibold backdrop-blur-sm
    ${type === "success"
      ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-200"
      : "bg-gradient-to-r from-red-500 to-rose-500 shadow-red-200"
    }`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 hover:bg-white/20 rounded-lg p-0.5 transition-all">
      <X size={14} />
    </button>
  </div>
);



// ─── Delete Modal ─────────────────────────────────────────────────
const DeleteModal = ({ session, empName, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 flex items-center justify-center p-4">
    <div className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
      <div className="h-1.5 w-full bg-gradient-to-r from-red-400 via-rose-400 to-pink-400" />
      <div className="p-6 text-center">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200">
          <Trash2 size={22} className="text-white" />
        </div>
        <h3 className="text-base font-black text-gray-900 mb-1.5">Delete Session</h3>
        <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
          Remove <span className="text-gray-900 font-black">{empName}'s</span>{" "}
          session on <span className="text-gray-900 font-bold">{fmtDate(session?.date)}</span>?{" "}
          <span className="text-red-500 font-semibold">This cannot be undone.</span>
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-red-200">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  </div>
);



// ─── Employee Selection Card ──────────────────────────────────────
const EmpCard = ({ emp, totalMins, sessionCount, activeSessions, onClick }) => {
  const initials = emp.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const gradient = getGradient(emp.name);


  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white border border-gray-200 rounded-3xl overflow-hidden
        transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-gray-100
        hover:border-gray-300"
    >
      <div className={`h-1 w-full bg-gradient-to-r `} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br bg-black/70 flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 truncate">{emp.name}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{emp.department || "Employee"}</p>
            </div>
          </div>
          {activeSessions > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full
              bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          )}
        </div>


        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-blue-700 font-mono">{fmtDuration(totalMins) || "0m"}</p>
            <p className="text-xs text-blue-500 font-semibold mt-0.5">Total Time</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 text-center">
            <p className="text-lg font-black text-gray-700">{sessionCount}</p>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Sessions</p>
          </div>
        </div>


        <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
          <span>View time logs</span>
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform text-gray-400" />
        </div>
      </div>
    </button>
  );
};



// ─── Session Row ──────────────────────────────────────────────────
const SessionRow = ({ session, onDelete }) => {
  const isActive = session.status === "active";


  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      <td className="py-3.5 px-4">
        <p className="text-xs text-gray-500 font-medium">{fmtDate(session.date)}</p>
      </td>
      <td className="py-3.5 px-4 font-mono">
        <p className="text-xs text-gray-600">{fmtTime(session.startTime)}</p>
      </td>
      <td className="py-3.5 px-4 font-mono">
        <p className="text-xs text-gray-600">
          {isActive ? (
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Active
            </span>
          ) : fmtTime(session.endTime)}
        </p>
      </td>
      <td className="py-3.5 px-4">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border
          ${!isActive
            ? "bg-blue-50 border-blue-100 text-blue-600"
            : "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700"
          }`}>
          {isActive ? "Running…" : fmtDuration(session.duration)}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <p className="text-xs text-gray-400 max-w-[180px] truncate">{session.note || "—"}</p>
      </td>
      <td className="py-3.5 px-4 text-right">
        <button
          onClick={() => onDelete(session)}
          className="w-7 h-7 rounded-xl bg-gray-50 border border-gray-100 hover:bg-red-50 hover:border-red-200
            flex items-center justify-center text-gray-300 hover:text-red-500 transition-all ml-auto
            opacity-0 group-hover:opacity-100"
          aria-label="Delete session"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
};



// ─── Time Logs Page ───────────────────────────────────────────────
export default function TimeLogs() {
  const [employees, setEmployees] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [dateFrom, setDateFrom] = useState(weekAgo());
  const [dateTo, setDateTo] = useState(today());
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delLoading, setDelLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState("");


  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };


  const fetchAll = async () => {
    setLoading(true);
    setFetchError("");


    try {
      const empSnap = await getDocs(collection(db, "employees"));
      const emps = empSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setEmployees(emps);


      const sessionsSnap = await getDocs(
        query(collectionGroup(db, "sessions"), orderBy("startTime", "desc"))
      );


      const sessions = sessionsSnap.docs.map(d => {
        const parentDoc = d.ref.parent.parent;
        const employeeUid = parentDoc?.id || "";
        const emp = emps.find(e => e.uid === employeeUid);


        return {
          id: d.id,
          employeeUid,
          employeeName: emp?.name || d.data().employeeName || "Unknown Employee",
          ...d.data(),
        };
      });


      setAllSessions(sessions);


      if (sessions.length === 0) {
        setFetchError("No sessions found.");
      }
    } catch (err) {
      console.error("Time logs fetch error:", err);
      setFetchError("Failed to load time logs: " + (err.message || "Unknown error"));
      showToast("Failed to load time logs", "error");
    }


    setLoading(false);
  };


  useEffect(() => {
    fetchAll();
  }, []);


  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "timeLogs", deleteTarget.employeeUid, "sessions", deleteTarget.id));
      setAllSessions(prev => prev.filter(
        s => !(s.id === deleteTarget.id && s.employeeUid === deleteTarget.employeeUid)
      ));
      showToast("Session deleted");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete", "error");
    }
    setDelLoading(false);
    setDeleteTarget(null);
  };


  const empStats = employees.map(emp => {
    const sessions = allSessions.filter(s => s.employeeUid === emp.uid);
    return {
      emp,
      totalMins: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      sessionCount: sessions.length,
      activeSessions: sessions.filter(s => s.status === "active").length,
    };
  });


  const filtered = selectedEmp
    ? allSessions.filter(s => {
        if (s.employeeUid !== selectedEmp.uid) return false;
        const matchSearch = (s.note || "").toLowerCase().includes(search.toLowerCase());
        const sessionDate = s.date || toDateStr(s.startTime);
        const matchFrom = !dateFrom || sessionDate >= dateFrom;
        const matchTo = !dateTo || sessionDate <= dateTo;
        return matchSearch && matchFrom && matchTo;
      })
    : [];


  const selectedEmpStats = selectedEmp ? empStats.find(e => e.emp.uid === selectedEmp.uid) : null;
  const totalMinsFiltered = filtered.reduce((s, x) => s + (x.duration || 0), 0);
  const avgMins = (() => {
    const done = filtered.filter(s => s.status === "completed" && s.duration > 0);
    if (!done.length) return 0;
    return Math.round(done.reduce((s, x) => s + x.duration, 0) / done.length);
  })();


  const totalActiveSessions = allSessions.filter(s => s.status === "active").length;
  const totalHoursAll = allSessions.reduce((s, x) => s + (x.duration || 0), 0);


  const dateCls = `bg-white border border-gray-200 rounded-2xl px-3 py-2 text-xs text-gray-700
    focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all shadow-sm hover:border-gray-300`;


  if (!selectedEmp) {
    return (
      <Layout title="Time Logs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
          {[
            { label: "Total Hours", val: fmtDuration(totalHoursAll) || "0m", icon: Clock,    bg: "bg-blue-50",    color: "text-blue-600" },
            { label: "Employees",   val: employees.length,                    icon: Users,    bg: "bg-violet-50",  color: "text-violet-600" },
            { label: "Active Now",  val: totalActiveSessions,                 icon: Timer,    bg: "bg-emerald-50", color: "text-emerald-600" },
            { label: "All Sessions",val: allSessions.length,                  icon: Activity, bg: "bg-gray-100",   color: "text-gray-500" },
          ].map(s => (
            <div key={s.label}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xl font-black text-gray-900 leading-none mb-1 tabular-nums">{s.val}</p>
                <p className="text-xs text-gray-400 font-semibold">{s.label}</p>
              </div>
            </div>
          ))}
        </div>


        {fetchError && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-200">
              <AlertCircle size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">No sessions loaded</p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">{fetchError}</p>
            </div>
            <button onClick={fetchAll}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-3 py-1.5 rounded-xl transition-all">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}


        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-gray-400" />
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider">
              Select an Employee to View Logs
            </h2>
          </div>
          <button onClick={fetchAll}
            className="w-9 h-9 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-52 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-24 bg-white border border-gray-100 rounded-3xl shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-gray-400" />
            </div>
            <p className="text-sm font-black text-gray-600">No employees found</p>
            <p className="text-xs text-gray-400 font-medium mt-1">Add employees to start tracking time</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {empStats.map(({ emp, totalMins, sessionCount, activeSessions }) => (
              <EmpCard
                key={emp.uid}
                emp={emp}
                totalMins={totalMins}
                sessionCount={sessionCount}
                activeSessions={activeSessions}
                onClick={() => {
                  setSelectedEmp(emp);
                  setSearch("");
                  setDateFrom(weekAgo());
                  setDateTo(today());
                }}
              />
            ))}
          </div>
        )}


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


  const gradient = getGradient(selectedEmp.name);
  const initials = selectedEmp.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";


  return (
    <Layout title="Time Logs">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setSelectedEmp(null)}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900
            bg-white border border-gray-200 hover:border-gray-300 px-4 py-2.5 rounded-2xl
            transition-all shadow-sm hover:shadow-md">
          <ArrowLeft size={15} /> Back
        </button>


        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-lg`}>
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-gray-900 truncate">{selectedEmp.name}</h1>
            <p className="text-xs text-gray-400 font-medium">{selectedEmp.department || "Employee"} · Time Logs</p>
          </div>
        </div>


        <button onClick={fetchAll}
          className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm flex-shrink-0">
          <RefreshCw size={14} />
        </button>
      </div>


      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        {[
          { label: "Total Hours",  val: fmtDuration(selectedEmpStats?.totalMins) || "0m", icon: Clock,      bg: "bg-blue-50",    color: "text-blue-600" },
          { label: "Sessions",     val: selectedEmpStats?.sessionCount || 0,               icon: Activity,   bg: "bg-violet-50",  color: "text-violet-600" },
          { label: "Active Now",   val: selectedEmpStats?.activeSessions || 0,             icon: Timer,      bg: "bg-emerald-50", color: "text-emerald-600" },
          { label: "Avg. Session", val: fmtDuration(avgMins) || "—",                       icon: TrendingUp, bg: "bg-amber-50",   color: "text-amber-600" },
        ].map(s => (
          <div key={s.label}
            className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.color} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900 leading-none mb-1 tabular-nums">{s.val}</p>
              <p className="text-xs text-gray-400 font-semibold">{s.label}</p>
            </div>
          </div>
        ))}
      </div>


      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-gray-800
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30
              focus:border-blue-400 transition-all shadow-sm hover:border-gray-300"
          />
        </div>


        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-1.5 shadow-sm">
          <Calendar size={13} className="text-gray-400 flex-shrink-0" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={dateCls} />
          <span className="text-gray-300 text-xs">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={dateCls} />
        </div>


        <button
          onClick={() => {
            setDateFrom("");
            setDateTo("");
          }}
          className="text-xs font-bold text-gray-500 hover:text-gray-800 border border-gray-200 bg-white px-4 py-2.5 rounded-2xl transition-all shadow-sm hover:border-gray-300"
        >
          All Time
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
              <Clock size={28} className="text-gray-400" />
            </div>
            <p className="text-sm font-black text-gray-600">No sessions found</p>
            <p className="text-xs text-gray-400 font-medium mt-1">
              {allSessions.filter(s => s.employeeUid === selectedEmp.uid).length > 0
                ? "Try adjusting the date range or click \"All Time\""
                : "No clock-in sessions recorded yet for this employee"}
            </p>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="mt-3 text-blue-600 text-xs font-bold hover:underline"
              >
                Clear date filter →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {["Date", "Clock In", "Clock Out", "Duration", "Note", ""].map((h, i) => (
                    <th
                      key={h + i}
                      className={`py-3.5 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider
                        ${i === 5 ? "text-right" : "text-left"}`}
                    >
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
                    onDelete={s => setDeleteTarget(s)}
                  />
                ))}
              </tbody>
            </table>


            <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-3.5 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">
                {filtered.length} session{filtered.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs font-black text-blue-600 font-mono">
                Total: {fmtDuration(totalMinsFiltered) || "0m"}
              </p>
            </div>
          </div>
        )}
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