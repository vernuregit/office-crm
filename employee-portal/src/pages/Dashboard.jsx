import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db }          from "../firebase/config";
import useAuthStore    from "../store/authStore";
import useWorkTimer    from "../hooks/useWorkTimer";
import Layout          from "../components/Layout";
import { useNavigate } from "react-router-dom";
import {
  Clock, LogIn, LogOut, ClipboardList,
  CheckCircle2, Loader, Timer, Calendar,
  TrendingUp, Users, ChevronRight, Flag,
  Sun, Sunset, Moon, AlertCircle
} from "lucide-react";

// ─── Greeting ─────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning",   Icon: Sun    };
  if (h < 17) return { text: "Good afternoon", Icon: Sunset };
  return       { text: "Good evening",         Icon: Moon   };
};

// ─── Stat Card ────────────────────────────────────────────────────
const StatCard = ({ Icon, label, value, gradient }) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
    {/* <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-sm`}>
      <Icon size={20} className="text-white" />
    </div> */}
    <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
    <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
  </div>
);

// ─── Task Status Style ────────────────────────────────────────────
const taskStatusStyle = (status) => {
  if (status === "completed")   return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "in-progress") return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-violet-50 text-violet-700 border border-violet-200";
};

// ─── Priority Style ───────────────────────────────────────────────
const priorityStyle = (priority) => {
  if (priority === "high")   return "text-red-500";
  if (priority === "medium") return "text-amber-500";
  return "text-emerald-500";
};

// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, userData }  = useAuthStore();
  const navigate            = useNavigate();
  const {
    activeSession, elapsedSeconds, todayMinutes,
    weekMinutes, loading: timerLoading,
    clockIn, clockOut, formatTime, formatMinutes,
  } = useWorkTimer();

  const [tasks,       setTasks]       = useState([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [stats,       setStats]       = useState({
    total: 0, todo: 0, inProgress: 0, completed: 0,
  });

  // ── Fetch Tasks ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      setTaskLoading(true);
      try {
        const q    = query(collection(db, "tasks"), where("assignedTo", "==", user.uid));
        const snap = await getDocs(q);
        const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTasks(all);
        setStats({
          total:      all.length,
          todo:       all.filter((t) => (t.status || "to-do") === "to-do").length,
          inProgress: all.filter((t) => t.status === "in-progress").length,
          completed:  all.filter((t) => t.status === "completed").length,
        });
      } catch (err) { console.error(err); }
      setTaskLoading(false);
    };
    fetchTasks();
  }, [user]);

  // Today's pending tasks
  const todayTasks = tasks
    .filter((t) => t.status !== "completed")
    .slice(0, 5);

  const { text: greetText, Icon: GreetIcon } = getGreeting();

  // ── Work timer progress (out of 8 hours = 480 mins) ───────────
  const workDayMins    = 480;
  const progressPct    = Math.min((todayMinutes / workDayMins) * 100, 100);
  const activeElapsed  = activeSession ? Math.floor(elapsedSeconds / 60) : 0;
  const totalTodayMins = todayMinutes + activeElapsed;

  return (
    <Layout title="Dashboard">

      {/* ── Welcome Hero ──────────────────────────────────────── */}
      <div className="relative bg-[#00A499] rounded-3xl p-7 mb-6 text-white overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-14 right-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold mb-1 flex items-center gap-1.5">
              <GreetIcon size={15} /> {greetText}
            </p>
            <h2 className="text-3xl font-black tracking-tight">
              {userData?.name?.split(" ")[0] || "Employee"}
            </h2>
            <p className="text-indigo-200 text-sm mt-1 font-medium">
              {userData?.designation || "Employee"} · {userData?.department || ""}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => navigate("/tasks")}
                className="bg-white text-[#00A499]  cursor-pointer text-sm font-bold px-4 py-2 rounded-xl  transition-colors shadow-sm flex items-center gap-1.5"
              >
                <ClipboardList size={14} /> View Tasks
              </button>
              <button
                onClick={() => navigate("/leave")}
                className="bg-white/20 text-white cursor-pointer text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/30 transition-colors border border-white/20 flex items-center gap-1.5"
              >
                <Calendar size={14} /> Apply Leave
              </button>
            </div>
          </div>

          {/* Avatar */}
          <div className="hidden md:flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-3xl bg-white/20 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm shadow-xl">
              <span className="text-4xl font-black text-white">
                {userData?.name?.charAt(0).toUpperCase() || "E"}
              </span>
            </div>
            <span className="text-xs text-white font-medium">
              {userData?.department || "Employee"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Work Timer Card ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Timer size={20} className="text-[#00A499]" />
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-base">Work Timer</h3>
            <p className="text-xs text-gray-400 font-medium">Track your working hours</p>
          </div>
          {/* Status pill */}
          <div className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
            ${activeSession
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-gray-50 text-gray-500 border border-gray-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeSession ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
            {activeSession ? "Working" : "Not Clocked In"}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6">

          {/* Live Timer Display */}
          <div className="flex-1 text-center">
            <p className={`text-5xl font-black tracking-tight tabular-nums
              ${activeSession ? "text-[#00A499]" : "text-gray-300"}`}
            >
              {formatTime(elapsedSeconds)}
            </p>
            <p className="text-xs text-gray-400 font-medium mt-2">
              {activeSession ? "Current session" : "No active session"}
            </p>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-20 bg-gray-100" />

          {/* Today + Week Stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">
                {formatMinutes(totalTodayMins)}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-1">Today</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-gray-900">
                {formatMinutes(weekMinutes)}
              </p>
              <p className="text-xs text-gray-400 font-medium mt-1">This Week</p>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-20 bg-gray-100" />

          {/* Clock In / Out Button */}
          <div className="flex flex-col items-center gap-2">
            {timerLoading ? (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 animate-pulse" />
            ) : activeSession ? (
              <button
                onClick={clockOut}
                className="flex flex-col items-center gap-1.5 w-24 py-4 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg hover:opacity-90 hover:shadow-xl transition-all active:scale-95"
              >
                <LogOut size={22} />
                <span className="text-xs font-bold">Clock Out</span>
              </button>
            ) : (
              <button
                onClick={clockIn}
                className="flex flex-col items-center gap-1.5 w-24 py-4 rounded-2xl bg-[#00A499] cursor-pointer text-white shadow-lg hover:opacity-90 hover:shadow-xl transition-all active:scale-95"
              >
                <LogIn size={22} />
                <span className="text-xs font-bold">Clock In</span>
              </button>
            )}
            <p className="text-xs text-gray-400 font-medium text-center">
              {activeSession ? "End your shift" : "Start your shift"}
            </p>
          </div>
        </div>

        {/* Progress Bar — today vs 8hr workday */}
        <div className="mt-5 pt-5 border-t border-gray-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500 font-medium">Today's progress</p>
            <p className="text-xs font-bold text-gray-700">
              {formatMinutes(totalTodayMins)} / 8h
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-[#00A499] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(((totalTodayMins) / workDayMins) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard Icon={ClipboardList} label="Total Tasks"    value={stats.total}      gradient="from-indigo-400 to-indigo-600" />
        <StatCard Icon={AlertCircle}   label="To Do"          value={stats.todo}       gradient="from-violet-400 to-purple-600" />
        <StatCard Icon={Loader}        label="In Progress"    value={stats.inProgress} gradient="from-amber-400 to-orange-500"  />
        <StatCard Icon={CheckCircle2}  label="Completed"      value={stats.completed}  gradient="from-emerald-400 to-green-600" />
      </div>

      {/* ── Today's Tasks ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-gray-900 text-base tracking-tight">Pending Tasks</h3>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Tasks assigned to you</p>
          </div>
          <button
            onClick={() => navigate("/tasks")}
            className="text-[#00A499] text-sm font-bold cursor-pointer transition-colors flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        {taskLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CheckCircle2 size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs mt-1">No pending tasks right now</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => navigate("/tasks")}
                className="flex items-center justify-between p-3.5 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Flag size={15} className={priorityStyle(task.priority)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {task.category || "General"} •{" "}
                      {task.deadline
                        ? new Date(task.deadline.seconds * 1000).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short",
                          })
                        : "No deadline"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${taskStatusStyle(task.status)}`}>
                    {task.status || "to-do"}
                  </span>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </Layout>
  );
};

export default Dashboard;
