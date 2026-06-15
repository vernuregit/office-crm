import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db }          from "../firebase/config";
import useAuthStore    from "../store/authStore";
import Layout          from "../components/Layout";
import StatusBadge     from "../components/StatusBadge";
import { Search, CheckCircle2, Loader, ListTodo, Calendar, Flag } from "lucide-react";

// ─── Status Columns ───────────────────────────────────────────────
const statusColumns = [
  { key: "to-do",       label: "To Do",       Icon: ListTodo,     bg: "bg-violet-50  border-violet-200"  },
  { key: "in-progress", label: "In Progress", Icon: Loader,       bg: "bg-blue-50    border-blue-200"    },
  { key: "completed",   label: "Completed",   Icon: CheckCircle2, bg: "bg-emerald-50 border-emerald-200" },
];

const priorityConfig = {
  high:   { color: "text-red-500",     bg: "bg-red-50"     },
  medium: { color: "text-amber-500",   bg: "bg-amber-50"   },
  low:    { color: "text-emerald-500", bg: "bg-emerald-50" },
  urgent: { color: "text-red-600",     bg: "bg-red-50"     },
};

// ✅ FIX 1 — normalize admin Firestore status → display status
// Admin saves: "pending" | "in_progress" | "completed" | "cancelled"
// Client Kanban uses: "to-do" | "in-progress" | "completed"
const normalizeStatus = (s) => {
  if (!s || s === "pending")  return "to-do";
  if (s === "in_progress")    return "in-progress";
  if (s === "cancelled")      return "to-do";
  return s;
};

// ✅ FIX 2 — safe deadline/dueDate reader
// Admin saves dueDate as plain "YYYY-MM-DD" string, not a Firestore Timestamp
const getDeadlineDate = (task) => {
  if (!task) return null;
  if (task.dueDate)               return new Date(task.dueDate);
  if (task.deadline?.seconds)     return new Date(task.deadline.seconds * 1000);
  if (task.deadline instanceof Date) return task.deadline;
  return null;
};

const fmtDeadline = (task) => {
  const d = getDeadlineDate(task);
  if (!d || isNaN(d)) return "No deadline";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

// ─── Task Card ────────────────────────────────────────────────────
const TaskCard = ({ task }) => {
  const pConfig = priorityConfig[task.priority] || priorityConfig.low;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100
                    hover:shadow-[0_4px_20px_-2px_rgba(79,70,229,0.12)]
                    hover:-translate-y-0.5 transition-all duration-200">

      {/* Priority + Category */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2.5 py-0.5 rounded-full border border-gray-100 truncate max-w-[55%]">
          {task.category || "General"}
        </span>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${pConfig.bg} ${pConfig.color}`}>
          <Flag size={10} />
          {task.priority || "low"}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-bold text-gray-800 mb-1.5 leading-snug line-clamp-2">
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Assigned Employee */}
      {task.assignedToName && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-[#153485] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {task.assignedToName.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-gray-500 font-medium">{task.assignedToName}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
          <Calendar size={11} />
          {/* ✅ FIX 2 — safe deadline, handles both string and Timestamp */}
          {fmtDeadline(task)}
        </div>
        {/* ✅ FIX 1 — pass normalized status so StatusBadge gets the right value */}
        <StatusBadge status={normalizeStatus(task.status)} />
      </div>
    </div>
  );
};

// ─── Service Status Page ──────────────────────────────────────────
const ServiceStatus = () => {
  const { user }             = useAuthStore();
  const [tasks,          setTasks]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filterPriority, setFilterPriority] = useState("all");

  useEffect(() => {
    if (!user?.uid) return;

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "tasks"),
          where("clientId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("ServiceStatus fetch error:", err);
        
      }
      setLoading(false);
    };

    fetchTasks();
  }, [user?.uid]); // ✅ FIX 3 — stable dependency

  const filtered = tasks.filter(t => {
    const matchSearch   = t.title?.toLowerCase().includes(search.toLowerCase()) ||
                          t.description?.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    return matchSearch && matchPriority;
  });

  // ✅ FIX 1 — normalize status before grouping into columns
  const getByStatus = (colKey) =>
    filtered.filter(t => normalizeStatus(t.status) === colKey);

  const stats = {
    total:    tasks.length,
    todo:     tasks.filter(t => normalizeStatus(t.status) === "to-do").length,
    progress: tasks.filter(t => normalizeStatus(t.status) === "in-progress").length,
    done:     tasks.filter(t => normalizeStatus(t.status) === "completed").length,
  };

  return (
    <Layout title="Service Status">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Tasks", value: stats.total,    color: "text-gray-700",  bg: "bg-indigo-50"  },
          { label: "To Do",       value: stats.todo,     color: "text-gray-700",  bg: "bg-violet-50"  },
          { label: "In Progress", value: stats.progress, color: "text-gray-700",    bg: "bg-blue-50"    },
          { label: "Completed",   value: stats.done,     color: "text-gray-700", bg: "bg-emerald-50" },
        ].map(s => (
          <div key={s.label}
            className="bg-white rounded-2xl p-4 border border-gray-100
                       shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Priority Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border-[#153485]
                       transition-all bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "high", "medium", "low"].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer
                ${filterPriority === p
                  ? "bg-[#153485] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-[#153485]"
                }`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              {[...Array(3)].map((__, j) => (
                <div key={j} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        // ✅ Empty state — helps distinguish "no tasks assigned" from a bug
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
            <ListTodo size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-500">No tasks assigned yet</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Tasks linked to your account will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statusColumns.map(col => {
            const colTasks = getByStatus(col.key);
            return (
              <div key={col.key} className={`rounded-2xl border p-4 ${col.bg}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <col.Icon size={16} className="text-gray-600" />
                    <h3 className="font-bold text-sm text-gray-700">{col.label}</h3>
                  </div>
                  <span className="bg-white text-gray-600 text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm border border-gray-100">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-xs font-medium">
                      No tasks here
                    </div>
                  ) : (
                    colTasks.map(task => <TaskCard key={task.id} task={task} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
};

export default ServiceStatus;