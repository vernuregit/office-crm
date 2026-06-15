import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, getDocs, query,
  orderBy, limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import {
  Users, UserSquare2, ClipboardList,
  FileText, CalendarClock, TrendingUp,
  ArrowRight, Link2, Plus,
  Activity, IndianRupee,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";


// ─── Stat Card ────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color, loading }) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-3 rounded-xl flex items-center justify-center ${color}`} />
    </div>
    {loading ? (
      <div className="space-y-2">
        <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
      </div>
    ) : (
      <>
        <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
        <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-300 font-medium mt-1">{sub}</p>}
      </>
    )}
  </div>
);


// ─── Quick Action ──────────────────────────────────────────────────
const QuickAction = ({ icon: Icon, label, desc, to }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex cursor-pointer items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl
                 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-sm transition-all duration-200 text-left group w-full shadow-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 font-medium truncate">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
    </button>
  );
};


// ─── Status Styles ─────────────────────────────────────────────────
const statusStyle = {
  todo:          { dot: "bg-gray-400",    label: "To Do",       text: "text-gray-400"    },
  inprogress:    { dot: "bg-blue-500",    label: "In Progress", text: "text-blue-500"    },
  "in-progress": { dot: "bg-blue-500",    label: "In Progress", text: "text-blue-500"    },
  done:          { dot: "bg-emerald-500", label: "Done",        text: "text-emerald-600" },
  completed:     { dot: "bg-emerald-500", label: "Done",        text: "text-emerald-600" },
};

const TaskRow = ({ task }) => {
  const s = statusStyle[task.status] || statusStyle.todo;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{task.title}</p>
        <p className="text-xs text-gray-400 font-medium truncate">
          {task.clientName || task.assignedToName || "—"}
        </p>
      </div>
      <span className={`text-xs font-bold ${s.text} flex-shrink-0`}>{s.label}</span>
    </div>
  );
};

const leaveStyle = {
  pending:  { dot: "bg-amber-400",   text: "text-amber-500"   },
  approved: { dot: "bg-emerald-500", text: "text-emerald-600" },
  rejected: { dot: "bg-red-400",     text: "text-red-500"     },
};

const LeaveRow = ({ req }) => {
  const s = leaveStyle[req.status] || leaveStyle.pending;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{req.employeeName || "Employee"}</p>
        <p className="text-xs text-gray-400 font-medium capitalize">{req.type || "Leave"}</p>
      </div>
      <span className={`text-xs font-bold capitalize ${s.text} flex-shrink-0`}>{req.status}</span>
    </div>
  );
};


// ─── Custom Tooltip ────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <p className="text-sm font-black text-gray-900">{payload[0].value}</p>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2">
      <p className="text-xs font-bold text-gray-500">{payload[0].name}</p>
      <p className="text-sm font-black text-gray-900">{payload[0].value} tasks</p>
    </div>
  );
};


// ─── Donut Center Label ────────────────────────────────────────────
const DonutCenterLabel = ({ cx, cy, total }) => (
  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
    <tspan x={cx} dy="-6" className="text-xl font-black" style={{ fontSize: 22, fontWeight: 900, fill: "#111827" }}>
      {total}
    </tspan>
    <tspan x={cx} dy="20" style={{ fontSize: 11, fontWeight: 600, fill: "#9ca3af" }}>
      total
    </tspan>
  </text>
);


