import { useEffect, useState, useRef } from "react";
import {
  collection, query, where,
  onSnapshot, addDoc, serverTimestamp
} from "firebase/firestore";
import { db }       from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout       from "../components/Layout";
import StatusBadge  from "../components/StatusBadge";
import {
  CalendarOff, Plus, X, Send,
  Loader2, CheckCircle, AlertCircle,
  Calendar, Clock, FileText, Tag, ChevronRight
} from "lucide-react";

const LEAVE_TYPES = [
  "Casual Leave", "Sick Leave", "Emergency Leave",
  "Work From Home", "Half Day", "Other",
];

const fmt = (ymd) => {
  if (!ymd) return null;
  return new Date(ymd).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
};

const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const diff = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
  return diff < 0 ? 0 : Math.round(diff) + 1;
};

// ─── Leave Form ───────────────────────────────────────────────────
const LeaveForm = ({ onSubmit, onCancel }) => {
  const [leaveType,  setLeaveType]  = useState(LEAVE_TYPES[0]);
  const [fromDate,   setFromDate]   = useState("");
  const [toDate,     setToDate]     = useState("");
  const [reason,     setReason]     = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pickerRef = useRef(null);

  const today = new Date().toISOString().split("T")[0];

  // Close popup on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        // Only close if both dates are filled or neither is
        if (fromDate) setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPicker, fromDate]);

  const days = daysBetween(fromDate, toDate || fromDate);

  const handleFromChange = (val) => {
    setFromDate(val);
    // Reset toDate if it's before the new fromDate
    if (toDate && toDate < val) setToDate(val);
  };

  const handleConfirm = () => {
    if (!fromDate) return;
    if (!toDate) setToDate(fromDate); // single day
    setShowPicker(false);
  };

  const handleClear = () => {
    setFromDate("");
    setToDate("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromDate || !reason.trim()) return;
    const finalTo = toDate || fromDate;
    setSubmitting(true);
    await onSubmit({
      leaveType,
      fromDate,
      toDate: finalTo,
      reason,
      days: daysBetween(fromDate, finalTo),
    });
    setSubmitting(false);
  };

  const hasDate   = !!fromDate;
  const finalDays = daysBetween(fromDate, toDate || fromDate);

  const displayLabel = () => {
    if (!fromDate) return null;
    if (!toDate || toDate === fromDate) return `${fmt(fromDate)} (1 day)`;
    return `${fmt(fromDate)}  →  ${fmt(toDate)}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] p-6 mb-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A499] flex items-center justify-center">
            <CalendarOff size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-base">Apply for Leave</h3>
            <p className="text-xs text-gray-400 font-medium">Submit your leave request</p>
          </div>
        </div>
        <button onClick={onCancel}
          className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer">
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Leave Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
          <div className="relative">
            <Tag size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499]
                         transition-all bg-white appearance-none cursor-pointer">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Date Trigger Button */}
        <div className="relative">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Select Leave Date(s)
          </label>

          <button type="button" onClick={() => setShowPicker(!showPicker)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border
                        text-sm font-medium transition-all cursor-pointer
                        ${hasDate
                          ? "border-[#00A499] bg-teal-50 text-[#00A499]"
                          : "border-gray-200 bg-white text-gray-400 hover:border-[#00A499] hover:bg-teal-50/20"
                        }`}>
            <div className="flex items-center gap-3">
              <Calendar size={16} className={hasDate ? "text-[#00A499]" : "text-gray-400"} />
              <span className={hasDate ? "font-bold text-[#00A499]" : ""}>
                {displayLabel() || "Click to pick date(s)"}
              </span>
            </div>
            <ChevronRight size={16}
              className={`transition-transform duration-200 text-gray-400
                          ${showPicker ? "rotate-90" : ""}`} />
          </button>

          {/* Popup */}
          {showPicker && (
            <div ref={pickerRef}
              className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200
                         rounded-2xl shadow-2xl p-5 z-50">

              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">
                📅 Pick your leave dates
              </p>

              <div className="space-y-3">
                {/* From Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">
                    Start Date <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00A499] pointer-events-none" />
                    <input type="date"
                      value={fromDate}
                      min={today}
                      onChange={(e) => handleFromChange(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-4 py-2.5
                                 text-sm font-semibold text-gray-800
                                 focus:outline-none focus:border-[#00A499] focus:ring-2
                                 focus:ring-[#00A499]/20 transition-all bg-white cursor-pointer" />
                  </div>
                </div>

                {/* Divider with arrow */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-bold px-2">to</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">
                    End Date
                    <span className="ml-1.5 text-gray-400 font-normal normal-case">
                      (leave blank = 1 day)
                    </span>
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00A499] pointer-events-none" />
                    <input type="date"
                      value={toDate}
                      min={fromDate || today}
                      onChange={(e) => setToDate(e.target.value)}
                      disabled={!fromDate}
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-4 py-2.5
                                 text-sm font-semibold text-gray-800
                                 focus:outline-none focus:border-[#00A499] focus:ring-2
                                 focus:ring-[#00A499]/20 transition-all bg-white cursor-pointer
                                 disabled:opacity-40 disabled:cursor-not-allowed" />
                  </div>
                </div>

                {/* Live days preview inside popup */}
                {fromDate && (
                  <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <Clock size={13} className="text-[#00A499]" />
                    <p className="text-sm font-black text-[#00A499]">
                      {finalDays === 1
                        ? `1 day — ${fmt(fromDate)}`
                        : `${finalDays} days — ${fmt(fromDate)} to ${fmt(toDate)}`
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Popup Buttons */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={handleConfirm}
                  disabled={!fromDate}
                  className="flex-1 bg-[#00A499] text-white text-sm font-bold py-2.5
                             rounded-xl hover:opacity-90 transition-all cursor-pointer
                             disabled:opacity-40 disabled:cursor-not-allowed">
                  ✓ Confirm
                  {fromDate ? ` — ${finalDays} Day${finalDays !== 1 ? "s" : ""}` : ""}
                </button>
                {hasDate && (
                  <button type="button" onClick={handleClear}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500
                               text-sm font-semibold hover:bg-gray-50 transition-all cursor-pointer">
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary pill outside popup */}
        {hasDate && !showPicker && (
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
            <Clock size={14} className="text-[#00A499] flex-shrink-0" />
            <p className="text-sm font-bold text-[#00A499]">
              {finalDays === 1
                ? `1 day leave — ${fmt(fromDate)}`
                : `${finalDays} days leave — ${fmt(fromDate)} to ${fmt(toDate)}`
              }
            </p>
            <button type="button" onClick={() => setShowPicker(true)}
              className="ml-auto text-xs text-[#00A499] underline font-semibold cursor-pointer">
              Change
            </button>
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason</label>
          <div className="relative">
            <FileText size={15} className="absolute left-4 top-3.5 text-gray-400 pointer-events-none" />
            <textarea rows={3} value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe the reason for your leave..."
              required
              className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499]
                         transition-all bg-white resize-none" />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm
                       font-semibold hover:bg-gray-50 transition-all cursor-pointer">
            Cancel
          </button>
          <button type="submit"
            disabled={submitting || !hasDate || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A499] text-white
                       text-sm font-bold hover:opacity-90 transition-all
                       disabled:opacity-50 shadow-md cursor-pointer">
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Submitting...</>
              : <><Send size={14} /> Submit {finalDays > 0 ? `${finalDays} Day${finalDays !== 1 ? "s" : ""}` : "Request"}</>
            }
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Leave Card ───────────────────────────────────────────────────
const LeaveCard = ({ leave }) => {
  const statusColors = {
    pending:  { bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400"   },
    approved: { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400" },
    rejected: { bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400"     },
  };
  const sc = statusColors[leave.status] || statusColors.pending;

  return (
    <div className={`rounded-2xl border p-4 ${sc.bg} ${sc.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
            <p className="text-sm font-bold text-gray-800">{leave.leaveType}</p>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            {leave.fromDate === leave.toDate
              ? leave.fromDate
              : `${leave.fromDate} → ${leave.toDate}`
            }
            {" · "}
            <span className="font-bold">{leave.days} day{leave.days !== 1 ? "s" : ""}</span>
          </p>
        </div>
        <StatusBadge status={leave.status} />
      </div>

      <p className="text-xs text-gray-600 font-medium leading-relaxed bg-white/60 rounded-xl px-3 py-2.5 border border-white/80">
        {leave.reason}
      </p>

      {(leave.adminNote || leave.rejectReason) && (
        <div className="mt-2.5 flex items-start gap-2 text-xs font-medium text-gray-600 bg-white/60 rounded-xl px-3 py-2 border border-white/80">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5 text-gray-600" />
          <span>
            <span className="font-bold text-gray-700">Admin note: </span>
            {leave.adminNote || leave.rejectReason}
          </span>
        </div>
      )}

      <p className="text-xs text-gray-400 font-medium mt-2.5">
        Applied on{" "}
        {leave.createdAt
          ? new Date(leave.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric",
            })
          : "—"}
      </p>
    </div>
  );
};

// ─── Leave Page ───────────────────────────────────────────────────
const Leave = () => {
  const { user, userData }      = useAuthStore();
  const [leaves,   setLeaves]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter,   setFilter]   = useState("all");
  const [success,  setSuccess]  = useState("");
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");

    const q = query(
      collection(db, "leaveRequests"),
      where("employeeId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setLeaves(data);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError("Failed to load leave requests. Please refresh.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async ({ leaveType, fromDate, toDate, reason, days }) => {
    await addDoc(collection(db, "leaveRequests"), {
      employeeId:   user.uid,
      employeeName: userData?.name || "Employee",
      department:   userData?.department || "",
      leaveType, fromDate, toDate, reason, days,
      status:    "pending",
      adminNote: "",
      createdAt: serverTimestamp(),
    });
    setShowForm(false);
    setSuccess("Leave request submitted! Waiting for admin approval.");
    setTimeout(() => setSuccess(""), 5000);
  };

  const filtered = filter === "all" ? leaves : leaves.filter((l) => l.status === filter);

  const stats = {
    total:     leaves.length,
    pending:   leaves.filter((l) => l.status === "pending").length,
    approved:  leaves.filter((l) => l.status === "approved").length,
    rejected:  leaves.filter((l) => l.status === "rejected").length,
    totalDays: leaves.filter((l) => l.status === "approved").reduce((s, l) => s + (l.days || 0), 0),
  };

  return (
    <Layout title="Leave Management">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Requests", value: stats.total,     color: "text-gray-700"    },
          { label: "Pending",        value: stats.pending,   color: "text-amber-600"   },
          { label: "Approved",       value: stats.approved,  color: "text-emerald-600" },
          { label: "Days Taken",     value: stats.totalDays, color: "text-[#00A499]"   },
        ].map((s) => (
          <div key={s.label}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700
                        text-sm rounded-2xl px-4 py-3 mb-4">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700
                        text-sm rounded-2xl px-4 py-3 mb-4">
          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
          {success}
        </div>
      )}

      {showForm && (
        <LeaveForm onSubmit={handleSubmit} onCancel={() => setShowForm(false)} />
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "approved", "rejected"].map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all cursor-pointer
                ${filter === tab
                  ? "bg-[#00A499] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-[#00A499]"
                }`}>
              {tab}
              {tab !== "all" && stats[tab] > 0 && (
                <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full
                  ${filter === tab ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"}`}>
                  {stats[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00A499] cursor-pointer text-white
                       rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md">
            <Plus size={15} /> Apply Leave
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <CalendarOff size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium text-gray-500">
            {leaves.length === 0 ? "No leave requests yet" : `No ${filter} requests`}
          </p>
          {leaves.length === 0 && (
            <button onClick={() => setShowForm(true)}
              className="mt-3 text-[#00A499] text-sm font-semibold hover:underline cursor-pointer">
              Apply for your first leave →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((leave) => (
            <LeaveCard key={leave.id} leave={leave} />
          ))}
        </div>
      )}
    </Layout>
  );
};

export default Leave;