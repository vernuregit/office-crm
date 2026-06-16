import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, query,
  orderBy, limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import {
  Users, ClipboardList, CalendarClock,
  ArrowRight, Activity, Clock3,
  CheckCircle2, AlertCircle, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";



// ─── Helpers ──────────────────────────────────────────────────────
const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtShortDate = (value) => {
  if (!value) return { day: "—", month: "—" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { day: "—", month: "—" };
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit" }),
    month: d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
  };
};

const getDaysLeft = (date) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(date);
  due.setHours(0, 0, 0, 0);

  if (Number.isNaN(due.getTime())) return null;
  return Math.ceil((due - today) / 86400000);
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const avatarGradients = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

const getAvatarGradient = (name = "") => {
  const idx = name.charCodeAt(0) % avatarGradients.length;
  return avatarGradients[idx] || avatarGradients[0];
};



// ─── Stat Card ────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, loading }) => (
  <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
    {loading ? (
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-20 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <p className="text-3xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
          <p className="text-xs font-semibold text-gray-500 mt-1">{label}</p>
          {sub && <p className="text-[11px] text-emerald-600 font-semibold mt-1">{sub}</p>}
        </div>
      </div>
    )}
  </div>
);



// ─── Small components ─────────────────────────────────────────────
const SectionCard = ({ title, actionLabel, onAction, rightText, children }) => (
  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
      <h3 className="text-sm font-black text-gray-900">{title}</h3>
      {onAction ? (
        <button
          onClick={onAction}
          className="text-xs font-bold text-[#2F6FED] hover:text-[#1f56c8] flex items-center gap-1 cursor-pointer"
        >
          {actionLabel} <ArrowRight size={12} />
        </button>
      ) : (
        <span className="text-xs font-semibold text-gray-400">{rightText}</span>
      )}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const TaskStatusBadge = ({ status }) => {
  const map = {
    todo: "bg-gray-100 text-gray-600",
    "in-progress": "bg-blue-100 text-blue-600",
    inprogress: "bg-blue-100 text-blue-600",
    review: "bg-violet-100 text-violet-600",
    done: "bg-emerald-100 text-emerald-600",
    completed: "bg-emerald-100 text-emerald-600",
  };
  const labels = {
    todo: "To Do",
    "in-progress": "In Progress",
    inprogress: "In Progress",
    review: "Review",
    done: "Done",
    completed: "Done",
  };
  const key = (status || "todo").toLowerCase();
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${map[key] || map.todo}`}>
      {labels[key] || "To Do"}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const map = {
    low: "bg-emerald-50 text-emerald-600",
    medium: "bg-amber-50 text-amber-600",
    high: "bg-rose-50 text-rose-500",
    urgent: "bg-red-50 text-red-600",
  };
  const label = priority ? priority[0].toUpperCase() + priority.slice(1) : "Medium";
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${map[priority] || map.medium}`}>
      {label}
    </span>
  );
};

