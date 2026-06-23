import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import {
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  CalendarClock,
  BookOpen,
  ArrowRight,
  Ticket,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Helpers ──────────────────────────────────────────────────────
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
  if (s === "in-progress" || s === "inprogress" || s === "in_progress") return "inprogress";
  if (s === "todo" || s === "to-do" || s === "pending" || s === "to_do") return "todo";
  return "todo";
};

const normalizeLearningStatus = (status) => {
  const s = (status || "").toLowerCase().trim();
  if (["completed", "done", "approved"].includes(s)) return "completed";
  if (["in-progress", "inprogress", "progress", "ongoing"].includes(s)) return "inprogress";
  if (["review", "pending-review", "pending review", "submitted"].includes(s)) return "review";
  if (["not-started", "not started", "todo", "assigned", "pending"].includes(s)) return "notstarted";
  return "notstarted";
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
};

const getDateKey = (value) => {
  const d = toJsDate(value);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getEmployeeUidFromSession = (docSnap, data) => {
  if (data?.employeeUid) return data.employeeUid;
  if (data?.uid) return data.uid;
  if (data?.userId) return data.userId;
  return docSnap.ref.path.split("/")[1] || null;
};

const shouldReplaceSession = (prev, next) => {
  if (!prev) return true;
  const ps = toJsDate(prev.startTime);
  const ns = toJsDate(next.startTime);
  const pe = toJsDate(prev.endTime);
  const ne = toJsDate(next.endTime);
  if (!pe && ne) return true;
  if (pe && ne && ne > pe) return true;
  if (ps && ns && ns > ps) return true;
  return false;
};

const getOverrideDocId = (uid, dateStr) => `${uid}_${dateStr}`;

const getEmployeeJoinDate = (emp) => {
  const raw = emp.createdAt || emp.joinDate || emp.joiningDate || emp.startDate || null;
  if (!raw) return null;
  const d = toJsDate(raw);
  if (!d) return null;
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

const getRangeBounds = (period) => {
  const now = new Date();
  if (period === "week") {
    const start = getStartOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 5);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { start, end };
};

const listDatesForPeriod = (period) => {
  const now = new Date();

  if (period === "week") {
    const start = getStartOfWeek(now);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }

  if (period === "month") {
    const year = now.getFullYear();
    const month = now.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const dates = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(year, month, i);
      if (d.getDay() !== 0) dates.push(d);
    }
    return dates;
  }

  const year = now.getFullYear();
  const daysInYear = year % 4 === 0 ? 366 : 365;
  const dates = [];
  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(year, 0, 1 + i);
    if (d.getDay() !== 0) dates.push(d);
  }
  return dates;
};

const mapOverridesByDateAndUid = (docs) => {
  const map = {};
  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const dateKey = data.date || data.selectedDate;
    const uid = data.employeeUid || data.uid || data.employeeId;
    if (!dateKey || !uid) return;
    if (!map[dateKey]) map[dateKey] = {};
    map[dateKey][uid] = data;
  });
  return map;
};

// ─── Attendance aggregation ───────────────────────────────────────
const aggregateAttendance = (dates, employeeList, sessionsByEmpByDate, overrideMapByDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let present = 0,
    absent = 0,
    late = 0,
    halfDay = 0;

  dates.forEach((dateObj) => {
    const dateKey = getDateKey(dateObj);
    const isFuture = dateObj > today;

    employeeList.forEach((emp) => {
      const uid = emp.uid || emp.employeeUid || emp.id;
      const joinDate = getEmployeeJoinDate(emp);
      if (joinDate && dateObj < joinDate) return;

      const hasSession =
        !!sessionsByEmpByDate[dateKey]?.[emp.id] ||
        !!sessionsByEmpByDate[dateKey]?.[emp.uid] ||
        !!sessionsByEmpByDate[dateKey]?.[emp.employeeUid] ||
        !!sessionsByEmpByDate[dateKey]?.[uid];

      const override =
        overrideMapByDate[dateKey]?.[emp.id] ||
        overrideMapByDate[dateKey]?.[emp.uid] ||
        overrideMapByDate[dateKey]?.[emp.employeeUid] ||
        overrideMapByDate[dateKey]?.[uid] ||
        null;

      if (override?.status === "present") {
        present++;
        return;
      }
      if (override?.status === "absent" && !isFuture) {
        absent++;
        return;
      }
      if (override?.status === "late") {
        late++;
        return;
      }
      if (override?.status === "half_day") {
        halfDay++;
        return;
      }
      if (!override && hasSession) {
        present++;
        return;
      }
      if (!override && !hasSession && !isFuture) absent++;
    });
  });

  return { present, absent, late, halfDay };
};

