import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import {
  Users,
  ClipboardList,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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

const normalizeTaskStatus = (status) => {
  const s = (status || "todo").toLowerCase();

  if (s === "done" || s === "completed") return "done";
  if (s === "review" || s === "under_review") return "review";
  if (s === "in-progress" || s === "inprogress" || s === "in_progress")
    return "inprogress";
  if (s === "todo" || s === "to-do" || s === "pending" || s === "to_do")
    return "todo";

  return "todo";
};

const WEEK_DAYS = [ "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toJsDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getStartOfWeek = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
};

const getEndOfWeek = (start) => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getDateKey = (value) => {
  const d = toJsDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const prevStart = toJsDate(prev.startTime);
  const nextStart = toJsDate(next.startTime);
  const prevEnd = toJsDate(prev.endTime);
  const nextEnd = toJsDate(next.endTime);

  if (!prevEnd && nextEnd) return true;
  if (prevEnd && nextEnd && nextEnd > prevEnd) return true;
  if (prevStart && nextStart && nextStart > prevStart) return true;

  return false;
};

const getOverrideDocId = (employeeUid, dateStr) => `${employeeUid}_${dateStr}`;

// ─── Pie label helper ─────────────────────────────────────────────
const RADIAN = Math.PI / 180;

const renderPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  value,
  percent,
}) => {
  if (!percent || percent < 0.05) return null;

  const radius = innerRadius + (outerRadius - innerRadius) * 1.38;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <g>
      <text
        x={x}
        y={y - 6}
        textAnchor={x > cx ? "start" : "end"}
        fill="#374151"
        style={{ fontSize: 11, fontWeight: 700 }}
      >
        {name}
      </text>
      <text
        x={x}
        y={y + 8}
        textAnchor={x > cx ? "start" : "end"}
        fill="#6B7280"
        style={{ fontSize: 10, fontWeight: 600 }}
      >
        {value} ({(percent * 100).toFixed(1)}%)
      </text>
    </g>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
  loading,
}) => (
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
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBg}`}
        >
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <p className="text-3xl font-black text-gray-900 leading-none tabular-nums">
            {value}
          </p>
          <p className="text-xs font-semibold text-gray-500 mt-1">{label}</p>
          {sub && (
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              {sub}
            </p>
          )}
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
  const key = normalizeTaskStatus(status);

  const map = {
    todo: "bg-gray-100 text-gray-600",
    inprogress: "bg-blue-100 text-blue-600",
    review: "bg-violet-100 text-violet-600",
    done: "bg-emerald-100 text-emerald-600",
  };

  const labels = {
    todo: "To Do",
    inprogress: "In Progress",
    review: "Review",
    done: "Done",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${map[key]}`}
    >
      {labels[key]}
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
  const label = priority
    ? priority[0].toUpperCase() + priority.slice(1)
    : "Medium";
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
        map[priority] || map.medium
      }`}
    >
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

  const presentItem = payload.find((p) => p.dataKey === "present");
  const absentItem = payload.find((p) => p.dataKey === "absent");

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 min-w-[120px]">
      <p className="text-xs font-bold text-gray-500 mb-1">{label}</p>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-emerald-600">
          Present: <span className="font-black">{presentItem?.value || 0}</span>
        </p>
        <p className="text-xs font-semibold text-rose-500">
          Absent: <span className="font-black">{absentItem?.value || 0}</span>
        </p>
      </div>
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
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState(
    WEEK_DAYS.map((day) => ({
      name: day,
      present: 0,
      absent: 0,
    }))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const weekStart = getStartOfWeek();
        const weekEnd = getEndOfWeek(weekStart);

        const [empSnap, taskSnap, leaveSnap, sessionsSnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "tasks")),
          getDocs(
            query(
              collection(db, "leaveRequests"),
              orderBy("createdAt", "desc"),
              limit(5)
            )
          ),
          getDocs(
            query(
              collectionGroup(db, "sessions"),
              where("startTime", ">=", weekStart),
              where("startTime", "<=", weekEnd)
            )
          ),
        ]);

        const employeeList = empSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        const pendingLeave = leaveSnap.docs.filter(
          (d) => d.data().status === "pending"
        ).length;

        setStats({
          employees: empSnap.size,
          tasks: taskSnap.size,
          pendingLeave,
        });

        const allTasks = taskSnap.docs.map((d) => d.data());
        const taskCounts = allTasks.reduce(
          (acc, t) => {
            const s = normalizeTaskStatus(t.status);
            acc[s]++;
            return acc;
          },
          { todo: 0, inprogress: 0, review: 0, done: 0 }
        );

        setTaskStats(taskCounts);

        const sessionsByEmployeeByDate = {};

        sessionsSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const employeeUid = getEmployeeUidFromSession(docSnap, data);
          const dateKey = getDateKey(data.startTime);

          if (!employeeUid || !dateKey) return;

          const nextSession = {
            ...data,
            sessionId: docSnap.id,
            employeeUid,
          };

          if (!sessionsByEmployeeByDate[dateKey]) {
            sessionsByEmployeeByDate[dateKey] = {};
          }

          const prevSession = sessionsByEmployeeByDate[dateKey][employeeUid];
          if (shouldReplaceSession(prevSession, nextSession)) {
            sessionsByEmployeeByDate[dateKey][employeeUid] = nextSession;
          }
        });

        const weekDates = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          d.setHours(0, 0, 0, 0);
          return d;
        });

        const overrideResults = await Promise.all(
          weekDates.flatMap((dateObj) => {
            const dateKey = getDateKey(dateObj);

            return employeeList.map(async (emp) => {
              const employeeUid = emp.uid || emp.employeeUid || emp.id;
              const overrideRef = doc(
                db,
                "attendanceOverrides",
                getOverrideDocId(employeeUid, dateKey)
              );
              const overrideSnap = await getDoc(overrideRef);

              return {
                employeeUid,
                dateKey,
                exists: overrideSnap.exists(),
                data: overrideSnap.exists() ? overrideSnap.data() : null,
              };
            });
          })
        );

        const overrideMapByDate = {};
        overrideResults.forEach((entry) => {
          if (!entry.exists) return;
          if (!overrideMapByDate[entry.dateKey]) {
            overrideMapByDate[entry.dateKey] = {};
          }
          overrideMapByDate[entry.dateKey][entry.employeeUid] = entry.data;
        });

    const weeklyAttendance = weekDates.map((dateObj, index) => {
  const dateKey = getDateKey(dateObj);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isFutureDay = dateObj > today;

  let present = 0;
  let absent = 0;

  employeeList.forEach((emp) => {
    const employeeUid = emp.uid || emp.employeeUid || emp.id;

    const hasSession =
      !!sessionsByEmployeeByDate[dateKey]?.[emp.id] ||
      !!sessionsByEmployeeByDate[dateKey]?.[emp.uid] ||
      !!sessionsByEmployeeByDate[dateKey]?.[emp.employeeUid] ||
      !!sessionsByEmployeeByDate[dateKey]?.[employeeUid];

    const override =
      overrideMapByDate[dateKey]?.[emp.id] ||
      overrideMapByDate[dateKey]?.[emp.uid] ||
      overrideMapByDate[dateKey]?.[emp.employeeUid] ||
      overrideMapByDate[dateKey]?.[employeeUid] ||
      null;

    if (override?.status === "present") {
      present += 1;
      return;
    }

    if (override?.status === "absent") {
      if (!isFutureDay) absent += 1;
      return;
    }

    if (hasSession) {
      present += 1;
      return;
    }

    if (!isFutureDay) {
      absent += 1;
    }
  });

  return {
    name: WEEK_DAYS[index],
    present,
    absent,
  };
});
        setWeeklyAttendanceData(weeklyAttendance);

        const tSnap = await getDocs(
          query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(5))
        );

        setRecentTasks(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setRecentLeaves(leaveSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
      ? "Good afternoon"
      : "Good evening";

  const pieData = useMemo(() => {
    const colors = {
      todo: "#3B82F6",
      inprogress: "#F59E0B",
      review: "#8B5CF6",
      done: "#22C55E",
    };

    const total =
      taskStats.todo +
      taskStats.inprogress +
      taskStats.review +
      taskStats.done;

    return [
      { name: "To Do", value: taskStats.todo, color: colors.todo },
      { name: "In Progress", value: taskStats.inprogress, color: colors.inprogress },
      { name: "Review", value: taskStats.review, color: colors.review },
      { name: "Done", value: taskStats.done, color: colors.done },
    ]
      .filter((d) => d.value > 0)
      .map((d) => ({
        ...d,
        percent: total ? d.value / total : 0,
      }));
  }, [taskStats]);

  const pieTotal =
    taskStats.todo +
    taskStats.inprogress +
    taskStats.review +
    taskStats.done;

  return (
    <Layout title="Dashboard">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 font-medium mt-1">
          {greeting}, {adminData?.name?.split(" ")[0] || "Admin"} — track your
          team activity at a glance.
        </p>
      </div>

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
          sub={
            stats.pendingLeave > 0
              ? `${stats.pendingLeave} awaiting action`
              : "All clear"
          }
          iconBg="bg-rose-100"
          iconColor="text-rose-500"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        <div className="xl:col-span-2">
          <SectionCard title="Attendance Overview" rightText="This Week">
            {loading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={weeklyAttendanceData}
                  margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
                  barGap={8}
                >
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
                  <Tooltip
                    content={<CustomBarTooltip />}
                    cursor={{ fill: "#eff6ff" }}
                  />
                  <Bar
                    dataKey="present"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={22}
                  />
                  <Bar
                    dataKey="absent"
                    fill="#F43F5E"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Tasks by Status"
          actionLabel="View all"
          onAction={() => navigate("/tasks")}
        >
          {loading ? (
            <div className="h-72 bg-gray-50 rounded-xl animate-pulse" />
          ) : pieTotal === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm font-medium text-gray-400">
              No task data available
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] items-center gap-3">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      strokeWidth={0}
                     
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x="50%"
                          dy="-4"
                          style={{
                            fontSize: 28,
                            fontWeight: 900,
                            fill: "#111827",
                          }}
                        >
                          {pieTotal}
                        </tspan>
                        <tspan
                          x="50%"
                          dy="22"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            fill: "#9ca3af",
                          }}
                        >
                          Total
                        </tspan>
                      </text>
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 pt-2">
                {pieData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="text-xs font-semibold text-gray-600 truncate">
                        {item.name}
                      </p>
                    </div>
                    <p
                      className="text-xs font-black tabular-nums"
                      style={{ color: item.color }}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-5">
        <SectionCard
          title="Recent Tasks"
          actionLabel="View all"
          onAction={() => navigate("/tasks")}
        >
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
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Task
                    </th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Due Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr key={task.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-4">
                        <p className="text-sm font-bold text-gray-800">
                          {task.title}
                        </p>
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

        <SectionCard title="Upcoming Deadlines">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentLeaves.length === 0 ? (
            <div className="text-center py-16">
              <CalendarClock size={30} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-500">
                No leave requests
              </p>
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
                      <span className="text-base leading-none font-black text-gray-800">
                        {dateInfo.day}
                      </span>
                      <span className="text-[10px] leading-none mt-1 font-bold text-gray-400">
                        {dateInfo.month}
                      </span>
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