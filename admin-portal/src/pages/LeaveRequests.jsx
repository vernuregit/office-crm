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
  User, FileText, Trash2, Check, Sparkles
} from "lucide-react";


// ─── Constants ────────────────────────────────────────────────────
const LEAVE_TYPES = [
  "Annual Leave", "Sick Leave", "Casual Leave",
  "Maternity Leave", "Paternity Leave", "Unpaid Leave", "Other",
];


const STATUSES = [
  {
    value: "pending",
    label: "Pending",
    color: "text-amber-700",
    bg: "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200",
    dot: "bg-amber-400",
    ring: "ring-amber-200",
  },
  {
    value: "approved",
    label: "Approved",
    color: "text-emerald-700",
    bg: "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200",
    dot: "bg-emerald-400",
    ring: "ring-emerald-200",
  },
  {
    value: "rejected",
    label: "Rejected",
    color: "text-red-700",
    bg: "bg-gradient-to-r from-red-50 to-rose-50 border-red-200",
    dot: "bg-red-400",
    ring: "ring-red-200",
  },
];


const statusMeta = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0];


const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  return Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
};


const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";


const avatarColors = [
  "from-violet-500 to-purple-600",
  "from-teal-500 to-emerald-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-violet-600",
];


const getAvatarColor = (name = "") => {
  const i = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[i] || avatarColors[0];
};


// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div
    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl
    shadow-2xl text-white text-sm font-semibold backdrop-blur-sm
    ${type === "success"
      ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-200"
      : "bg-gradient-to-r from-red-500 to-rose-500 shadow-red-200"
    }`}
  >
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button
      onClick={onClose}
      className="ml-2 opacity-70 hover:opacity-100 hover:bg-white/20 rounded-lg p-0.5 transition-all"
    >
      <X size={14} />
    </button>
  </div>
);


// ─── Shared field styles ──────────────────────────────────────────
const inputCls = `w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
  placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400/30
  focus:border-teal-400 transition-all shadow-sm hover:border-gray-300`;


const selectCls = `w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
  focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400
  appearance-none transition-all shadow-sm hover:border-gray-300`;


// ─── Leave Modal ──────────────────────────────────────────────────
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


  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));


  const handleEmpChange = (uid) => {
    const emp = employees.find((e) => e.uid === uid);
    setForm((f) => ({ ...f, employeeId: uid, employeeName: emp?.name || "" }));
  };


  const days = daysBetween(form.fromDate, form.toDate);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.employeeId) { setError("Select an employee"); return; }
    if (!form.fromDate || !form.toDate) { setError("Select leave dates"); return; }
    if (new Date(form.toDate) < new Date(form.fromDate)) {
      setError("End date must be after start date");
      return;
    }
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl w-full max-w-md shadow-2xl shadow-gray-900/10 overflow-hidden">


        <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400" />


        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-200">
              <CalendarDays size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black text-gray-900">New Leave Request</h2>
              <p className="text-xs text-gray-400 font-medium">Fill in the details below</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>


        <form onSubmit={handleSubmit} className="p-6 space-y-4">


          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <User size={11} /> Employee *
            </label>
            <div className="relative">
              <select
                value={form.employeeId}
                onChange={(e) => handleEmpChange(e.target.value)}
                className={selectCls}
              >
                <option value="">— Select employee —</option>
                {employees.map((e) => (
                  <option key={e.uid} value={e.uid}>{e.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>


          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Leave Type
            </label>
            <div className="relative">
              <select
                value={form.leaveType}
                onChange={(e) => set("leaveType", e.target.value)}
                className={selectCls}
              >
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>


          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">From *</label>
              <input type="date" value={form.fromDate}
                onChange={(e) => set("fromDate", e.target.value)} required
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">To *</label>
              <input type="date" value={form.toDate}
                onChange={(e) => set("toDate", e.target.value)} required
                min={form.fromDate}
                className={inputCls} />
            </div>
          </div>


          {form.fromDate && form.toDate && (
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl px-4 py-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Sparkles size={12} className="text-white" />
              </div>
              <span className="text-sm font-bold text-teal-800">
                {days} day{days !== 1 ? "s" : ""} of leave selected
              </span>
            </div>
          )}


          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              <FileText size={11} /> Reason
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="Reason for leave…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>


          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Initial Status
            </label>
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className={selectCls}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>


          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}


          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-teal-200"
            >
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 flex items-center justify-center p-4">
      <div className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shadow-gray-900/10">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-400 via-rose-400 to-pink-400" />
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 flex-shrink-0">
              <XCircle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">Reject Request</h3>
              <p className="text-xs text-gray-400 font-medium">
                {request?.employeeName} · {request?.leaveType}
              </p>
            </div>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rejection (optional)…"
            rows={3}
            className={`${inputCls} resize-none mb-4`}
          />
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-red-200"
            >
              {loading ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Leave Request Card ───────────────────────────────────────────
const LeaveCard = ({ req, onApprove, onReject, onDelete }) => {
  const sm = statusMeta(req.status);
  const initials = req.employeeName?.[0]?.toUpperCase() || "?";
  const gradColor = getAvatarColor(req.employeeName);

  return (
    <div
      className={`group relative bg-white border rounded-3xl overflow-hidden transition-all duration-300
      hover:-translate-y-1 hover:shadow-xl
      ${req.status === "pending"
        ? "border-amber-200 hover:shadow-amber-100"
        : req.status === "approved"
          ? "border-emerald-200 hover:shadow-emerald-100"
          : "border-gray-200 hover:shadow-gray-100"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${gradColor} flex items-center justify-center flex-shrink-0 text-white text-sm font-black shadow-lg`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-gray-900 truncate">{req.employeeName}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{req.leaveType}</p>
            </div>
          </div>

          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${sm.bg} ${sm.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} flex-shrink-0`} />
            {sm.label}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-gray-400 font-medium mb-0.5">From</p>
              <p className="text-xs font-bold text-gray-700">{fmtDate(req.fromDate)}</p>
            </div>
            <div className="flex-1 flex items-center justify-center gap-1.5 px-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-black text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                {req.days || daysBetween(req.fromDate, req.toDate)}d
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 font-medium mb-0.5">To</p>
              <p className="text-xs font-bold text-gray-700">{fmtDate(req.toDate)}</p>
            </div>
          </div>
        </div>

        {req.reason && (
          <p className="text-xs text-gray-500 italic mb-3 line-clamp-2 leading-relaxed">
            "{req.reason}"
          </p>
        )}

        {req.status === "rejected" && req.rejectReason && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-2xl px-3.5 py-2.5 mb-3">
            <p className="text-xs text-red-700 font-semibold">
              <span className="font-black">Rejected:</span> {req.rejectReason}
            </p>
          </div>
        )}

        <p className="text-xs text-gray-300 font-medium mb-4">
          Applied:{" "}
          {req.createdAt?.toDate
            ? req.createdAt.toDate().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—"}
        </p>

        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          {req.status === "pending" && (
            <>
              <button
                onClick={() => onApprove(req)}
                className="flex items-center gap-1.5 flex-1 justify-center bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border border-emerald-200 text-emerald-700 font-bold py-2.5 rounded-2xl text-xs transition-all"
              >
                <Check size={13} /> Approve
              </button>
              <button
                onClick={() => onReject(req)}
                className="flex items-center gap-1.5 flex-1 justify-center bg-gradient-to-r from-red-50 to-rose-50 hover:from-red-100 hover:to-rose-100 border border-red-200 text-red-700 font-bold py-2.5 rounded-2xl text-xs transition-all"
              >
                <XCircle size={13} /> Reject
              </button>
            </>
          )}
          {req.status === "approved" && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <CheckCircle2 size={13} /> Approved
            </span>
          )}
          <button
            onClick={() => onDelete(req)}
            className="w-9 h-9 ml-auto rounded-2xl bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-200 flex items-center justify-center text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
            aria-label="Delete request"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm ───────────────────────────────────────────────