// ─── Dashboard Page ────────────────────────────────────────────────
export default function Dashboard() {
  const { adminData } = useAuthStore();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    employees: 0, clients: 0, tasks: 0,
    invoices: 0, pendingLeave: 0, invoiceValue: 0,
  });
  const [taskStats,    setTaskStats]    = useState({ todo: 0, inprogress: 0, done: 0 });
  const [recentTasks,  setRecentTasks]  = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [empSnap, clientSnap, taskSnap, invoiceSnap, leaveSnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "tasks")),
          getDocs(collection(db, "invoices")),
          getDocs(query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"), limit(5))),
        ]);

        // Invoice value
        let invoiceValue = 0;
        invoiceSnap.docs.forEach((d) => {
          const inv  = d.data();
          const base = inv.items?.reduce((sum, i) => sum + (i.qty || 1) * (i.rate || 0), 0) || inv.amount || 0;
          invoiceValue += inv.taxRate > 0 ? base + Math.round(base * inv.taxRate / 100) : base;
        });

        // Pending leaves
        const pendingLeave = leaveSnap.docs.filter((d) => d.data().status === "pending").length;

        setStats({
          employees:   empSnap.size,
          clients:     clientSnap.size,
          tasks:       taskSnap.size,
          invoices:    invoiceSnap.size,
          pendingLeave,
          invoiceValue,
        });

        // Task status breakdown for chart
        const allTasks = taskSnap.docs.map((d) => d.data());
        const taskCounts = allTasks.reduce(
          (acc, t) => {
            const s = (t.status || "todo").toLowerCase().replace("-", "");
            if (s === "done" || s === "completed") acc.done++;
            else if (s === "inprogress") acc.inprogress++;
            else acc.todo++;
            return acc;
          },
          { todo: 0, inprogress: 0, done: 0 }
        );
        setTaskStats(taskCounts);

        // Recent tasks
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
    hour < 17 ? "Good afternoon" : "Good evening";

  // Chart data
  const kpiBarData = [
    { name: "Employees", value: stats.employees },
    { name: "Clients",   value: stats.clients   },
    { name: "Tasks",     value: stats.tasks     },
    { name: "Invoices",  value: stats.invoices  },
  ];

  const PIE_COLORS = ["#d1d5db", "#3b82f6", "#10b981"];
  const pieData = [
    { name: "To Do",       value: taskStats.todo,       color: PIE_COLORS[0] },
    { name: "In Progress", value: taskStats.inprogress, color: PIE_COLORS[1] },
    { name: "Done",        value: taskStats.done,       color: PIE_COLORS[2] },
  ].filter((d) => d.value > 0);
  const pieTotal = taskStats.todo + taskStats.inprogress + taskStats.done;

  return (
    <Layout  title="Dashboard">

      {/* ── Greeting Banner ─────────────────────────────────────── */}
      <div className="bg-[#153485] rounded-2xl px-6 py-5 mb-6 flex items-center justify-between shadow-lg shadow-blue-100">
        <div>
          <p className="text-xs text-blue-100 font-bold uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <h2 className="text-lg font-black text-white">
            {greeting}, {adminData?.name?.split(" ")[0] || "Admin"}
          </h2>
          <p className="text-sm text-blue-100 font-medium mt-0.5">
            Here's what's happening with your team today.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5">
          <Activity size={16} className="text-white" />
          <span className="text-sm font-bold text-white">Admin</span>
        </div>
      </div>

      {/* ── KPI Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard icon={Users}         label="Total Employees" value={stats.employees}   loading={loading} />
        <StatCard icon={UserSquare2}   label="Total Clients"   value={stats.clients}     loading={loading} />
        <StatCard icon={ClipboardList} label="Total Tasks"     value={stats.tasks}       loading={loading} />
        <StatCard icon={FileText}      label="Invoices"        value={stats.invoices}    loading={loading} />
        <StatCard icon={CalendarClock} label="Pending Leaves"  value={stats.pendingLeave} loading={loading} />
        <StatCard
          icon={IndianRupee}
          label="Invoice Value"
          value={loading ? "—" : `${(stats.invoiceValue / 1000).toFixed(0)}k`}
          sub={loading ? "" : `₹${stats.invoiceValue.toLocaleString("en-IN")} total`}
          loading={loading}
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* KPI Bar Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-[#153485]" />
              Overview
            </h3>
            <span className="text-xs text-gray-400 font-medium">All time</span>
          </div>
          {loading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={kpiBarData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fontWeight: 600, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "#f0fdfb" }} />
                <Bar dataKey="value" fill="#153485" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Task Status Donut Chart */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-[#153485]" />
              Task Status
            </h3>
            <span className="text-xs text-gray-400 font-medium">{pieTotal} total</span>
          </div>
          {loading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : pieTotal === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <ClipboardList size={32} className="mb-2 text-gray-200" />
              <p className="text-sm text-gray-400 font-medium">No tasks yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <DonutCenterLabel cx={0} cy={0} total={pieTotal} />
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", fontWeight: 600, color: "#6b7280" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Recent Tasks + Leave Requests ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Recent Tasks */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <ClipboardList size={16} className="text-[#153485]" />
              Recent Tasks
            </h3>
            <button
              onClick={() => navigate("/tasks")}
              className="text-xs font-semibold text-[#153485] cursor-pointer transition-colors flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400 font-medium">No tasks yet</p>
            </div>
          ) : (
            recentTasks.map((t) => <TaskRow key={t.id} task={t} />)
          )}
        </div>

        {/* Leave Requests */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <CalendarClock size={16} className="text-[#153485]" />
              Leave Requests
            </h3>
            {stats.pendingLeave > 0 && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                {stats.pendingLeave} pending
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentLeaves.length === 0 ? (
            <div className="text-center py-10">
              <CalendarClock size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400 font-medium">No leave requests</p>
            </div>
          ) : (
            recentLeaves.map((r) => <LeaveRow key={r.id} req={r} />)
          )}
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-blue-500" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction icon={Users}       to="/employees" label="Add Employee"   desc="Create a new employee account" />
          <QuickAction icon={UserSquare2} to="/clients"   label="Add Client"     desc="Register a new client"         />
          <QuickAction icon={Link2}       to="/assign"    label="Assign Client"  desc="Link clients to employees"     />
          <QuickAction icon={FileText}    to="/invoices"  label="Create Invoice" desc="Generate a new invoice"        />
        </div>
      </div>

    </Layout>
  );
}