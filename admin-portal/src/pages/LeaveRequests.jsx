import { useEffect, useState } from "react";
import {
  collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, serverTimestamp,
  query, orderBy, onSnapshot
} from "firebase/firestore";
import { db } from "../firebase/config";
import Layout from "../components/Layout";
import {
  Plus, Search, X, CalendarDays,
  CheckCircle2, AlertCircle, XCircle,
  Clock, ChevronDown, Filter,
  User, FileText, Trash2, Check
} from "lucide-react";


// ─── Constants ────────────────────────────────────────────────────
const LEAVE_TYPES = [
  "Annual Leave", "Sick Leave", "Casual Leave",
  "Maternity Leave", "Paternity Leave", "Unpaid Leave", "Other",
];

const STATUSES = [
  { value: "pending", label: "Pending", color: "text-amber-600", bg: "bg-amber-50   border-amber-100" },
  { value: "approved", label: "Approved", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  { value: "rejected", label: "Rejected", color: "text-red-500", bg: "bg-red-50     border-red-100" },
];

const statusMeta = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];
const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  return Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
};
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";


// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl
    shadow-2xl text-white text-sm font-semibold
    ${type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
  </div>
);


// ─── Shared field styles ──────────────────────────────────────────
const inputCls =
  `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
   placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400
   focus:border-teal-400 transition-all`;

const selectCls =
  `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
   focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400
   appearance-none transition-all`;