const DeleteModal = ({ req, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 flex items-center justify-center p-4">
    <div className="bg-white/95 backdrop-blur-xl border border-gray-200/80 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl shadow-gray-900/10">
      <div className="h-1.5 w-full bg-gradient-to-r from-red-400 via-rose-400 to-pink-400" />
      <div className="p-6 text-center">
        <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200">
          <Trash2 size={22} className="text-white" />
        </div>
        <h3 className="text-base font-black text-gray-900 mb-1.5">Delete Leave Request</h3>
        <p className="text-sm text-gray-500 font-medium mb-6 leading-relaxed">
          Remove <span className="text-gray-900 font-black">{req?.employeeName}'s</span>{" "}
          <span className="text-gray-700">{req?.leaveType}</span> request?{" "}
          <span className="text-red-500 font-semibold">This cannot be undone.</span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-red-200"
          >
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  </div>
);


// ─── Leave Requests Page ──────────────────────────────────────────
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


  useEffect(() => {
    getDocs(collection(db, "employees"))
      .then((snap) => setEmployees(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))))
      .catch(() => showToast("Failed to load employees", "error"));


    setLoading(true);
    const q = query(collection(db, "leaveRequests"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    await addDoc(collection(db, "leaveRequests"), {
      ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    showToast("Leave request created");
  };


  const handleApprove = async (req) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "leaveRequests", req.id), {
        status: "approved", updatedAt: serverTimestamp(),
      });
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
      showToast("Request deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
    setActionLoading(false);
    setDeleteTarget(null);
  };


  const filtered = requests.filter((r) => {
    const matchSearch =
      r.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      r.leaveType?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchType = filterType === "all" || r.leaveType === filterType;
    return matchSearch && matchStatus && matchType;
  });


  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };


  const statCards = [
    {
      label: "Total Requests",
      val: counts.total,
      icon: CalendarDays,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-500",
      valColor: "text-gray-900",
      labelColor: "text-gray-500",
      cardBorder: "border-gray-100",
    },
    {
      label: "Pending",
      val: counts.pending,
      icon: Clock,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      valColor: "text-amber-700",
      labelColor: "text-amber-500",
      cardBorder: "border-amber-100",
    },
    {
      label: "Approved",
      val: counts.approved,
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      valColor: "text-emerald-700",
      labelColor: "text-emerald-500",
      cardBorder: "border-emerald-100",
    },
    {
      label: "Rejected",
      val: counts.rejected,
      icon: XCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      valColor: "text-red-700",
      labelColor: "text-red-400",
      cardBorder: "border-red-100",
    },
  ];


  return (
    <Layout title="Leave Requests">


      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`bg-white border rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-200 ${s.cardBorder}`}
          >
            <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.valColor} leading-none mb-1 tabular-nums`}>{s.val}</p>
              <p className={`text-xs font-semibold ${s.labelColor}`}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>


      {/* ── Pending Alert ── */}
      {counts.pending > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6 flex items-center gap-3 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-200">
            <Clock size={14} className="text-white" />
          </div>
          <p className="text-sm text-amber-800 font-semibold">
            <span className="font-black">{counts.pending}</span> request{counts.pending > 1 ? "s are" : " is"} awaiting your approval
          </p>
        </div>
      )}


      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">


        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by employee or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm
              text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2
              focus:ring-teal-400/30 focus:border-teal-400 transition-all shadow-sm hover:border-gray-300"
          />
        </div>


        <div className="relative">
          <Filter size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-2xl pl-9 pr-8 py-2.5 text-xs text-gray-700
              font-bold focus:outline-none focus:ring-2 focus:ring-teal-400/30 appearance-none
              transition-all shadow-sm hover:border-gray-300"
          >
            <option value="all">All Status</option>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>


        <div className="relative">
          <CalendarDays size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white border border-gray-200 rounded-2xl pl-9 pr-8 py-2.5 text-xs text-gray-700
              font-bold focus:outline-none focus:ring-2 focus:ring-teal-400/30 appearance-none
              transition-all shadow-sm hover:border-gray-300"
          >
            <option value="all">All Types</option>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>


        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 cursor-pointer bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold px-5 py-2.5 rounded-2xl text-sm transition-all shadow-lg shadow-teal-200 ml-auto hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus size={15} /> New Request
        </button>
      </div>


      {/* ── Cards Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-52 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white border border-gray-100 rounded-3xl shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-black text-gray-600">No leave requests found</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {requests.length === 0 ? "No requests have been submitted yet" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((req) => (
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