import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import {
  BookOpen,
  Users,
  TrendingUp,
  CheckCircle,
  Clock,
  Search,
  ChevronDown,
  ArrowRight,
  X,
  Eye,
  MessageSquare,
  Filter,
  Download,
  Sparkles,
  Award,
  Brain,
  Layers,
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
const toJsDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const p = new Date(value);
  return isNaN(p.getTime()) ? null : p;
};

const fmtDate = (val) => {
  const d = toJsDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtDateTime = (val) => {
  const d = toJsDate(val);
  if (!d) return "—";
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
};

const CONFIDENCE_MAP = {
  beginner:  { label: "Just Started",      emoji: "", bg: "bg-gray-100",   text: ""   },
  learning:  { label: "Still Learning",    emoji: "", bg: "bg-blue-50",    text: ""   },
  confident: { label: "Confident",         emoji: "", bg: "bg-green-50",   text: ""  },
  expert:    { label: "Can Teach Others",  emoji: "", bg: "bg-amber-50",   text: ""  },
};

const CAT_COLORS = {

};

const AVATAR_COLORS = [
  "bg-[#1D7872]",
];

const getAvatarColor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// ─── Sub-components ────────────────────────────────────────────────
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
  <div className="bg-white flex flex-col border border-gray-100 rounded-2xl shadow-sm">
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      <div className="flex items-center gap-2">
        {rightExtra}
        {onAction && (
          <button
            onClick={onAction}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            {actionLabel} <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const ConfidenceBadge = ({ level }) => {
  const c = CONFIDENCE_MAP[level] || CONFIDENCE_MAP.learning;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${c.bg} ${c.text}`}>
      {c.emoji} {c.label}
    </span>
  );
};

const CategoryBadge = ({ category }) => {
  const color = CAT_COLORS[category] ;
  return (
    <span
      className="inline-flex text-[10px] font-bold px-2.5 py-1 rounded-lg"
      
    >
      {category}
    </span>
  );
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-3 py-2 text-xs">
      <p className="font-bold text-gray-500 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.fill }}>
          {p.dataKey}: <span className="font-black">{p.value}</span>
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

// ─── Detail Slide-over Panel ───────────────────────────────────────
const DetailPanel = ({ entry, onClose, onComment }) => {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!entry) return null;

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      await onComment(entry.id, comment.trim());
      setComment("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg h-full bg-white flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0 ${getAvatarColor(entry.employeeName)}`}>
              {getInitials(entry.employeeName)}
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">{entry.employeeName || "Employee"}</p>
              <p className="text-[11px] text-gray-400 font-medium">{fmtDateTime(entry.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title + badges */}
          <div>
            <h2 className="text-base font-black text-gray-900 mb-3">{entry.title}</h2>
            <div className="flex flex-wrap gap-2">
              <CategoryBadge category={entry.category} />
              <ConfidenceBadge level={entry.confidence} />
              {entry.hours && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500">
                  <Clock size={10} /> {entry.hours}h
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">What they learned</p>
            <p className="text-sm text-gray-700 leading-relaxed">{entry.description}</p>
          </div>

          {/* Source */}
          {entry.source && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <BookOpen size={13} className="text-gray-400" />
              <span className="font-semibold">Source:</span>
              <span>{entry.source}</span>
            </div>
          )}

          {/* Tags */}
          {entry.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entry.tags.map((t) => (
                <span key={t} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Admin Learning Component ────────────────────────────────
export default function LearningAdmin() {
  const navigate = useNavigate();
  const { adminData } = useAuthStore();

  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [confFilter, setConfFilter] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Fetch
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [empSnap, entrySnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(query(collection(db, "learningEntries"), orderBy("createdAt", "desc"))),
        ]);
        const empList = empSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const empMap = {};
        empList.forEach((e) => { empMap[e.uid || e.id] = e.name || e.displayName || e.email || "Employee"; });

        const entryList = entrySnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            employeeName: empMap[data.employeeUid] || data.employeeName || "Employee",
          };
        });
        setEmployees(empList);
        setEntries(entryList);
      } catch (err) {
        console.error("LearningAdmin fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Comment handler
  const handleComment = async (entryId, text) => {
    const ref = doc(db, "learningEntries", entryId);
    const comment = { by: adminData?.name || "Admin", text, at: new Date().toISOString() };
    const entry = entries.find((e) => e.id === entryId);
    const updated = [...(entry?.adminComments || []), comment];
    await updateDoc(ref, { adminComments: updated });
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, adminComments: updated } : e))
    );
    if (selectedEntry?.id === entryId) {
      setSelectedEntry((prev) => ({ ...prev, adminComments: updated }));
    }
  };

  // Derived stats
  const stats = useMemo(() => {
    const totalEntries = entries.length;
    const uniqueLearners = new Set(entries.map((e) => e.employeeUid)).size;
    const totalHours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    const expertCount = entries.filter((e) => e.confidence === "expert").length;
    return { totalEntries, uniqueLearners, totalHours: totalHours.toFixed(1), expertCount };
  }, [entries]);

  // Category chart data
  const categoryChartData = useMemo(() => {
    const counts = {};
    entries.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name: name.split(" ")[0], fullName: name, value, color:  "#1D7872" }));
  }, [entries]);

  // Per-employee stats for leaderboard
  const employeeStats = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      if (!map[e.employeeUid]) {
        map[e.employeeUid] = { name: e.employeeName, count: 0, hours: 0, expert: 0 };
      }
      map[e.employeeUid].count++;
      map[e.employeeUid].hours += parseFloat(e.hours) || 0;
      if (e.confidence === "expert") map[e.employeeUid].expert++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [entries]);

  // Confidence pie
  const confPieData = useMemo(() => {
    const counts = { beginner: 0, learning: 0, confident: 0, expert: 0 };
    entries.forEach((e) => { if (counts[e.confidence] !== undefined) counts[e.confidence]++; });
    return [
      { name: "Just Started",   value: counts.beginner,  color: "#9CA3AF" },
      { name: "Still Learning", value: counts.learning,  color: "#1D7872" },
      { name: "Confident",      value: counts.confident, color: "#22C55E" },
      { name: "Expert",         value: counts.expert,    color: "#F59E0B" },
    ].filter((d) => d.value > 0);
  }, [entries]);

  // Filtered list
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const q = search.toLowerCase();
      const matchQ = !q || e.title?.toLowerCase().includes(q) || e.employeeName?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q);
      const matchCat = !catFilter || e.category === catFilter;
      const matchEmp = !empFilter || e.employeeUid === empFilter || e.employeeName === empFilter;
      const matchConf = !confFilter || e.confidence === confFilter;
      return matchQ && matchCat && matchEmp && matchConf;
    });
  }, [entries, search, catFilter, empFilter, confFilter]);

  // CSV export
  const exportCSV = () => {
    const headers = ["Employee", "Title", "Category", "Confidence", "Hours", "Source", "Tags", "Date"];
    const rows = filtered.map((e) => [
      e.employeeName, `"${e.title}"`, e.category, e.confidence,
      e.hours, e.source || "", (e.tags || []).join(";"), fmtDate(e.createdAt),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `learning-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const categories = [...new Set(entries.map((e) => e.category))].filter(Boolean);
  const empOptions = [...new Map(entries.map((e) => [e.employeeUid, e.employeeName])).entries()];

  return (
    <Layout title="Learning — Admin">
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-2xl font-black text-gray-900">Learning Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Monitor and review employee learning submissions.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard icon={BookOpen}    label="Total Entries"     value={stats.totalEntries}   iconBg="bg-blue-50"   iconColor="text-blue-600"   loading={loading} />
        <StatCard icon={Users}       label="Active Learners"   value={stats.uniqueLearners} iconBg="bg-green-50"  iconColor="text-green-600"  loading={loading} />
        <StatCard icon={Clock}       label="Total Hours"       value={stats.totalHours + "h"} iconBg="bg-amber-50" iconColor="text-amber-500" loading={loading} />
        <StatCard icon={Award}       label="Expert Level"      value={stats.expertCount}    iconBg="bg-purple-50" iconColor="text-purple-600" loading={loading} />
      </div>

      {/* Charts Row */}
      {/* <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4 mb-4">
       
        <SectionCard title="Entries by Category">
          {loading ? (
            <div className="h-56 bg-gray-50 rounded-xl animate-pulse" />
          ) : categoryChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryChartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {categoryChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

       
        <SectionCard title="Confidence Distribution">
          {loading ? (
            <div className="h-56 bg-gray-50 rounded-xl animate-pulse" />
          ) : confPieData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-gray-400">No data yet</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={confPieData} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={64} strokeWidth={0} startAngle={90} endAngle={-270}>
                    {confPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {confPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <p className="text-xs font-semibold text-gray-600 truncate">{item.name}</p>
                    </div>
                    <p className="text-xs font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div> */}

      {/* Leaderboard + All Entries */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-4 mb-4">
        {/* Top Learners */}
        <SectionCard title="Top Learners">
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : employeeStats.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">No submissions yet</div>
          ) : (
            <div className="space-y-3">
              {employeeStats.map((emp, idx) => (
                <div key={emp.name} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${getAvatarColor(emp.name)}`}>
                    {getInitials(emp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{emp.name}</p>
                    <p className="text-[11px] text-gray-400">{emp.count} entries · {emp.hours.toFixed(1)}h</p>
                  </div>
                  {emp.expert > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600">
                      {emp.expert} expert
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* All Entries */}
        <SectionCard
          title={`All Entries (${filtered.length})`}
          rightExtra={
            <button onClick={exportCSV} className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-100">
              <Download size={11} /> Export
            </button>
          }
        >
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 bg-gray-50"
                placeholder="Search employee or topic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 cursor-pointer"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 cursor-pointer"
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
            >
              <option value="">All Employees</option>
              {empOptions.map(([uid, name]) => <option key={uid} value={name}>{name}</option>)}
            </select>
            <select
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-blue-400 cursor-pointer"
              value={confFilter}
              onChange={(e) => setConfFilter(e.target.value)}
            >
              <option value="">All Levels</option>
              {Object.entries(CONFIDENCE_MAP).map(([k, v]) => <option key={k} value={k}> {v.label}</option>)}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No entries match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Employee", "Topic", "Category", "Level", "Hours", "Date", ""].map((h) => (
                      <th key={h} className="text-left pb-2.5 px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 ${getAvatarColor(entry.employeeName)}`}>
                            {getInitials(entry.employeeName)}
                          </div>
                          <span className="font-semibold text-gray-800 whitespace-nowrap">{entry.employeeName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 max-w-[180px]">
                        <p className="font-semibold text-gray-800 truncate">{entry.title}</p>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <CategoryBadge category={entry.category} />
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <ConfidenceBadge level={entry.confidence} />
                      </td>
                      <td className="py-2.5 px-2 tabular-nums text-gray-500 font-semibold">{entry.hours || "—"}h</td>
                      <td className="py-2.5 px-2 text-gray-400 whitespace-nowrap">{fmtDate(entry.createdAt)}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 rounded-lg  text-gray-400 hover:text-[#1D7872] cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}>
                            <Eye size={13} />
                          </button>
                        
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Detail Panel */}
      {selectedEntry && (
        <DetailPanel
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onComment={handleComment}
        />
      )}
    </Layout>
  );
}