const LeaveCountdownBadge = ({ daysLeft }) => {
  if (daysLeft == null) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">
        No date
      </span>
    );
  }

  if (daysLeft < 0) {
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-500">
        Overdue
      </span>
    );
  }

  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-500">
      {daysLeft === 0 ? "Today" : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`}
    </span>
  );
};



// ─── Tooltips ─────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="text-sm font-black text-gray-900">{payload[0].value}</p>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2">
      <p className="text-xs font-bold text-gray-500">{payload[0].name}</p>
      <p className="text-sm font-black text-gray-900">{payload[0].value}</p>
    </div>
  );
};



// ─── Dashboard Page ───────────────────────────────────────────────
export default function Dashboard() {
  const { adminData } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    employees: 0,
    tasks: 0,
    pendingLeave: 0,
  });
  const [taskStats, setTaskStats] = useState({
    todo: 0,
    inprogress: 0,
    review: 0,
    done: 0,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [empSnap, taskSnap, leaveSnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "tasks")),
          getDocs(query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"), limit(5))),
        ]);

        const pendingLeave = leaveSnap.docs.filter((d) => d.data().status === "pending").length;

        setStats({
          employees: empSnap.size,
          tasks: taskSnap.size,
          pendingLeave,
        });

        const allTasks = taskSnap.docs.map((d) => d.data());
        const taskCounts = allTasks.reduce(
          (acc, t) => {
            const s = (t.status || "todo").toLowerCase();
            if (s === "done" || s === "completed") acc.done++;
            else if (s === "review") acc.review++;
            else if (s === "in-progress" || s === "inprogress") acc.inprogress++;
            else acc.todo++;
            return acc;
          },
          { todo: 0, inprogress: 0, review: 0, done: 0 }
        );
        setTaskStats(taskCounts);

        const tSnap = await getDocs(
          query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(5))
        );

        setRecentTasks(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setRecentLeaves(leaveSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
      setLoading(false);
    };

    fetchAll();
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    "Good evening";

  const weeklyBarData = [
    { name: "Mon", value: Math.max(0, Math.round(stats.tasks * 0.15)) },
    { name: "Tue", value: Math.max(0, Math.round(stats.tasks * 0.18)) },
    { name: "Wed", value: Math.max(0, Math.round(stats.tasks * 0.2)) },
    { name: "Thu", value: Math.max(0, Math.round(stats.tasks * 0.22)) },
    { name: "Fri", value: Math.max(0, Math.round(stats.tasks * 0.17)) },
    { name: "Sat", value: Math.max(0, Math.round(stats.tasks * 0.08)) },
    { name: "Sun", value: 0 },
  ];

  const pieData = useMemo(() => {
    const colors = {
      todo: "#3B82F6",
      inprogress: "#F59E0B",
      review: "#8B5CF6",
      done: "#22C55E",
    };

    const total = taskStats.todo + taskStats.inprogress + taskStats.review + taskStats.done;

    return [
      { name: "To Do", value: taskStats.todo, color: colors.todo },
      { name: "In Progress", value: taskStats.inprogress, color: colors.inprogress },
      { name: "Review", value: taskStats.review, color: colors.review },
      { name: "Done", value: taskStats.done, color: colors.done },
    ]
      .filter((d) => d.value > 0)
      .map((d) => ({
        ...d,
        percent: total ? ((d.value / total) * 100).toFixed(1) : "0.0",
      }));
  }, [taskStats]);

  const pieTotal = taskStats.todo + taskStats.inprogress + taskStats.review + taskStats.done;

  return (
    <Layout title="Dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {greeting}, {adminData?.name?.split(" ")[0] || "Admin"} — track your team activity at a glance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Employees"
          value={stats.employees}
          sub="+ Team size"
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          loading={loading}
        />
        <StatCard
          icon={ClipboardList}
          label="Total Tasks"
          value={stats.tasks}
          sub="+ Active workload"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          loading={loading}
        />
        <StatCard
          icon={CalendarClock}
          label="Pending Leaves"
          value={stats.pendingLeave}
          sub={stats.pendingLeave > 0 ? `${stats.pendingLeave} awaiting action` : "All clear"}
          iconBg="bg-rose-100"
          iconColor="text-rose-500"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="xl:col-span-2">
          <SectionCard title="Attendance Overview" rightText="This Week">
            {loading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyBarData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "#eff6ff" }} />
                  <Bar dataKey="value" fill="#2F6FED" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Tasks by Status" actionLabel="View all" onAction={() => navigate("/tasks")}>
          {loading ? (
            <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
          ) : pieTotal === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm font-medium text-gray-400">
              No task data available
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] items-center gap-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={84}
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                        <tspan x="50%" dy="-4" style={{ fontSize: 28, fontWeight: 900, fill: "#111827" }}>
                          {pieTotal}
                        </tspan>
                        <tspan x="50%" dy="22" style={{ fontSize: 12, fontWeight: 600, fill: "#9ca3af" }}>
                          Total
                        </tspan>
                      </text>
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="text-sm font-semibold text-gray-700 truncate">{item.name}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-500 whitespace-nowrap">
                      {item.value} ({item.percent}%)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        <SectionCard title="Recent Tasks" actionLabel="View all" onAction={() => navigate("/tasks")}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={30} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-500">No tasks yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Task</th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Assignee</th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Priority</th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr key={task.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-4">
                        <p className="text-sm font-bold text-gray-800">{task.title}</p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarGradient(task.assignedToName || "User")} flex items-center justify-center text-white text-[10px] font-black`}>
                            {getInitials(task.assignedToName || "U")}
                          </div>
                          <span className="text-sm text-gray-700 font-semibold">
                            {task.assignedToName || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4">
                        <TaskStatusBadge status={task.status} />
                      </td>
                      <td className="py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="py-4">
                        <span className="text-sm text-gray-600 font-semibold">
                          {fmtDate(task.dueDate)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Upcoming Deadlines" actionLabel="View all" onAction={() => navigate("/leaves")}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentLeaves.length === 0 ? (
            <div className="text-center py-16">
              <CalendarClock size={30} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-500">No leave requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLeaves.map((leave) => {
                const dateInfo = fmtShortDate(leave.fromDate || leave.toDate);
                const daysLeft = getDaysLeft(leave.fromDate || leave.toDate);

                return (
                  <div
                    key={leave.id}
                    className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-base leading-none font-black text-gray-800">{dateInfo.day}</span>
                      <span className="text-[10px] leading-none mt-1 font-bold text-gray-400">{dateInfo.month}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">
                        {leave.employeeName || "Employee"}
                      </p>
                      <p className="text-xs text-gray-400 font-medium truncate">
                        {leave.type || "Leave request"}
                      </p>
                    </div>

                    <LeaveCountdownBadge daysLeft={daysLeft} />
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </Layout>
  );
}