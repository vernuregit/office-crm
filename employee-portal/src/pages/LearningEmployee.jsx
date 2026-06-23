import { useState, useMemo, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import {
  BookOpen,
  Clock,
  Flame,
  Send,
  Trash2,
  ChevronDown,
  MessageSquare,
  CheckCircle,
  Layers,
  X,
  Plus,
  Pencil,
  CalendarDays,
} from "lucide-react";

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
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const CONFIDENCE_MAP = {
  beginner:  { label: "Just Started",   bg: "bg-gray-100", text: "text-gray-500"  },
  learning:  { label: "Still Learning", bg: "bg-blue-50",  text: "text-blue-600"  },
  confident: { label: "Confident",      bg: "bg-green-50", text: "text-green-600" },
};

const CAT_COLORS = {};
const getCatColor = (cat) => CAT_COLORS[cat] || "#1D7872";

// ─── Stat Card ────────────────────────────────────────────────────
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

// ─── Confidence Badge ─────────────────────────────────────────────
const ConfidenceBadge = ({ level }) => {
  const c = CONFIDENCE_MAP[level] || CONFIDENCE_MAP.learning;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

// ─── Category Badge ───────────────────────────────────────────────
const CategoryBadge = ({ category }) => {
  const color = getCatColor(category);
  return (
    <span
      className="inline-flex text-[10px] font-bold px-2.5 py-1 rounded-lg"
      style={{ background: color + "18", color }}
    >
      {category}
    </span>
  );
};

// ─── Progress Log Modal ───────────────────────────────────────────
const ProgressLogModal = ({ open, onClose, entry, onAddProgress }) => {
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [confidence, setConfidence] = useState(entry?.confidence || "learning");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      setConfidence(entry?.confidence || "learning");
    }
  }, [open, entry]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !entry) return null;

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await onAddProgress(entry.id, { note: note.trim(), date, confidence });
    setSaving(false);
    onClose();
  };

  const logs = entry.progressLog || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[11px] font-bold text-[#1D7872] uppercase tracking-wide mb-0.5">Progress Log</p>
            <h2 className="text-sm font-black text-gray-900 truncate">{entry.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Add new progress */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-700">Add today's progress</p>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#1D7872] text-gray-700 cursor-pointer"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">
                What did you work on / learn today? <span className="text-red-400">*</span>
              </label>
              <textarea
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#1D7872] text-gray-800 placeholder-gray-300 resize-none leading-relaxed"
                rows={3}
                maxLength={600}
                placeholder="e.g., Finished chapter 3, practiced useState patterns, reviewed docs..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="text-[11px] text-gray-400 mt-1 text-right">{note.length}/600</p>
            </div>

            {/* Confidence update */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5">Update confidence level</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CONFIDENCE_MAP).map(([key, val]) => (
                  <label key={key} className="cursor-pointer">
                    <input
                      type="radio"
                      name="progress-confidence"
                      value={key}
                      checked={confidence === key}
                      onChange={() => setConfidence(key)}
                      className="sr-only"
                    />
                    <span
                      className={`inline-flex items-center text-[11px] font-bold px-3 py-1.5 rounded-xl border-2 transition-all ${
                        confidence === key
                          ? "border-[#1D7872] bg-[#1D7872] text-white"
                          : "border-gray-100 bg-white text-gray-500 hover:border-gray-200"
                      }`}
                    >
                      {val.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !note.trim()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1D7872] rounded-xl hover:bg-[#155E5A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={13} />
              {saving ? "Saving..." : "Add Progress"}
            </button>
          </div>

          {/* Progress timeline */}
          {logs.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">
                Progress History ({logs.length} entries)
              </p>
              <div className="relative space-y-0">
                {/* Vertical line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100" />

                {[...logs].reverse().map((log, i) => (
                  <div key={i} className="flex gap-3 pb-4 last:pb-0">
                    {/* Dot */}
                    <div className="flex-shrink-0 w-8 flex justify-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#1D7872] border-2 border-white shadow-sm" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400">
                          <CalendarDays size={10} />
                          {fmtDate(log.date)}
                        </span>
                        <ConfidenceBadge level={log.confidence} />
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">{log.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDays size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-400">No progress entries yet</p>
              <p className="text-[11px] text-gray-300 mt-0.5">Add your first update above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Entry Card ───────────────────────────────────────────────────
const EntryCard = ({ entry, onDelete, onOpenProgress }) => {
  const [expanded, setExpanded] = useState(false);
  const logs = entry.progressLog || [];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div
        className="flex items-start justify-between px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <CategoryBadge category={entry.category} />
            <ConfidenceBadge level={entry.confidence} />
            {entry.adminComments?.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600">
                <MessageSquare size={10} /> {entry.adminComments.length} feedback
              </span>
            )}
            {logs.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#1D7872]/10 text-[#1D7872]">
                <CalendarDays size={10} /> {logs.length} updates
              </span>
            )}
          </div>
          <h4 className="text-sm font-black text-gray-900 truncate">{entry.title}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-gray-400 font-medium">{fmtDate(entry.createdAt)}</span>
            {entry.hours && (
              <span className="flex items-center gap-0.5 text-[11px] text-gray-400 font-medium">
                <Clock size={10} /> {entry.hours}h
              </span>
            )}
            {entry.source && (
              <span className="text-[11px] text-gray-400 font-medium truncate max-w-[120px]">
                {entry.source}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Progress button */}
          <button
            className="p-1.5 rounded-lg hover:bg-[#1D7872]/10 text-gray-300 hover:text-[#1D7872] transition-colors"
            title="Log progress"
            onClick={(e) => { e.stopPropagation(); onOpenProgress(entry); }}
          >
            <Pencil size={13} />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
          >
            <Trash2 size={13} />
          </button>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
          <p className="text-sm text-gray-600 leading-relaxed pt-4">{entry.description}</p>

          {/* Latest progress snapshot */}
          {logs.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                Latest Progress
              </p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
                    <CalendarDays size={10} />
                    {fmtDate(logs[logs.length - 1]?.date)}
                  </span>
                  <ConfidenceBadge level={logs[logs.length - 1]?.confidence} />
                </div>
                <p className="text-xs text-gray-600">{logs[logs.length - 1]?.note}</p>
                {logs.length > 1 && (
                  <button
                    className="mt-2 text-[11px] font-bold text-[#1D7872] hover:underline"
                    onClick={(e) => { e.stopPropagation(); onOpenProgress(entry); }}
                  >
                    View all {logs.length} updates →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Admin comments */}
          {entry.adminComments?.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Admin Feedback</p>
              {entry.adminComments.map((c, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">
                    AD
                  </div>
                  <div className="bg-blue-50 rounded-xl px-3 py-2 flex-1">
                    <p className="text-[11px] font-bold text-blue-700">{c.by}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Log Form Modal ───────────────────────────────────────────────
const LogFormModal = ({ open, onClose, onSubmit, submitting }) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [hours, setHours] = useState("1");
  const [confidence, setConfidence] = useState("learning");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const reset = () => {
    setTitle(""); setCategory(""); setDescription("");
    setSource(""); setHours("1"); setConfidence("learning");
    setDate(new Date().toISOString().split("T")[0]);
  };

  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = async () => {
    await onSubmit({ title, category, description, source, hours, confidence, date });
    reset();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-black text-gray-900">Learning Entry</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Share what you learned today</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Topic <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#1D7872] text-gray-800 placeholder-gray-300"
                placeholder="Topic"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Category <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#1D7872] text-gray-800 placeholder-gray-300"
                placeholder="e.g., Technical Skills, Leadership..."
                maxLength={60}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Time Spent</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#1D7872] text-gray-700 cursor-pointer"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              >
                {[["0.5","30 minutes"],["1","1 hour"],["1.5","1.5 hours"],["2","2 hours"],["3","3 hours"],["4","4 hours"],["5","5+ hours"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-gray-700">
                  What did you learn? <span className="text-red-400">*</span>
                </label>
                <span className="text-[11px] text-gray-400">{description.length}/1200</span>
              </div>
              <textarea
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#1D7872] text-gray-800 placeholder-gray-300 resize-none leading-relaxed"
                rows={4}
                maxLength={1200}
                placeholder="Describe what you learned, key takeaways, or insights gained..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Source / Resource</label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#1D7872] text-gray-800 placeholder-gray-300"
                placeholder="e.g., React docs, Udemy, YouTube..."
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-[#1D7872] text-gray-700 cursor-pointer"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-2">
                How confident are you in this topic now?
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(CONFIDENCE_MAP).map(([key, val]) => (
                  <label key={key} className="cursor-pointer">
                    <input type="radio" name="modal-confidence" value={key} checked={confidence === key} onChange={() => setConfidence(key)} className="sr-only" />
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border-2 transition-all ${
                      confidence === key ? "border-[#1D7872] bg-[#1D7872] text-white" : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200"
                    }`}>
                      {val.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#1D7872] cursor-pointer rounded-xl hover:bg-[#155E5A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={submitting}
          >
            <Send size={13} />
            {submitting ? "Submitting..." : "Submit Entry"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────
export default function LearningEmployee() {
  const { employeeData, user } = useAuthStore();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [progressEntry, setProgressEntry] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!user?.uid) return;
    const fetchEntries = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "learningEntries"),
            where("employeeUid", "==", user.uid),
            orderBy("createdAt", "desc")
          )
        );
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("LearningEmployee fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [user?.uid]);

  const handleSubmit = async ({ title, category, description, source, hours, confidence, date }) => {
    if (!title.trim() || !category.trim() || !description.trim()) {
      showToast("Please fill in all required fields.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        employeeUid: user.uid,
        employeeName: employeeData?.name || employeeData?.displayName || user.email,
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        source: source.trim() || null,
        hours: parseFloat(hours),
        confidence,
        date,
        createdAt: serverTimestamp(),
        adminComments: [],
        progressLog: [],
      };
      const ref = await addDoc(collection(db, "learningEntries"), payload);
      setEntries((prev) => [{ id: ref.id, ...payload, createdAt: new Date() }, ...prev]);
      setModalOpen(false);
      showToast("Learning entry submitted! 🎉");
    } catch (err) {
      console.error(err);
      showToast("Failed to submit. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Add a progress log entry to an existing learning entry
  const handleAddProgress = async (entryId, { note, date, confidence }) => {
    const newLog = { note, date, confidence, addedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "learningEntries", entryId), {
        progressLog: arrayUnion(newLog),
        confidence, // also update the top-level confidence
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, confidence, progressLog: [...(e.progressLog || []), newLog] }
            : e
        )
      );
      // Update progressEntry state so the modal reflects new data
      setProgressEntry((prev) =>
        prev?.id === entryId
          ? { ...prev, confidence, progressLog: [...(prev.progressLog || []), newLog] }
          : prev
      );
      showToast("Progress logged! 📅");
    } catch (err) {
      console.error(err);
      showToast("Failed to save progress.", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await deleteDoc(doc(db, "learningEntries", id));
    setEntries((prev) => prev.filter((e) => e.id !== id));
    showToast("Entry deleted.", "info");
  };

  const stats = useMemo(() => {
    const totalHours = entries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
    const catCounts = {};
    entries.forEach((e) => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    const sortedDates = [
      ...new Set(entries.map((e) => {
        const d = toJsDate(e.createdAt);
        return d ? d.toISOString().split("T")[0] : null;
      }).filter(Boolean)),
    ].sort((a, b) => b.localeCompare(a));
    let streak = 0;
    let cur = new Date();
    cur.setHours(0, 0, 0, 0);
    for (const dateStr of sortedDates) {
      if (dateStr === cur.toISOString().split("T")[0]) { streak++; cur.setDate(cur.getDate() - 1); }
      else break;
    }
    return { total: entries.length, totalHours: totalHours.toFixed(1), topCat, streak };
  }, [entries]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return entries;
    return entries.filter((e) => e.category === activeFilter);
  }, [entries, activeFilter]);

  const categories = [...new Set(entries.map((e) => e.category))].filter(Boolean);

  return (
    <Layout title="My Learning">
      <div className="mb-5 p-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">My Learning Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your growth</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D7872] cursor-pointer text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md"
        >
          <Plus size={14} /> Learning
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 px-5">
        <StatCard icon={BookOpen} label="Total Entries"  value={stats.total}                  iconBg="bg-blue-50"   iconColor="text-blue-600"   loading={loading} />
        <StatCard icon={Clock}    label="Hours Logged"   value={stats.totalHours + "h"}        iconBg="bg-amber-50"  iconColor="text-amber-500"  loading={loading} />
        <StatCard icon={Layers}   label="Top Category"   value={stats.topCat.split(" ")[0]}    iconBg="bg-purple-50" iconColor="text-purple-600" loading={loading} />
        <StatCard icon={Flame}    label="Day Streak"     value={`${stats.streak}d`}            iconBg="bg-orange-50" iconColor="text-orange-500" loading={loading} />
      </div>

      <div className="mt-2 mx-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900">
            My Entries
            <span className="ml-2 text-xs font-semibold text-gray-400">({filtered.length})</span>
          </h3>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setActiveFilter("all")}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-colors ${
              activeFilter === "all"
                ? "bg-[#1D7872] border-[#1D7872] text-white"
                : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"
            }`}
          >
            All
          </button>
          {categories.map((cat) => {
            const color = getCatColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all ${
                  activeFilter === cat ? "text-white" : "bg-white text-gray-500 hover:border-gray-300"
                }`}
                style={
                  activeFilter === cat
                    ? { background: color, borderColor: color }
                    : { borderColor: "#e5e7eb" }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-white border border-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <BookOpen size={40} className="text-gray-200 mx-auto mb-3" />
            <h3 className="text-sm font-black text-gray-700">No entries yet</h3>
            <p className="text-xs text-gray-400 mt-1 mb-4">Start logging your learnings to track your growth.</p>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#1D7872] rounded-xl hover:bg-[#155E5A] transition-colors"
            >
              <Plus size={13} />  start learning
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
                onOpenProgress={(e) => setProgressEntry(e)}
              />
            ))}
          </div>
        )}
      </div>

      <LogFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      <ProgressLogModal
        open={!!progressEntry}
        onClose={() => setProgressEntry(null)}
        entry={progressEntry}
        onAddProgress={handleAddProgress}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg text-sm font-bold text-white ${
          toast.type === "error" ? "bg-red-500" : toast.type === "info" ? "bg-blue-500" : "bg-green-500"
        }`}>
          <CheckCircle size={16} />
          {toast.msg}
        </div>
      )}
    </Layout>
  );
}