const buildChartData = (period, employeeList, sessionsByEmpByDate, overrideMapByDate) => {
  const now = new Date();

  if (period === "week") {
    const weekStart = getStartOfWeek();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const agg = aggregateAttendance([d], employeeList, sessionsByEmpByDate, overrideMapByDate);
      return { name: WEEK_DAYS[i], ...agg };
    });
  }

  if (period === "month") {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const buckets = [
      { name: "W1", start: 1, end: 7 },
      { name: "W2", start: 8, end: 14 },
      { name: "W3", start: 15, end: 21 },
      { name: "W4", start: 22, end: daysInMonth },
    ];

    return buckets.map(({ name, start, end }) => {
      const dates = [];
      for (let day = start; day <= end; day++) {
        const d = new Date(year, month, day);
        if (d.getDay() !== 0) dates.push(d);
      }
      const agg = aggregateAttendance(dates, employeeList, sessionsByEmpByDate, overrideMapByDate);
      return { name, ...agg };
    });
  }

  if (period === "year") {
    return Array.from({ length: 12 }, (_, m) => {
      const year = now.getFullYear();
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const dates = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(year, m, day);
        if (d.getDay() !== 0) dates.push(d);
      }
      const agg = aggregateAttendance(dates, employeeList, sessionsByEmpByDate, overrideMapByDate);
      return { name: MONTH_NAMES[m], ...agg };
    });
  }

  return [];
};

const PERIOD_LABELS = { week: "This Week", month: "This Month", year: "This Year" };

const AttendanceFilter = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-100 transition-colors"
      >
        {PERIOD_LABELS[value]}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[130px]">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors ${
                value === key ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, iconBg, iconColor, loading }) => (
  <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
    {loading ? (
      <>
        <div className="w-11 h-11 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
        </div>
      </>
    ) : (
      <>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900 leading-none tabular-nums">{value}</p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
        </div>
      </>
    )}
  </div>
);

const SectionCard = ({ title, actionLabel, onAction, rightExtra, children }) => (
  <div className="bg-white flex flex-col justify-center border border-gray-100 rounded-2xl shadow-sm">
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <div className="flex items-center gap-2">
        {rightExtra}
        {onAction && (
          <button onClick={onAction} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            {actionLabel} <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 text-xs">
      <p className="font-bold text-gray-500 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.dataKey.charAt(0).toUpperCase() + p.dataKey.slice(1)}: <span className="font-black">{p.value}</span>
        </p>
      ))}
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

const activityIcon = (type) => {
  const map = {
    "Check-in": { bg: "bg-green-50", color: "text-green-600" },
    Leave: { bg: "bg-orange-50", color: "text-orange-500" },
    Learning: { bg: "bg-blue-50", color: "text-blue-600" },
    Task: { bg: "bg-purple-50", color: "text-purple-600" },
  };
  return map[type] || map.Task;
};

const DeadlineBadge = ({ daysLeft }) => {
  if (daysLeft === null) return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">No date</span>;
  if (daysLeft < 0) return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-500">Overdue</span>;
  if (daysLeft === 0) return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-500">Today</span>;
  if (daysLeft === 1) return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-50 text-orange-500">Tomorrow</span>;
  if (daysLeft <= 3) return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-500">In {daysLeft} days</span>;
  return <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-600">In {daysLeft} days</span>;
};

