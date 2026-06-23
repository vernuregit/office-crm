import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import useWorkTimer from "../hooks/useWorkTimer";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import {
  LogIn, LogOut, ClipboardList,
  CheckCircle2, Loader, Timer, Calendar,
  TrendingUp, ChevronRight, Flag,
  AlertCircle, Coffee,
  UserCheck,
} from "lucide-react";

// ─── Greeting ─────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning" };
  if (h < 17) return { text: "Good afternoon" };
  return { text: "Good evening" };
};

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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

const workingDaysInCurrentMonth = () => {
  const result = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  for (let day = 1; day <= today; day++) {
    const d = new Date(year, month, day);
    if (d.getDay() !== 0) result.push(dayKey(d.getTime()));
  }

  return result;
};

const getCurrentMonthDateKeys = () => {
  const result = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  for (let day = 1; day <= today; day++) {
    result.push(
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
  }

  return result;
};

// ─── Office Time Config ───────────────────────────────────────────
const OFFICE_START_MINS = 630;
const LATE_THRESHOLD_MINS = 660;

// ─── Attendance Stats ─────────────────────────────────────────────
const computeAttendanceStats = (sessions, overrideMap = {}) => {
  const allWorkingDays = workingDaysInCurrentMonth();

  const byDay = {};
  sessions.forEach((s) => {
    const startMs = toMs(s.startTime);
    if (!startMs) return;
    const key = dayKey(startMs);

    if (!byDay[key] || toMs(s.startTime) < toMs(byDay[key].startTime)) {
      byDay[key] = s;
    }
  });

  let onTimeCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let presentDays = 0;

  let totalCheckinMins = 0;
  let totalCheckoutMins = 0;
  let totalDurationMins = 0;
  let checkinCount = 0;
  let checkoutCount = 0;
  let durationCount = 0;

  allWorkingDays.forEach((day) => {
    const override = overrideMap[day];
    const session = byDay[day];

    if (override?.status === "absent") {
      absentCount++;
      return;
    }

    if (override?.status === "present") {
      presentDays++;

      const startMs = toMs(session?.startTime);
      const endMs = toMs(session?.endTime);

      if (startMs) {
        const startDate = new Date(startMs);
        const checkinMins = startDate.getHours() * 60 + startDate.getMinutes();

        if (checkinMins < LATE_THRESHOLD_MINS) onTimeCount++;
        else lateCount++;

        totalCheckinMins += checkinMins;
        checkinCount++;

        if (endMs) {
          const endDate = new Date(endMs);
          totalCheckoutMins += endDate.getHours() * 60 + endDate.getMinutes();
          checkoutCount++;

          const totalBreakMins = Number(session.totalBreakSeconds || 0) / 60;
          const dur = (endMs - startMs) / 60000 - totalBreakMins;
          if (dur > 0 && dur < 1440) {
            totalDurationMins += dur;
            durationCount++;
          }
        }
      } else {
        onTimeCount++;
      }

      return;
    }

    if (session) {
      presentDays++;

      const startMs = toMs(session.startTime);
      const endMs = toMs(session.endTime);

      if (startMs) {
        const startDate = new Date(startMs);
        const checkinMins = startDate.getHours() * 60 + startDate.getMinutes();

        if (checkinMins < LATE_THRESHOLD_MINS) onTimeCount++;
        else lateCount++;

        totalCheckinMins += checkinMins;
        checkinCount++;

        if (endMs) {
          const endDate = new Date(endMs);
          totalCheckoutMins += endDate.getHours() * 60 + endDate.getMinutes();
          checkoutCount++;

          const totalBreakMins = Number(session.totalBreakSeconds || 0) / 60;
          const dur = (endMs - startMs) / 60000 - totalBreakMins;
          if (dur > 0 && dur < 1440) {
            totalDurationMins += dur;
            durationCount++;
          }
        }
      }
    } else {
      absentCount++;
    }
  });

  const fmtMinOfDay = (m) => {
    const d = new Date();
    d.setHours(Math.floor(m / 60) % 24, Math.round(m % 60), 0, 0);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return {
    onTime: onTimeCount,
    late: lateCount,
    absent: absentCount,
    presentDays,
    avgHours: fmtMins(durationCount > 0 ? totalDurationMins / durationCount : 0),
    avgCheckin: checkinCount > 0 ? fmtMinOfDay(totalCheckinMins / checkinCount) : "—",
    avgCheckout: checkoutCount > 0 ? fmtMinOfDay(totalCheckoutMins / checkoutCount) : "—",
    onTimeRate:
      checkinCount > 0
        ? ((onTimeCount / checkinCount) * 100).toFixed(2) + "%"
        : "—",
  };
};

const buildAttendanceOverTime = (sessions, overrideMap = {}) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const weeks = Array.from({ length: 4 }, (_, i) => {
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - i * 7);

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const workingDays = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0) workingDays.push(dayKey(d.getTime()));
    }

    return { label: `W${4 - i}`, startDate, endDate, workingDays };
  }).reverse();

  const byDay = {};
  sessions.forEach((s) => {
    const startMs = toMs(s.startTime);
    if (!startMs) return;
    const key = dayKey(startMs);

    if (!byDay[key] || toMs(s.startTime) < toMs(byDay[key].startTime)) {
      byDay[key] = s;
    }
  });

  const nowMs = Date.now();

  return weeks.map((week) => {
    let present = 0;
    let late = 0;
    let absent = 0;

    week.workingDays.forEach((dk) => {
      const dayDate = new Date(`${dk}T00:00:00`);
      const isFuture = dayDate.getTime() > nowMs;
      if (isFuture) return;

      const override = overrideMap[dk];
      const session = byDay[dk];

      if (override?.status === "absent") {
        absent++;
        return;
      }

      if (override?.status === "present") {
        if (session?.startTime) {
          const startMs = toMs(session.startTime);
          const checkinMins =
            new Date(startMs).getHours() * 60 + new Date(startMs).getMinutes();

          if (checkinMins < LATE_THRESHOLD_MINS) present++;
          else late++;
        } else {
          present++;
        }
        return;
      }

      if (session) {
        const startMs = toMs(session.startTime);
        const checkinMins =
          new Date(startMs).getHours() * 60 + new Date(startMs).getMinutes();

        if (checkinMins < LATE_THRESHOLD_MINS) present++;
        else late++;
      } else {
        absent++;
      }
    });

    return { label: week.label, present, late, absent };
  });
};