// ─── Leave Modal (Admin Create) ───────────────────────────────────
const LeaveModal = ({ employees, onClose, onSave }) => {
  const [form, setForm] = useState({
    employeeId: "",
    employeeName: "",
    leaveType: "Annual Leave",
    fromDate: "",
    toDate: "",
    reason: "",
    status: "pending",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleEmpChange = (uid) => {
    const emp = employees.find(e => e.uid === uid);
    setForm(f => ({ ...f, employeeId: uid, employeeName: emp?.name || "" }));
  };

  const days = daysBetween(form.fromDate, form.toDate);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.employeeId) { setError("Select an employee"); return; }
    if (!form.fromDate || !form.toDate) { setError("Select leave dates"); return; }
    if (new Date(form.toDate) < new Date(form.fromDate)) { setError("End date must be after start date"); return; }
    setLoading(true);
    try {
      await onSave({ ...form, days });
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl shadow-gray-200/80">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
              <CalendarDays size={16} className="text-teal-600" />
            </div>
            <h2 className="text-sm font-black text-gray-900">New Leave Request</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Employee */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              <User size={11} className="inline mr-1" />Employee *
            </label>
            <div className="relative">
              <select value={form.employeeId} onChange={e => handleEmpChange(e.target.value)}
                className={selectCls}>
                <option value="">— Select employee —</option>
                {employees.map(e => (
                  <option key={e.uid} value={e.uid}>{e.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Leave Type */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Leave Type
            </label>
            <div className="relative">
              <select value={form.leaveType} onChange={e => set("leaveType", e.target.value)}
                className={selectCls}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">From *</label>
              <input type="date" value={form.fromDate}
                onChange={e => set("fromDate", e.target.value)} required
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">To *</label>
              <input type="date" value={form.toDate}
                onChange={e => set("toDate", e.target.value)} required
                min={form.fromDate}
                className={inputCls} />
            </div>
          </div>

          {/* Day count */}
          {form.fromDate && form.toDate && (
            <div className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <CalendarDays size={14} className="text-teal-600" />
              <span className="text-sm font-bold text-teal-700">
                {days} day{days !== 1 ? "s" : ""} leave
              </span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              <FileText size={11} className="inline mr-1" />Reason
            </label>
            <textarea value={form.reason} onChange={e => set("reason", e.target.value)}
              placeholder="Reason for leave…" rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                         text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-teal-400 focus:border-teal-400 transition-all resize-none" />
          </div>

          {/* Initial Status */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Initial Status
            </label>
            <div className="relative">
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className={selectCls}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold
                         py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-teal-100">
              {loading ? "Saving…" : "Create Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─── Reject Reason Modal ──────────────────────────────────────────
const RejectModal = ({ request, onConfirm, onClose, loading }) => {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-gray-200/80">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
            <XCircle size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-900">Reject Request</h3>
            <p className="text-xs text-gray-400 font-medium">
              {request?.employeeName} · {request?.leaveType}
            </p>
          </div>
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection (optional)…" rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
                     placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400
                     focus:border-red-300 transition-all resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold
                       py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-red-100">
            {loading ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
};


// ─── Leave Request Card ───────────────────────────────────────────
const LeaveCard = ({ req, onApprove, onReject, onDelete }) => {
  const sm = statusMeta(req.status);

  const avatarBg = req.status === "approved"
    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
    : req.status === "rejected"
      ? "bg-red-50 border-red-100 text-red-500"
      : "bg-amber-50 border-amber-100 text-amber-700";

  return (
    <div className={`bg-white border rounded-2xl p-5 transition-all duration-200 shadow-sm
      ${req.status === "pending"
        ? "border-amber-100 hover:border-amber-200 hover:shadow-md hover:shadow-amber-50"
        : req.status === "approved"
          ? "border-emerald-100 hover:border-emerald-200"
          : "border-gray-100 hover:border-gray-200"
      }`}>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 text-sm font-black ${avatarBg}`}>
            {req.employeeName?.[0]?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{req.employeeName}</p>
            <p className="text-xs text-gray-400 font-medium">{req.leaveType}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${sm.bg} ${sm.color}`}>
          {sm.label}
        </span>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <CalendarDays size={13} className="text-gray-400 flex-shrink-0" />
        <span className="text-xs text-gray-500 font-medium">
          {fmtDate(req.fromDate)} → {fmtDate(req.toDate)}
        </span>
        <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">
          {req.days || daysBetween(req.fromDate, req.toDate)}d
        </span>
      </div>

      {/* Reason */}
      {req.reason && (
        <p className="text-xs text-gray-400 italic mb-3 line-clamp-2">"{req.reason}"</p>
      )}

      {/* Reject reason */}
      {req.status === "rejected" && req.rejectReason && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-red-500 font-medium">Rejected: {req.rejectReason}</p>
        </div>
      )}

      {/* Applied date */}
      <p className="text-xs text-gray-300 font-medium mb-3">
        Applied:{" "}
        {req.createdAt?.toDate
          ? req.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "—"}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
        {req.status === "pending" && (
          <>
            <button onClick={() => onApprove(req)}
              className="flex items-center gap-1.5 flex-1 justify-center bg-emerald-50 hover:bg-emerald-100
                         border border-emerald-100 text-emerald-700 font-bold py-2 rounded-xl text-xs transition-all">
              <Check size={13} /> Approve
            </button>
            <button onClick={() => onReject(req)}
              className="flex items-center gap-1.5 flex-1 justify-center bg-red-50 hover:bg-red-100
                         border border-red-100 text-red-500 font-bold py-2 rounded-xl text-xs transition-all">
              <XCircle size={13} /> Reject
            </button>
          </>
        )}
        {req.status === "approved" && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <CheckCircle2 size={13} /> Approved
          </span>
        )}
        <button onClick={() => onDelete(req)}
          className="w-8 h-8 ml-auto rounded-xl bg-gray-50 border border-gray-100
                     hover:bg-red-50 hover:border-red-100 flex items-center justify-center
                     text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
          aria-label="Delete request">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
};


// ─── Delete Confirm ───────────────────────────────────────────────
const DeleteModal = ({ req, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-gray-200/80 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={20} className="text-red-500" />
      </div>
      <h3 className="text-base font-black text-gray-900 mb-1">Delete Leave Request</h3>
      <p className="text-sm text-gray-500 font-medium mb-6">
        Remove <span className="text-gray-900 font-bold">{req?.employeeName}'s</span>{" "}
        {req?.leaveType} request? This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold
                     py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-red-100">
          {loading ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);


// ─── Leave Requests Page (Admin) ──────────────────────────────────
export default function LeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Real-time listener for leave requests + one-time employees fetch ──
  useEffect(() => {
    // Fetch employees once (static list)
    getDocs(collection(db, "employees"))
      .then(snap => setEmployees(snap.docs.map(d => ({ uid: d.id, ...d.data() }))))
      .catch(() => showToast("Failed to load employees", "error"));

    // Live listener for all leave requests
    setLoading(true);
    const q = query(collection(db, "leaveRequests"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => {
        showToast("Failed to load requests", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreate = async (form) => {
    const ref = await addDoc(collection(db, "leaveRequests"), {
      ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    // onSnapshot will auto-update the list
    showToast("Leave request created");
  };

  const handleApprove = async (req) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "leaveRequests", req.id), {
        status: "approved", updatedAt: serverTimestamp(),
      });
      // onSnapshot updates list automatically
      showToast(`${req.employeeName}'s leave approved ✓`);
    } catch {
      showToast("Failed to approve", "error");
    }
    setActionLoading(false);
  };

  const handleReject = async (reason) => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "leaveRequests", rejectTarget.id), {
        status: "rejected", rejectReason: reason || "", updatedAt: serverTimestamp(),
      });
      // onSnapshot updates list automatically
      showToast(`${rejectTarget.employeeName}'s leave rejected`);
    } catch {
      showToast("Failed to reject", "error");
    }
    setActionLoading(false);
    setRejectTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "leaveRequests", deleteTarget.id));
      // onSnapshot updates list automatically
      showToast("Request deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
    setActionLoading(false);
    setDeleteTarget(null);
  };

  const filtered = requests.filter(r => {
    const matchSearch = r.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      r.leaveType?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchType = filterType === "all" || r.leaveType === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const counts = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  const statCards = [
    { label: "Total", val: counts.total, icon: CalendarDays, bg: "bg-gray-50", border: "border-gray-200", iconColor: "text-gray-400", valColor: "text-gray-900" },
    { label: "Pending", val: counts.pending, icon: Clock, bg: "bg-amber-50", border: "border-amber-100", iconColor: "text-amber-600", valColor: "text-amber-600" },
    { label: "Approved", val: counts.approved, icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-100", iconColor: "text-emerald-600", valColor: "text-emerald-700" },
    { label: "Rejected", val: counts.rejected, icon: XCircle, bg: "bg-red-50", border: "border-red-100", iconColor: "text-red-500", valColor: "text-red-600" },
  ];

  return (
    <Layout title="Leave Requests">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.valColor}`}>{s.val}</p>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pending alert ── */}
      {counts.pending > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3.5 mb-5 flex items-center gap-3 shadow-sm">
          <Clock size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-semibold">
            {counts.pending} request{counts.pending > 1 ? "s are" : " is"} awaiting your approval
          </p>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">

        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by employee…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm
                       text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2
                       focus:ring-teal-400 focus:border-teal-400 transition-all shadow-sm" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl pl-8 pr-8 py-2.5 text-xs text-gray-700
                       font-bold focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none
                       transition-all shadow-sm">
            <option value="all">All Status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Type filter */}
        <div className="relative">
          <CalendarDays size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl pl-8 pr-8 py-2.5 text-xs text-gray-700
                       font-bold focus:outline-none focus:ring-2 focus:ring-teal-400 appearance-none
                       transition-all shadow-sm">
            <option value="all">All Types</option>
            {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* New Request */}
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold
                     px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-teal-100 ml-auto">
          <Plus size={15} /> New Request
        </button>
      </div>

      {/* ── Leave Cards Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-gray-50 border border-gray-100 rounded-2xl animate-pulse shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-100 rounded-2xl shadow-sm">
          <CalendarDays size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-bold text-gray-500">No leave requests found</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {requests.length === 0 ? "No requests have been submitted yet" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(req => (
            <LeaveCard
              key={req.id}
              req={req}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && (
        <LeaveModal
          employees={employees}
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
          loading={actionLoading}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          req={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={actionLoading}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}