const TASK_COLORS = {
  todo: { color: "#3B82F6", label: "To Do" },
  inprogress: { color: "#F59E0B", label: "In Progress" },
  review: { color: "#8B5CF6", label: "Review" },
  done: { color: "#22C55E", label: "Done" },
};

// ─── Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const { adminData, user } = useAuthStore();
  const navigate = useNavigate();

  const [overviewPeriod, setOverviewPeriod] = useState("week");
  const [distPeriod, setDistPeriod] = useState("week");

  const [employeeList, setEmployeeList] = useState([]);
  const [sessionsByEmpByDate, setSessionsByEmpByDate] = useState({});
  const [overrideMapByDate, setOverrideMapByDate] = useState({});
  const [taskStats, setTaskStats] = useState({ todo: 0, inprogress: 0, review: 0, done: 0 });

  const [stats, setStats] = useState({ employees: 0, tasks: 0, pendingLeave: 0, presentToday: 0, absentToday: 0 });
  const [learningStats, setLearningStats] = useState({
    assigned: 0,
    completed: 0,
    inProgress: 0,
    notStarted: 0,
    pendingReview: 0,
    progressPct: 0,
  });

  const [recentTasks, setRecentTasks] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const [savingOverride, setSavingOverride] = useState(false);

  const fetchOverridesForPeriods = async (periods = ["week", "month", "year"]) => {
    const snaps = await Promise.all(
      periods.map(async (period) => {
        const { start, end } = getRangeBounds(period);
        const startKey = getDateKey(start);
        const endKey = getDateKey(end);

        const snap = await getDocs(
          query(
            collection(db, "attendanceOverrides"),
            where("date", ">=", startKey),
            where("date", "<=", endKey)
          )
        );

        return snap.docs;
      })
    );

    const uniqueDocs = new Map();
    snaps.flat().forEach((docSnap) => {
      uniqueDocs.set(docSnap.id, docSnap);
    });

    return mapOverridesByDateAndUid(Array.from(uniqueDocs.values()));
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const yearBounds = getRangeBounds("year");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [empSnap, taskSnap, leaveSnap, sessionsSnap, tSnap, learningSnap, overrideMap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "tasks")),
          getDocs(query(collection(db, "leaveRequests"), orderBy("createdAt", "desc"), limit(5))),
          getDocs(
            query(
              collectionGroup(db, "sessions"),
              where("startTime", ">=", yearBounds.start),
              where("startTime", "<=", yearBounds.end)
            )
          ),
          getDocs(query(collection(db, "tasks"), orderBy("createdAt", "desc"), limit(5))),
          getDocs(query(collection(db, "learningEntries"), orderBy("createdAt", "desc"))),
          fetchOverridesForPeriods(["week", "month", "year"]),
        ]);

        const empList = empSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const employeeMap = {};
        empList.forEach((emp) => {
          const uid = emp.uid || emp.employeeUid || emp.id;
          const name = emp.name || emp.displayName || emp.fullName || emp.email || null;
          if (uid && name) employeeMap[uid] = name;
          if (emp.id && name) employeeMap[emp.id] = name;
        });

        const pendingLeave = leaveSnap.docs.filter((d) => d.data().status === "pending").length;

        const sessMap = {};
        sessionsSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          const empUid = getEmployeeUidFromSession(docSnap, data);
          const dateKey = getDateKey(data.startTime);
          if (!empUid || !dateKey) return;

          const next = { ...data, sessionId: docSnap.id, employeeUid: empUid };
          if (!sessMap[dateKey]) sessMap[dateKey] = {};
          if (shouldReplaceSession(sessMap[dateKey][empUid], next)) {
            sessMap[dateKey][empUid] = next;
          }
        });

        setEmployeeList(empList);
        setSessionsByEmpByDate(sessMap);
        setOverrideMapByDate(overrideMap);

        const todayAgg = aggregateAttendance([today], empList, sessMap, overrideMap);

        const allTasks = taskSnap.docs.map((d) => d.data());
        const tCounts = allTasks.reduce(
          (acc, t) => {
            acc[normalizeTaskStatus(t.status)]++;
            return acc;
          },
          { todo: 0, inprogress: 0, review: 0, done: 0 }
        );

        setTaskStats(tCounts);

        const learningEntries = learningSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const learningCounts = learningEntries.reduce(
          (acc, item) => {
            const key = normalizeLearningStatus(item.status);
            if (key === "completed") acc.completed += 1;
            else if (key === "inprogress") acc.inProgress += 1;
            else if (key === "review") acc.pendingReview += 1;
            else acc.notStarted += 1;
            return acc;
          },
          { completed: 0, inProgress: 0, notStarted: 0, pendingReview: 0 }
        );

        const assigned = learningEntries.length;
        const progressPct = assigned ? Math.round((learningCounts.completed / assigned) * 100) : 0;

        setLearningStats({
          assigned,
          completed: learningCounts.completed,
          inProgress: learningCounts.inProgress,
          notStarted: learningCounts.notStarted,
          pendingReview: learningCounts.pendingReview,
          progressPct,
        });

        setStats({
          employees: empSnap.size,
          tasks: taskSnap.size,
          pendingLeave,
          presentToday: todayAgg.present,
          absentToday: todayAgg.absent,
        });

        const tasks = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRecentTasks(tasks);
        setRecentLeaves(leaveSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        const activities = [
          ...tasks.map((data) => {
            const uid = data.assigneeUid || data.assignedTo || data.employeeUid || data.createdByUid || data.userId || "";
            return {
              id: `task-${data.id}`,
              name: employeeMap[uid] || data.assigneeName || data.employeeName || data.createdByName || "Employee",
              action:
                normalizeTaskStatus(data.status) === "done"
                  ? "marked task as complete"
                  : normalizeTaskStatus(data.status) === "review"
                  ? "submitted task for review"
                  : "updated a task",
              time: data.updatedAt || data.createdAt,
              tag: "Task",
            };
          }),
          ...leaveSnap.docs.map((d) => {
            const data = d.data();
            const uid = data.employeeUid || data.userId || data.uid || "";
            return {
              id: `leave-${d.id}`,
              name: employeeMap[uid] || data.employeeName || data.name || "Employee",
              action: "submitted leave request",
              time: data.createdAt,
              tag: "Leave",
            };
          }),
        ]
          .sort((a, b) => (toJsDate(b.time)?.getTime() || 0) - (toJsDate(a.time)?.getTime() || 0))
          .slice(0, 5);

        setRecentActivity(activities);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const overviewChartData = useMemo(
    () => buildChartData(overviewPeriod, employeeList, sessionsByEmpByDate, overrideMapByDate),
    [overviewPeriod, employeeList, sessionsByEmpByDate, overrideMapByDate]
  );

  const distAgg = useMemo(() => {
    const dates = listDatesForPeriod(distPeriod);
    return aggregateAttendance(dates, employeeList, sessionsByEmpByDate, overrideMapByDate);
  }, [distPeriod, employeeList, sessionsByEmpByDate, overrideMapByDate]);

  const distTotal = distAgg.present + distAgg.absent + distAgg.late + distAgg.halfDay;

  const pieTaskData = useMemo(
    () =>
      Object.entries(TASK_COLORS).map(([key, { color, label }]) => ({
        key,
        label,
        color,
        value: taskStats[key] || 0,
      })),
    [taskStats]
  );

  const pieTaskTotal = pieTaskData.reduce((s, d) => s + d.value, 0);

  const pendingApprovals = [
    { icon: CalendarClock, label: "Leave Requests", sub: "Requires your approval", count: stats.pendingLeave, countColor: "bg-red-500" },
    {
      icon: ClipboardList,
      label: "Task Reviews",
      sub: "Tasks pending review",
      count: recentTasks.filter((t) => normalizeTaskStatus(t.status) === "review").length,
      countColor: "bg-blue-500",
    },
    {
      icon: BookOpen,
      label: "Learning Reviews",
      sub: "Learning submissions",
      count: learningStats.pendingReview,
      countColor: "bg-blue-500",
    },
    { icon: Ticket, label: "Ticket Approvals", sub: "Tickets waiting approval", count: 0, countColor: "bg-gray-400" },
  ];

  const upcomingDeadlines = useMemo(
    () =>
      recentTasks
        .filter((t) => t.dueDate)
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 4)
        .map((t) => ({
          id: t.id,
          title: t.title,
          sub: "Task",
          date: t.dueDate,
          daysLeft: getDaysLeft(t.dueDate),
        })),
    [recentTasks]
  );

  const fmtActivityTime = (val) => {
    const d = toJsDate(val);
    if (!d) return "";
    return (
      d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      ", " +
      d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    );
  };

  const handleSaveOverride = async ({ selectedEmployee, selectedDate, status, reason }) => {
    if (!selectedEmployee || !selectedDate) return;

    setSavingOverride(true);
    try {
      const employeeUid = selectedEmployee.employeeUid || selectedEmployee.uid || selectedEmployee.id;
      const cleanReason = reason?.trim() || "";
      const month = selectedDate.slice(0, 7);
      const year = selectedDate.slice(0, 4);

      const payload = {
        employeeUid,
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.name || "",
        date: selectedDate,
        selectedDate,
        month,
        year,
        status,
        reason: cleanReason,
        markedBy: user?.uid || null,
        markedByName: adminData?.name || "Admin",
        updatedAt: serverTimestamp(),
        createdAt: selectedEmployee.overrideData?.createdAt || serverTimestamp(),
      };

      await setDoc(doc(db, "attendanceOverrides", getOverrideDocId(employeeUid, selectedDate)), payload, { merge: true });

      setOverrideMapByDate((prev) => ({
        ...prev,
        [selectedDate]: {
          ...(prev[selectedDate] || {}),
          [employeeUid]: {
            ...payload,
            createdAt: selectedEmployee.overrideData?.createdAt || new Date(),
          },
        },
      }));
    } catch (error) {
      console.error("Failed to save attendance override:", error);
    } finally {
      setSavingOverride(false);
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <Layout title="Dashboard">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-gray-900">
          {greeting}, {adminData?.name?.split(" ")[0] || "Admin"}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Here's what's happening with your team today.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <StatCard icon={Users} label="Total Employees" value={stats.employees} iconBg="bg-blue-50" iconColor="text-blue-600" loading={loading} />
        <StatCard icon={UserCheck} label="Present Today" value={stats.presentToday} iconBg="bg-green-50" iconColor="text-green-600" loading={loading} />
        <StatCard icon={UserX} label="Absent Today" value={stats.absentToday} iconBg="bg-red-50" iconColor="text-red-500" loading={loading} />
        <StatCard icon={ClipboardList} label="Active Tasks" value={stats.tasks} iconBg="bg-orange-50" iconColor="text-orange-500" loading={loading} />
        <StatCard icon={CalendarClock} label="Pending Leaves" value={stats.pendingLeave} iconBg="bg-amber-50" iconColor="text-amber-500" loading={loading} />
        <StatCard icon={BookOpen} label="Learning Pending" value={learningStats.pendingReview} iconBg="bg-cyan-50" iconColor="text-cyan-600" loading={loading} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4 mb-4">
        <SectionCard title="Attendance Overview" rightExtra={<AttendanceFilter value={overviewPeriod} onChange={setOverviewPeriod} />}>
          {loading ? (
            <div className="h-56 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <div className="flex gap-4 items-start">
              <div className="space-y-3 flex-shrink-0 pt-1 min-w-[72px]">
                {[
                  { label: "Present", value: distAgg.present, pct: distTotal ? ((distAgg.present / distTotal) * 100).toFixed(1) : 0, color: "text-emerald-600", dot: "bg-green-500" },
                  { label: "Absent", value: distAgg.absent, pct: distTotal ? ((distAgg.absent / distTotal) * 100).toFixed(1) : 0, color: "text-rose-500", dot: "bg-red-500" },
                  { label: "Late", value: distAgg.late, pct: distTotal ? ((distAgg.late / distTotal) * 100).toFixed(1) : 0, color: "text-amber-500", dot: "bg-amber-400" },
                  { label: "Half Day", value: distAgg.halfDay, pct: distTotal ? ((distAgg.halfDay / distTotal) * 100).toFixed(1) : 0, color: "text-blue-500", dot: "bg-blue-400" },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="text-xl font-black text-gray-900 tabular-nums">{row.value}</p>
                    <p className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${row.dot}`} /> {row.label}
                    </p>
                    <p className={`text-xs font-bold ${row.color}`}>{row.pct}%</p>
                  </div>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={overviewChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomLineTooltip />} />
                    <Line type="monotone" dataKey="present" stroke="#22C55E" strokeWidth={2} dot={{ r: 3, fill: "#22C55E", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: "#EF4444", strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: "#F59E0B", strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="2 2" />
                    <Line type="monotone" dataKey="halfDay" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: "#3B82F6", strokeWidth: 0 }} activeDot={{ r: 5 }} strokeDasharray="6 2" />
                  </LineChart>
                </ResponsiveContainer>

                <div className="flex flex-wrap gap-3 mt-1 justify-center">
                  {[["#22C55E", "Present"], ["#EF4444", "Absent"], ["#F59E0B", "Late"], ["#3B82F6", "Half Day"]].map(([color, name]) => (
                    <span key={name} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500">
                      <span className="w-5 h-0.5 inline-block rounded" style={{ backgroundColor: color }} />
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Tasks by Status" actionLabel="View all" onAction={() => navigate("/tasks")}>
          {loading ? (
            <div className="h-64 flex bg-gray-50 rounded-xl animate-pulse" />
          ) : pieTaskTotal === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm font-medium text-gray-400">No task data available</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={pieTaskData.filter((d) => d.value > 0)}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      strokeWidth={0}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {pieTaskData.filter((d) => d.value > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                      <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 26, fontWeight: 900, fill: "#111827" }}>
                        {pieTaskTotal}
                      </text>
                      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fontWeight: 600, fill: "#9ca3af" }}>
                        Total
                      </text>
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-3">
                {pieTaskData.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <p className="text-xs font-semibold text-gray-600 truncate">{item.label}</p>
                    </div>
                    <p className="text-xs font-black tabular-nums" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <SectionCard title="Recent Activity" actionLabel="View all" onAction={() => navigate("/attendance")}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No recent activity</div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => {
                const style = activityIcon(item.tag);
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                      <Users size={14} className={style.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        <span className="font-black">{item.name}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">{fmtActivityTime(item.time)}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${style.bg} ${style.color}`}>{item.tag}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pending Approvals" actionLabel="View all" onAction={() => navigate("/leave-requests")}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {pendingApprovals.map((item) => (
                <div key={item.label} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <item.icon size={16} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800">{item.label}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{item.sub}</p>
                  </div>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 ${item.countColor}`}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Upcoming Deadlines" actionLabel="View all" onAction={() => navigate("/tasks")}>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : upcomingDeadlines.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No upcoming deadlines</div>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map((item) => {
                const dateInfo = fmtShortDate(item.date);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-gray-800 leading-none">{dateInfo.day}</span>
                      <span className="text-[9px] font-bold text-gray-400 leading-none mt-0.5">{dateInfo.month}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{item.sub}</p>
                    </div>
                    <DeadlineBadge daysLeft={item.daysLeft} />
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* <SectionCard title="Learning Overview">
        {loading ? (
          <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">Overall Learning Progress</p>
              <span className="text-sm font-black text-gray-900">{learningStats.progressPct}%</span>
            </div>

            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${learningStats.progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {[
                { label: "Assigned Courses", value: learningStats.assigned, bg: "bg-blue-50", color: "text-blue-600" },
                { label: "Completed", value: learningStats.completed, bg: "bg-green-50", color: "text-green-600" },
                { label: "In Progress", value: learningStats.inProgress, bg: "bg-amber-50", color: "text-amber-600" },
                { label: "Not Started", value: learningStats.notStarted, bg: "bg-rose-50", color: "text-rose-500" },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} rounded-xl p-3 text-center`}>
                  <p className={`text-xl font-black ${item.color}`}>{item.value}</p>
                  <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard> */}
    </Layout>
  );
}