// ─── Attendance Over Time Chart ───────────────────────────────────
const AttendanceOverTimeChart = ({ data }) => {
  const maxVal = Math.max(...data.map((d) => d.present + d.late + d.absent), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Attendance Over Time</h3>
          <p className="text-xs text-gray-400 mt-0.5">Last 4 weeks · Mon–Sat</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#1D9E75]" /> Present
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#EF9F27]" /> Late
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-[#EF4444]" /> Absent
          </span>
        </div>
      </div>

      <div className="flex items-end gap-4 mt-4 h-28">
        {data.map((week) => {
          const total = week.present + week.late + week.absent;
          const presentPct = total > 0 ? (week.present / maxVal) * 100 : 0;
          const latePct = total > 0 ? (week.late / maxVal) * 100 : 0;
          const absentPct = total > 0 ? (week.absent / maxVal) * 100 : 0;

          return (
            <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col justify-end rounded-lg overflow-hidden h-20 gap-px bg-gray-50 border border-gray-100">
                {week.absent > 0 && (
                  <div
                    className="w-full bg-[#EF4444] transition-all duration-500"
                    style={{ height: `${absentPct}%` }}
                    title={`Absent: ${week.absent}`}
                  />
                )}
                {week.late > 0 && (
                  <div
                    className="w-full bg-[#EF9F27] transition-all duration-500"
                    style={{ height: `${latePct}%` }}
                    title={`Late: ${week.late}`}
                  />
                )}
                {week.present > 0 && (
                  <div
                    className="w-full bg-[#1D9E75] transition-all duration-500 rounded-t-sm"
                    style={{ height: `${presentPct}%` }}
                    title={`Present: ${week.present}`}
                  />
                )}
              </div>
              <span className="text-[10px] font-bold text-gray-400">{week.label}</span>
              <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{total}d</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2">
        {[
          { label: "Total Present", val: data.reduce((s, d) => s + d.present, 0), color: "text-emerald-600" },
          { label: "Total Late", val: data.reduce((s, d) => s + d.late, 0), color: "text-amber-500" },
          { label: "Total Absent", val: data.reduce((s, d) => s + d.absent, 0), color: "text-red-500" },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <p className={`text-base font-black tabular-nums ${item.color}`}>{item.val}</p>
            <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Task helpers ─────────────────────────────────────────────────
const taskBadge = (s) => {
  if (s === "completed") return "bg-[#E1F5EE] text-[#085041] border border-[#5DCAA5]";
  if (s === "in-progress") return "bg-[#FAEEDA] text-[#633806] border border-[#EF9F27]";
  return "bg-[#EEEDFE] text-[#3C3489] border border-[#AFA9EC]";
};

const taskBadgeLabel = (s) => {
  if (s === "completed") return "Completed";
  if (s === "in-progress") return "In progress";
  return "To do";
};

const priorityFlagClass = (p) => {
  if (p === "high") return "bg-[#FCEBEB] text-[#A32D2D]";
  if (p === "medium") return "bg-[#FAEEDA] text-[#854F0B]";
  return "bg-[#EAF3DE] text-[#3B6D11]";
};

const priorityTextClass = (p) => {
  if (p === "high") return "text-[#A32D2D]";
  if (p === "medium") return "text-[#854F0B]";
  return "text-[#3B6D11]";
};

const priorityLabel = (p) => {
  if (p === "high") return "High priority";
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

// ─── Today Progress Donut ─────────────────────────────────────────
const ProgressDonut = ({ pct, activeBreak, cx = 52, cy = 52, r = 40, stroke = 10 }) => {
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = pct >= 100 ? "#1D9E75" : activeBreak ? "#F97316" : pct > 50 ? "#1D7872" : "#EF9F27";

  return (
    <svg width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
      />
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
        const pct = total > 0 ? seg.value / total : 0;
        const dash = pct * circumference;
        const arc = { dash, offset: cumulDash };
        cumulDash += dash;
        if (!seg.value) return null;

        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-(arc.offset) + circumference / 4}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
          />
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
  const pct = Math.min(Math.round((todayMins / workDayMins) * 100), 100);
  const isAbsent = todayMins === 0 && !activeSession;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col gap-4">
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

      <div className="flex items-center gap-5">
        <ProgressDonut pct={pct} activeBreak={activeBreak} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 mb-1">Workday Progress</p>
          <p className="text-lg font-black text-[#1D7872] leading-tight">
            {fmtMins(todayMins)}
          </p>
          <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 mb-3">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct >= 100 ? "#1D9E75" : activeBreak ? "#F97316" : "#1D7872",
              }}
            />
          </div>
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

      {timerLoading ? (
        <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
      ) : !activeSession ? (
        <button
          onClick={clockIn}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#1D7872] text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-95 cursor-pointer shadow-sm"
        >
          <LogIn size={15} /> Check In
        </button>
      ) : activeBreak ? (
        <button
          onClick={() => endBreak()}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
        >
          <LogIn size={15} /> Resume Work
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={startBreak}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold hover:bg-orange-100 transition-colors active:scale-95 cursor-pointer"
          >
            <Coffee size={13} /> Break
          </button>
          <button
            onClick={clockOut}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:opacity-90 transition-opacity active:scale-95 cursor-pointer"
          >
            <LogOut size={13} /> Check Out
          </button>
        </div>
      )}
    </div>
  );
};

// ─── My Attendance Card ───────────────────────────────────────────
const MyAttendanceCard = ({ attendanceStats, loading, onViewStats }) => {
  const total = attendanceStats.onTime + attendanceStats.late + attendanceStats.absent;
  const segments = [
    { value: attendanceStats.onTime, color: "#1D9E75" },
    { value: attendanceStats.late, color: "#F97316" },
    { value: attendanceStats.absent, color: "#EF4444" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 text-sm">My Attendance</h3>
        <button
          onClick={onViewStats}
          className="text-xs text-[#1D7872] font-semibold hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-none p-0"
        >
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
              { color: "#1D9E75", label: "Present Days", val: attendanceStats.presentDays },
              { color: "#EF4444", label: "Absent Days", val: attendanceStats.absent },
              {
                color: "#F97316",
                label: "Attendance %",
                val:
                  total > 0
                    ? ((attendanceStats.presentDays / (attendanceStats.presentDays + attendanceStats.absent)) * 100).toFixed(0) + "%"
                    : "—",
              },
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
    todayMinutes,
    loading: timerLoading,
    clockIn, clockOut,
    startBreak, endBreak,
    formatTime,
  } = useWorkTimer();

  const [tasks, setTasks] = useState([]);
  const [taskLoading, setTaskLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, todo: 0, inProgress: 0, completed: 0 });
  const [attendanceStats, setAttendanceStats] = useState({
    onTime: 0,
    late: 0,
    absent: 0,
    presentDays: 0,
    avgHours: "—",
    avgCheckin: "—",
    avgCheckout: "—",
    onTimeRate: "—",
  });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [overrideMap, setOverrideMap] = useState({});
  const [overTimeData, setOverTimeData] = useState([]);

  // ── Fetch Tasks ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      setTaskLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "tasks"), where("assignedTo", "==", user.uid))
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTasks(all);
        setStats({
          total: all.length,
          todo: all.filter((t) => (t.status || "to-do") === "to-do").length,
          inProgress: all.filter((t) => t.status === "in-progress").length,
          completed: all.filter((t) => t.status === "completed").length,
        });
      } catch (err) {
        console.error("Tasks fetch error:", err);
      }
      setTaskLoading(false);
    };

    fetchTasks();
  }, [user]);

  // ── Fetch Attendance + Overrides ──────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const fetchAttendance = async () => {
      setAttendanceLoading(true);

      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const monthStart = new Date(year, month, 1, 0, 0, 0, 0);

        const snap = await getDocs(
          query(
            collection(db, "timeLogs", user.uid, "sessions"),
            orderBy("startTime", "desc")
          )
        );

        const sessionData = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((s) => {
            const ms = toMs(s.startTime);
            return ms && ms >= monthStart.getTime();
          });

        const dateKeys = getCurrentMonthDateKeys();

        const overrideResults = await Promise.allSettled(
          dateKeys.map((dateKey) =>
            getDoc(doc(db, "attendanceOverrides", `${user.uid}_${dateKey}`))
          )
        );

        const nextOverrideMap = {};

        overrideResults.forEach((result, index) => {
          const dateKey = dateKeys[index];

          if (result.status === "fulfilled") {
            const snap = result.value;
            if (snap.exists() && snap.data()?.status) {
              nextOverrideMap[dateKey] = snap.data();
            }
          } else {
            
          }
        });

        setSessions(sessionData);
        setOverrideMap(nextOverrideMap);
        setAttendanceStats(computeAttendanceStats(sessionData, nextOverrideMap));
        setOverTimeData(buildAttendanceOverTime(sessionData, nextOverrideMap));
      } catch (err) {
        console.error("Attendance fetch error:", err);

        try {
          const now = new Date();
          const year = now.getFullYear();
          const month = now.getMonth();
          const monthStart = new Date(year, month, 1, 0, 0, 0, 0);

          const snap = await getDocs(
            query(
              collection(db, "timeLogs", user.uid, "sessions"),
              orderBy("startTime", "desc")
            )
          );

          const sessionData = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((s) => {
              const ms = toMs(s.startTime);
              return ms && ms >= monthStart.getTime();
            });

          setSessions(sessionData);
          setOverrideMap({});
          setAttendanceStats(computeAttendanceStats(sessionData, {}));
          setOverTimeData(buildAttendanceOverTime(sessionData, {}));
        } catch (fallbackErr) {
          console.error("Attendance fallback fetch error:", fallbackErr);
        }
      }

      setAttendanceLoading(false);
    };

    fetchAttendance();
  }, [user?.uid]);

  // ── Derived values ────────────────────────────────────────────
  const todayTasks = tasks.filter((t) => t.status !== "completed").slice(0, 5);
  const { text: greetText } = getGreeting();
  const workDayMins = 450;
  const activeElapsed = activeSession ? Math.floor(elapsedSeconds / 60) : 0;
  const totalTodayMins = todayMinutes + activeElapsed;

  const todayKey = dayKey(Date.now());
  const todayOverride = overrideMap[todayKey];
  const todaySession = sessions.find((s) => {
    const ms = toMs(s.startTime);
    return ms && dayKey(ms) === todayKey;
  });

  const clockInTime = todaySession?.startTime
    ? new Date(toMs(todaySession.startTime)).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : activeSession
      ? new Date(toMs(activeSession.startTime) || Date.now()).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "—";

  const clockOutTime = todaySession?.endTime
    ? new Date(toMs(todaySession.endTime)).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : activeSession
      ? "Active"
      : "—";

  const lateBy = (() => {
    if (todayOverride?.status === "absent") return null;
    if (!clockInTime || clockInTime === "—" || clockInTime === "Active") return null;

    const [time, period] = clockInTime.split(" ");
    let [h, m] = time.split(":").map(Number);

    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;

    const totalMins = h * 60 + m;
    const diff = totalMins - OFFICE_START_MINS;

    if (diff <= 0) return null;
    return `${Math.floor(diff / 60) > 0 ? Math.floor(diff / 60) + "h " : ""}${diff % 60}min`;
  })();

  const status = (() => {
    if (todayOverride?.status === "absent") return "Absent";
    if (todayOverride?.status === "present") {
      return activeBreak ? "On Break" : activeSession ? "Present" : "Checked Out";
    }
    if (!activeSession && totalTodayMins === 0) return "Absent";
    if (activeBreak) return "On Break";
    if (activeSession) return "Present";
    return "Checked Out";
  })();

  const statusStyle = {
    Absent: "text-red-500",
    "On Break": "text-orange-500",
    Present: "text-emerald-500",
    "Checked Out": "text-blue-500",
  }[status] || "text-gray-500";

  return (
    <Layout title="Dashboard">
      <div className="flex items-start justify-between mb-5 p-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            {greetText}, {userData?.name?.split(" ")[0] || "Employee"}
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5 px-5">
        <StatusBarCard
          icon={UserCheck}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          label="Status"
          value={status}
          valueColor={statusStyle}
          extra={status === "Present" ? "● Live" : undefined}
        />
        <StatusBarCard
          icon={LogIn}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          label="Clock In"
          value={todayOverride?.status === "absent" ? "—" : clockInTime}
        />
        <StatusBarCard
          icon={LogOut}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          label="Clock Out"
          value={todayOverride?.status === "absent" ? "—" : clockOutTime}
          valueColor={clockOutTime === "Active" ? "text-emerald-500" : "text-gray-800"}
        />
        <StatusBarCard
          icon={Timer}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          label="Worked Hours"
          value={todayOverride?.status === "absent" ? "0h 0m" : fmtMins(totalTodayMins)}
          valueColor="text-[#1D7872]"
        />
        <StatusBarCard
          icon={AlertCircle}
          iconBg={lateBy ? "bg-red-50" : "bg-gray-50"}
          iconColor={lateBy ? "text-red-400" : "text-gray-300"}
          label="Late By"
          value={todayOverride?.status === "absent" ? "—" : (lateBy || "On time")}
          valueColor={lateBy ? "text-red-500" : "text-emerald-500"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5 px-5">
        <TodayCard
          todayMins={todayOverride?.status === "absent" ? 0 : totalTodayMins}
          workDayMins={workDayMins}
          activeSession={todayOverride?.status === "absent" ? null : activeSession}
          activeBreak={todayOverride?.status === "absent" ? false : activeBreak}
          breakSeconds={todayOverride?.status === "absent" ? 0 : breakSeconds}
          clockIn={clockIn}
          clockOut={clockOut}
          startBreak={startBreak}
          endBreak={endBreak}
          timerLoading={timerLoading}
          formatTime={formatTime}
          elapsedSeconds={todayOverride?.status === "absent" ? 0 : elapsedSeconds}
        />

        <div className="grid grid-cols-2 gap-3 content-start">
          {attendanceLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-[100px] bg-gray-100 rounded-2xl animate-pulse" />
            ))
          ) : (
            <>
              {[
                { icon: Timer, iconBg: "bg-blue-50", iconColor: "text-[#1D7872]", label: "Avg hours / day", value: attendanceStats.avgHours },
                { icon: LogIn, iconBg: "bg-emerald-50", iconColor: "text-emerald-600", label: "Avg check-in", value: attendanceStats.avgCheckin },
                { icon: TrendingUp, iconBg: "bg-green-50", iconColor: "text-green-600", label: "Avg arrival time", value: attendanceStats.avgCheckin, valueColor: "text-emerald-500" },
                { icon: LogOut, iconBg: "bg-purple-50", iconColor: "text-purple-600", label: "Avg check-out", value: attendanceStats.avgCheckout },
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

        <MyAttendanceCard
          attendanceStats={attendanceStats}
          loading={attendanceLoading}
          onViewStats={() => navigate("/attendance")}
        />
      </div>

      {/* Optional chart */}
      {/* <div className="mb-5 px-5">
        {attendanceLoading ? (
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        ) : (
          <AttendanceOverTimeChart data={overTimeData} />
        )}
      </div> */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 px-5">
        {[
          { Icon: ClipboardList, label: "Total Tasks", value: stats.total, color: "text-[#1D7872]", bg: "bg-blue-50" },
          { Icon: AlertCircle, label: "To Do", value: stats.todo, color: "text-violet-600", bg: "bg-violet-50" },
          { Icon: Loader, label: "In Progress", value: stats.inProgress, color: "text-amber-600", bg: "bg-amber-50" },
          { Icon: CheckCircle2, label: "Completed", value: stats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
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

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mx-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900 text-[15px]">Pending Tasks</h3>
            <p className="text-xs text-gray-400 mt-0.5">Tasks assigned to you</p>
          </div>
          <button
            onClick={() => navigate("/tasks")}
            className="text-[#1D7872] text-sm font-semibold cursor-pointer inline-flex items-center gap-1 hover:opacity-75 transition-opacity border-none bg-transparent p-0"
          >
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
              <div
                key={task.id}
                onClick={() => navigate("/tasks")}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${priorityFlagClass(task.priority)}`}>
                    <Flag size={13} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-[#1D7872] transition-colors">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {task.department || task.category || "Work"} ·{" "}
                      <span className={`font-medium ${priorityTextClass(task.priority)}`}>
                        {priorityLabel(task.priority)}
                      </span>{" "}
                      ·{" "}
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
                  <ChevronRight size={13} className="text-gray-200 group-hover:text-[#1D7872] transition-colors" />
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