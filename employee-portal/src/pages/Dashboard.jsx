import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import useWorkTimer from "../hooks/useWorkTimer";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, ClipboardList,
  CheckCircle2, Loader, Timer, Calendar,
  TrendingUp, ChevronRight, Flag,
  Sun, Sunset, Moon, AlertCircle, Coffee,
  UserCheck, Clock, TrendingDown, Activity,
} from "lucide-react";


// ─── Greeting ─────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning",   };
  if (h < 17) return { text: "Good afternoon", };
  return       { text: "Good evening",          };
};

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });


// ─── Helpers ──────────────────────────────────────────────────────
const toMs = (val) => {
  if (!val) return null;
  if (typeof val === "number") return val;
  if (val.seconds) return val.seconds * 1000;
  return null;
};

const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fmtMins = (mins) => {
  if (!mins || mins <= 0) return "0h 0m";
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
};

const workingDaysInRange = (days) => {
  const result = [], now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    if (d.getDay() !== 0) result.push(dayKey(d.getTime()));
  }
  return result;
};

const computeAttendanceStats = (sessions) => {
  if (!sessions.length) return {
    onTime: 0, late: 0, absent: 0,
    avgHours: "—", avgCheckin: "—", avgCheckout: "—", onTimeRate: "—",
    presentDays: 0,
  };

  const byDay = {};
  sessions.forEach((s) => {
    const startMs = toMs(s.startTime);
    if (!startMs) return;
    const key = dayKey(startMs);
    if (!byDay[key] || toMs(s.startTime) > toMs(byDay[key].startTime)) byDay[key] = s;
  });

  const allWorkingDays = workingDaysInRange(30);
  const presentDays    = Object.keys(byDay);
  const absentCount    = allWorkingDays.filter((d) => !presentDays.includes(d)).length;

  let onTimeCount = 0, lateCount = 0;
  let totalCheckinMins = 0, totalCheckoutMins = 0, totalDurationMins = 0;
  let checkinCount = 0, checkoutCount = 0, durationCount = 0;

  Object.values(byDay).forEach((s) => {
    const startMs = toMs(s.startTime);
    const endMs   = toMs(s.endTime);
    if (!startMs) return;
    const checkinMins = new Date(startMs).getHours() * 60 + new Date(startMs).getMinutes();
    checkinMins <= 630 ? onTimeCount++ : lateCount++;
    totalCheckinMins += checkinMins;
    checkinCount++;
    if (endMs) {
      totalCheckoutMins += new Date(endMs).getHours() * 60 + new Date(endMs).getMinutes();
      checkoutCount++;
      const dur = (endMs - startMs) / 60000;
      if (dur > 0 && dur < 1440) { totalDurationMins += dur; durationCount++; }
    }
  });

  const fmtMinOfDay = (m) => {
    const d = new Date();
    d.setHours(Math.floor(m / 60) % 24, Math.round(m % 60), 0, 0);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  return {
    onTime:      onTimeCount,
    late:        lateCount,
    absent:      absentCount,
    presentDays: presentDays.length,
    avgHours:    fmtMins(durationCount  > 0 ? totalDurationMins  / durationCount  : 0),
    avgCheckin:  checkinCount  > 0 ? fmtMinOfDay(totalCheckinMins  / checkinCount)  : "—",
    avgCheckout: checkoutCount > 0 ? fmtMinOfDay(totalCheckoutMins / checkoutCount) : "—",
    onTimeRate:  checkinCount  > 0 ? ((onTimeCount / checkinCount) * 100).toFixed(2) + "%" : "—",
  };
};


// ─── Task helpers ─────────────────────────────────────────────────
const taskBadge = (s) => {
  if (s === "completed")   return "bg-[#E1F5EE] text-[#085041] border border-[#5DCAA5]";
  if (s === "in-progress") return "bg-[#FAEEDA] text-[#633806] border border-[#EF9F27]";
  return "bg-[#EEEDFE] text-[#3C3489] border border-[#AFA9EC]";
};
const taskBadgeLabel = (s) => {
  if (s === "completed")   return "Completed";
  if (s === "in-progress") return "In progress";
  return "To do";
};
const priorityFlagClass = (p) => {
  if (p === "high")   return "bg-[#FCEBEB] text-[#A32D2D]";
  if (p === "medium") return "bg-[#FAEEDA] text-[#854F0B]";
  return "bg-[#EAF3DE] text-[#3B6D11]";
};
const priorityTextClass = (p) => {
  if (p === "high")   return "text-[#A32D2D]";
  if (p === "medium") return "text-[#854F0B]";
  return "text-[#3B6D11]";
};
const priorityLabel = (p) => {
  if (p === "high")   return "High priority";
  if (p === "medium") return "Medium priority";
  return "Low priority";
};


// ─── Top Status Bar Card ──────────────────────────────────────────
const StatusBarCard = ({ icon: Icon, iconBg, iconColor, label, value, valueColor = "text-gray-800", extra }) => (
  <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
      <Icon size={18} className={iconColor} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-gray-400 font-medium">{label}</p>
      <p className={`text-sm font-bold tabular-nums leading-tight ${valueColor}`}>{value}</p>
      {extra && <p className="text-[10px] font-semibold text-red-400 mt-0.5">{extra}</p>}
    </div>
  </div>
);


// ─── Donut (Today progress) ───────────────────────────────────────
const ProgressDonut = ({ pct, activeBreak, cx = 52, cy = 52, r = 40, stroke = 10 }) => {
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 100 ? "#1D9E75" : activeBreak ? "#F97316" : pct > 50 ? "#153485" : "#EF9F27";
  return (
    <svg width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill="#111827">{pct}%</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9" fill="#9CA3AF">in office</text>
    </svg>
  );
};


// ─── Attendance Donut ─────────────────────────────────────────────
const DonutChart = ({ segments, total, cx = 52, cy = 52, r = 38, stroke = 14 }) => {
  const circumference = 2 * Math.PI * r;
  let cumulDash = 0;
  return (
    <svg width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
      {segments.map((seg, i) => {
        const pct  = total > 0 ? seg.value / total : 0;
        const dash = pct * circumference;
        const arc  = { dash, offset: cumulDash };
        cumulDash += dash;
        if (!seg.value) return null;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-(arc.offset) + circumference / 4}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }} />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="17" fontWeight="700" fill="#111827">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#9CA3AF">days</text>
    </svg>
  );
};


// ─── Today Overview Card ──────────────────────────────────────────
const TodayCard = ({
  todayMins, workDayMins, activeSession,
  clockIn, clockOut, timerLoading,
  formatTime, elapsedSeconds,
  activeBreak, breakSeconds, startBreak, endBreak,
}) => {
  const pct      = Math.min(Math.round((todayMins / workDayMins) * 100), 100);
  const isAbsent = todayMins === 0 && !activeSession;
  const timeLeft = workDayMins - todayMins;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col gap-4 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm">Today's Overview</h3>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full
          ${isAbsent
            ? "bg-red-50 text-red-500 border border-red-200"
            : activeBreak
              ? "bg-orange-50 text-orange-500 border border-orange-200"
              : activeSession
                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                : "bg-blue-50 text-blue-600 border border-blue-200"
          }`}>
          {isAbsent ? "Absent" : activeBreak ? "On Break" : activeSession ? "Active" : "Partial"}
        </span>
      </div>

      {/* Donut + info */}
      <div className="flex items-center gap-5">
        <ProgressDonut pct={pct} activeBreak={activeBreak} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 mb-1">Workday Progress</p>
          <p className="text-lg font-black text-[#153485] leading-tight">
            {fmtMins(todayMins)}
            {/* <span className="text-xs font-semibold text-gray-400 ml-1">
              of {fmtMins(workDayMins)}
            </span> */}
          </p>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 mb-3">
            <div className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 100 ? "#1D9E75" : activeBreak ? "#F97316" : "#153485"
              }} />
          </div>

          {/* Timer pills */}
          {activeSession && !activeBreak && (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs text-amber-700 font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {formatTime(elapsedSeconds)}
            </div>
          )}
          {activeBreak && (
            <div className="inline-flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1 text-xs text-orange-600 font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Break: {formatTime(breakSeconds)}
            </div>
          )}
          {isAbsent && (
            <p className="text-xs text-gray-400 mb-2">You haven't clocked in today</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {timerLoading ? (
        <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
      ) : !activeSession ? (
        <button onClick={clockIn}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#153485] text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-95 cursor-pointer shadow-sm">
          <LogIn size={15} /> Check In
        </button>
      ) : activeBreak ? (
        <button onClick={() => endBreak()}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-95 cursor-pointer">
          <LogIn size={15} /> Resume Work
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={startBreak}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold hover:bg-orange-100 transition-colors active:scale-95 cursor-pointer">
            <Coffee size={13} /> Break
          </button>
          <button onClick={clockOut}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:opacity-90 transition-opacity active:scale-95 cursor-pointer">
            <LogOut size={13} /> Check Out
          </button>
        </div>
      )}
    </div>
  );
};


// ─── My Attendance Card ───────────────────────────────────────────
const MyAttendanceCard = ({ attendanceStats, loading, onViewStats }) => {
  const total    = attendanceStats.onTime + attendanceStats.late + attendanceStats.absent;
  const segments = [
    { value: attendanceStats.onTime, color: "#1D9E75" },
    { value: attendanceStats.late,   color: "#EF9F27" },
    { value: attendanceStats.absent, color: "#EF4444" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm">My Attendance</h3>
        <button onClick={onViewStats}
          className="text-xs text-[#153485] font-semibold hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-none p-0">
          View All
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded-full animate-pulse" />)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <DonutChart segments={segments} total={total} />
          <div className="flex flex-col gap-3 flex-1 min-w-0">
            {[
              { color: "#1D9E75", label: "Present Days",  val: attendanceStats.presentDays },
              { color: "#EF9F27", label: "Absent Days",   val: attendanceStats.absent      },
              { color: "#153485", label: "On-time Rate",  val: attendanceStats.onTimeRate  },
              { color: "#7F77DD", label: "Attendance %",  val: total > 0 ? ((attendanceStats.presentDays / (attendanceStats.presentDays + attendanceStats.absent)) * 100).toFixed(0) + "%" : "—" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                <span className="text-xs text-gray-500 flex-1">{item.label}</span>
                <span className="text-xs font-bold text-gray-800 tabular-nums">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && attendanceStats.onTimeRate !== "—" && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-emerald-700 font-medium">
            On-time rate: <strong>{attendanceStats.onTimeRate}</strong>
          </p>
        </div>
      )}
    </div>
  );
};


// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, userData } = useAuthStore();
  const navigate = useNavigate();
  const {
    activeSession, activeBreak,
    elapsedSeconds, breakSeconds,
    todayMinutes, weekMinutes,
    loading: timerLoading,
    clockIn, clockOut,
    startBreak, endBreak,
    formatTime, formatMinutes,
  } = useWorkTimer();

  const [tasks,             setTasks]            = useState([]);
  const [taskLoading,       setTaskLoading]       = useState(true);
  const [stats,             setStats]             = useState({ total: 0, todo: 0, inProgress: 0, completed: 0 });
  const [attendanceStats,   setAttendanceStats]   = useState({
    onTime: 0, late: 0, absent: 0, presentDays: 0,
    avgHours: "—", avgCheckin: "—", avgCheckout: "—", onTimeRate: "—",
  });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [sessions,          setSessions]          = useState([]);

  // ── Fetch Tasks ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      setTaskLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "tasks"), where("assignedTo", "==", user.uid)));
        const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTasks(all);
        setStats({
          total:      all.length,
          todo:       all.filter((t) => (t.status || "to-do") === "to-do").length,
          inProgress: all.filter((t) => t.status === "in-progress").length,
          completed:  all.filter((t) => t.status === "completed").length,
        });
      } catch (err) { console.error("Tasks fetch error:", err); }
      setTaskLoading(false);
    };
    fetchTasks();
  }, [user]);

  // ── Fetch Attendance ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      try {
        const cutoff   = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        const snap     = await getDocs(query(
          collection(db, "timeLogs", user.uid, "sessions"), orderBy("startTime", "desc")
        ));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => { const ms = toMs(s.startTime); return ms && ms >= cutoff.getTime(); });
        setSessions(data);
        setAttendanceStats(computeAttendanceStats(data));
      } catch (err) { console.error("Attendance fetch error:", err); }
      setAttendanceLoading(false);
    };
    fetchAttendance();
  }, [user?.uid]);

  // ── Derived values ────────────────────────────────────────────
  const todayTasks     = tasks.filter((t) => t.status !== "completed").slice(0, 5);
  const { text: greetText, emoji } = getGreeting();
  const workDayMins    = 450;
  const activeElapsed  = activeSession ? Math.floor(elapsedSeconds / 60) : 0;
  const totalTodayMins = todayMinutes + activeElapsed;

  // Today's session for clock-in/out display
  const todayKey = dayKey(Date.now());
  const todaySession = sessions.find((s) => {
    const ms = toMs(s.startTime);
    return ms && dayKey(ms) === todayKey;
  });
  const clockInTime  = todaySession
    ? new Date(toMs(todaySession.startTime)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : activeSession
      ? new Date(toMs(activeSession.startTime) || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "—";
  const clockOutTime = todaySession?.endTime
    ? new Date(toMs(todaySession.endTime)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : activeSession ? "Active" : "—";

  const lateBy = (() => {
    if (!clockInTime || clockInTime === "—" || clockInTime === "Active") return null;
    const [time, period] = clockInTime.split(" ");
    let [h, m] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    const totalMins = h * 60 + m;
    const diff = totalMins - 630; // 10:30 AM
    if (diff <= 0) return null;
    return `${Math.floor(diff / 60) > 0 ? Math.floor(diff / 60) + "h " : ""}${diff % 60}min`;
  })();

  const status = !activeSession && totalTodayMins === 0
    ? "Absent"
    : activeBreak ? "On Break"
    : activeSession ? "Present"
    : "Checked Out";

  const statusStyle = {
    Absent:       "text-red-500",
    "On Break":   "text-orange-500",
    Present:      "text-emerald-500",
    "Checked Out":"text-blue-500",
  }[status] || "text-gray-500";

  return (
    <Layout title="Dashboard">

      {/* ── Greeting Header ───────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 p-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            {greetText}, {userData?.name?.split(" ")[0] || "Employee"} {emoji}
          </h2>
          <p className="text-sm text-gray-400 mt-0.5 font-medium">
            {userData?.designation || "Employee"}
            {userData?.employeeId ? ` · ${userData.employeeId}` : ""}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 font-medium bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">
          <Calendar size={13} className="text-gray-400" />
          {todayLabel()}
        </div>
      </div>

      {/* ── Top Status Bar ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 px-5">
        <StatusBarCard
          icon={UserCheck}
          iconBg="bg-emerald-50" iconColor="text-emerald-500"
          label="Status"
          value={status}
          valueColor={statusStyle}
          extra={status === "Present" ? "● Live" : undefined}
        />
        <StatusBarCard
          icon={LogIn}
          iconBg="bg-blue-50" iconColor="text-blue-500"
          label="Clock In"
          value={clockInTime}
        />
        <StatusBarCard
          icon={LogOut}
          iconBg="bg-purple-50" iconColor="text-purple-500"
          label="Clock Out"
          value={clockOutTime}
          valueColor={clockOutTime === "Active" ? "text-emerald-500" : "text-gray-800"}
        />
        <StatusBarCard
          icon={Timer}
          iconBg="bg-amber-50" iconColor="text-amber-500"
          label="Worked Hours"
          value={fmtMins(totalTodayMins)}
          valueColor="text-[#153485]"
        />
        <StatusBarCard
          icon={AlertCircle}
          iconBg={lateBy ? "bg-red-50" : "bg-gray-50"}
          iconColor={lateBy ? "text-red-400" : "text-gray-300"}
          label="Late By"
          value={lateBy || "On time"}
          valueColor={lateBy ? "text-red-500" : "text-emerald-500"}
        />
      </div>

      {/* ── Main Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5 px-5">

        {/* Today Overview */}
        <TodayCard
          todayMins={totalTodayMins}
          workDayMins={workDayMins}
          activeSession={activeSession}
          activeBreak={activeBreak}
          breakSeconds={breakSeconds}
          clockIn={clockIn}
          clockOut={clockOut}
          startBreak={startBreak}
          endBreak={endBreak}
          timerLoading={timerLoading}
          formatTime={formatTime}
          elapsedSeconds={elapsedSeconds}
        />

        {/* 2×2 Avg Stats */}
        <div className="grid grid-cols-2 gap-3 content-start">
          {attendanceLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-[100px] bg-gray-100 rounded-2xl animate-pulse" />
            ))
          ) : (
            <>
              {[
                { icon: Timer,      iconBg: "bg-blue-50",    iconColor: "text-[#153485]",    label: "Avg hours / day",   value: attendanceStats.avgHours     },
                { icon: LogIn,      iconBg: "bg-emerald-50", iconColor: "text-emerald-600",  label: "Avg check-in",      value: attendanceStats.avgCheckin   },
                { icon: TrendingUp, iconBg: "bg-green-50",   iconColor: "text-green-600",    label: "On-time arrival",   value: attendanceStats.onTimeRate,   valueColor: "text-emerald-500" },
                { icon: LogOut,     iconBg: "bg-purple-50",  iconColor: "text-purple-600",   label: "Avg check-out",     value: attendanceStats.avgCheckout  },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-2 shadow-sm">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.iconBg}`}>
                    <c.icon size={15} className={c.iconColor} />
                  </div>
                  <p className={`text-base font-bold tabular-nums leading-tight ${c.valueColor || "text-gray-800"}`}>{c.value}</p>
                  <p className="text-[11px] text-gray-400 font-medium">{c.label}</p>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Attendance Donut */}
        <MyAttendanceCard
          attendanceStats={attendanceStats}
          loading={attendanceLoading}
          onViewStats={() => navigate("/attendance")}
        />
      </div>

      {/* ── Task Stats Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 px-5">
        {[
          { Icon: ClipboardList, label: "Total Tasks",  value: stats.total,      color: "text-[#153485]", bg: "bg-blue-50"    },
          { Icon: AlertCircle,   label: "To Do",        value: stats.todo,        color: "text-violet-600", bg: "bg-violet-50" },
          { Icon: Loader,        label: "In Progress",  value: stats.inProgress,  color: "text-amber-600",  bg: "bg-amber-50"  },
          { Icon: CheckCircle2,  label: "Completed",    value: stats.completed,   color: "text-emerald-600",bg: "bg-emerald-50"},
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={17} className={s.color} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pending Tasks ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm ">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Pending Tasks</h3>
            <p className="text-xs text-gray-400 mt-0.5">Tasks assigned to you</p>
          </div>
          <button onClick={() => navigate("/tasks")}
            className="text-[#153485] text-sm font-semibold cursor-pointer inline-flex items-center gap-1 hover:opacity-75 transition-opacity border-none bg-transparent p-0">
            View all <ChevronRight size={13} />
          </button>
        </div>

        {taskLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        ) : todayTasks.length === 0 ? (
          <div className="text-center py-10">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">All caught up!</p>
            <p className="text-xs mt-1 text-gray-300">No pending tasks right now</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {todayTasks.map((task) => (
              <div key={task.id} onClick={() => navigate("/tasks")}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${priorityFlagClass(task.priority)}`}>
                    <Flag size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#153485] transition-colors">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {task.department || task.category || "Work"} ·{" "}
                      <span className={`font-medium ${priorityTextClass(task.priority)}`}>
                        {priorityLabel(task.priority)}
                      </span> ·{" "}
                      {task.deadline
                        ? new Date(task.deadline.seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                        : "No deadline"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${taskBadge(task.status)}`}>
                    {taskBadgeLabel(task.status)}
                  </span>
                  <ChevronRight size={13} className="text-gray-200 group-hover:text-[#153485] transition-colors" />
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