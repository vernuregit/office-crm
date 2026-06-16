import { useEffect, useState } from "react";
import {
  collection, query, getDocs,
  doc, updateDoc, addDoc, arrayUnion,
  orderBy, serverTimestamp, where
} from "firebase/firestore";
import { db }       from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout       from "../components/Layout";
import StatusBadge  from "../components/StatusBadge";
import {
  TicketCheck, ChevronRight, X, Send,
  Loader2, MessageSquare, Tag, Search,
  User, Clock, CheckCircle2, AlertCircle,
  Circle, Plus
} from "lucide-react";


// ─── Status config ────────────────────────────────────────────────
const STATUSES = [
  { value: "open",        label: "Open",        color: "text-blue-600",    bg: "bg-blue-50    border-blue-200"    },
  { value: "in-progress", label: "In Progress", color: "text-amber-600",   bg: "bg-amber-50   border-amber-200"   },
  { value: "resolved",    label: "Resolved",    color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  { value: "closed",      label: "Closed",      color: "text-gray-500",    bg: "bg-gray-100   border-gray-200"    },
];

const CATEGORIES = [
  "IT Support", "HR", "Payroll", "Leave", "Facilities", "Admin", "Other",
];

const statusMeta = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];


// ─── New Ticket Modal ─────────────────────────────────────────────
const NewTicketModal = ({ onClose, onSubmit }) => {
  const [form, setForm] = useState({ subject: "", category: "IT Support", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.description.trim()) return;
    setSubmitting(true);
    await onSubmit(form);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-black text-gray-900">Raise a Ticket</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Subject */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              Subject <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="Brief summary of the issue"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                         focus:border-[#1D7872] transition-all bg-white"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              Category <span className="text-red-400">*</span>
            </label>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                         focus:border-[#1D7872] transition-all bg-white"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Describe your issue in detail…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                         focus:border-[#1D7872] transition-all bg-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold
                         text-gray-600 hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!form.subject.trim() || !form.description.trim() || submitting}
              className="flex-1 py-2.5 rounded-xl bg-[#1D7872] text-white text-sm font-bold
                         hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-md">
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
                : <><Send size={14} /> Submit Ticket</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Ticket Detail Modal ──────────────────────────────────────────
const TicketDetail = ({ ticket, onClose, onReply, onStatusChange, isAdmin }) => {
  const [reply,        setReply]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [updating,     setUpdating]     = useState(false);
  const [localTicket,  setLocalTicket]  = useState(ticket);
  const { userData }   = useAuthStore();

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    const newReply = await onReply(localTicket.id, reply, userData?.name);
    if (newReply) {
      setLocalTicket(prev => ({ ...prev, replies: [...(prev.replies || []), newReply] }));
    }
    setReply("");
    setSubmitting(false);
  };

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    await onStatusChange(localTicket.id, newStatus);
    setLocalTicket(prev => ({ ...prev, status: newStatus }));
    setUpdating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl flex items-start justify-between z-10">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs text-[#1D7872] border border-blue-100 bg-blue-50 px-2.5 py-0.5 rounded-full font-semibold">
                <Tag size={10} className="inline mr-1" />{localTicket.category}
              </span>
              <StatusBadge status={localTicket.status} />
            </div>
            <h2 className="text-lg font-black text-gray-900 leading-tight">{localTicket.subject}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                <User size={11} /> {localTicket.employeeName || "Employee"}
              </span>
              <span className="text-gray-200">•</span>
              <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                <Clock size={11} />
                {localTicket.createdAt
                  ? new Date(localTicket.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                      day: "numeric", month: "long", year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Status Update — admin only */}
          {isAdmin && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Update Status</p>
              <div className="flex gap-2 flex-wrap">
                {STATUSES.map(s => (
                  <button key={s.value} onClick={() => handleStatusChange(s.value)}
                    disabled={localTicket.status === s.value || updating}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border
                      ${localTicket.status === s.value
                        ? `${s.bg} ${s.color} border-current shadow-sm`
                        : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                      } disabled:opacity-50`}>
                    {updating && localTicket.status !== s.value
                      ? <Loader2 size={11} className="animate-spin inline mr-1" />
                      : null}
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Original Message */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Issue Description
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{localTicket.description}</p>
          </div>

          {/* Conversation */}
          {localTicket.replies?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Conversation ({localTicket.replies.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {localTicket.replies.map((r, i) => (
                  <div key={i}
                    className={`rounded-xl p-4 ${
                      r.role === "employee"
                        ? "bg-indigo-50 border border-indigo-100 mr-6"
                        : "bg-blue-50 border border-blue-100 ml-6"
                    }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-gray-700">
                        {r.role === "employee"
                          ? `Employee — ${r.name || "Employee"}`
                          : `Admin — ${r.name || "Admin"}`}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">
                        {r.createdAt
                          ? new Date(
                              r.createdAt.seconds
                                ? r.createdAt.seconds * 1000
                                : r.createdAt
                            ).toLocaleString("en-IN", {
                              day: "numeric", month: "short",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : "Just now"}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{r.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reply Box */}
          {localTicket.status !== "closed" && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                {isAdmin ? "Reply as Admin" : "Add a Comment"}
              </p>
              <div className="flex gap-2">
                <textarea
                  rows={3}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder={isAdmin ? "Type your response…" : "Add a follow-up comment…"}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                             focus:border-[#1D7872] transition-all bg-white resize-none"
                />
                <button onClick={handleReply} disabled={!reply.trim() || submitting}
                  className="w-10 h-10 mt-auto rounded-xl bg-[#1D7872] text-white flex items-center
                             justify-center hover:opacity-90 transition-all disabled:opacity-40 shadow-md flex-shrink-0">
                  {submitting
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── Tickets Page ─────────────────────────────────────────────────
const EmployeeTickets = () => {
  const { user, userData, adminData } = useAuthStore();
  const isAdmin = !!adminData;

  const [tickets,        setTickets]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filter,         setFilter]         = useState("all");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showNewModal,   setShowNewModal]   = useState(false);
  const [toast,          setToast]          = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch tickets ──────────────────────────────────────────────
  // Admin sees all; employee sees only their own
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const q = isAdmin
        ? query(collection(db, "tickets"), orderBy("createdAt", "desc"))
        : query(
            collection(db, "tickets"),
            where("employeeId", "==", user.uid),
            orderBy("createdAt", "desc")
          );
      const snap = await getDocs(q);
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load tickets:", err);
      showToast("Failed to load tickets", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user?.uid) fetchTickets();
  }, [user?.uid]);

  // ── Create new ticket ──────────────────────────────────────────
  const handleCreateTicket = async (form) => {
    try {
      const docRef = await addDoc(collection(db, "tickets"), {
        subject:      form.subject.trim(),
        category:     form.category,
        description:  form.description.trim(),
        status:       "open",
        employeeId:   user.uid,
        employeeName: userData?.name || "Employee",
        replies:      [],
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
      const newTicket = {
        id:           docRef.id,
        subject:      form.subject.trim(),
        category:     form.category,
        description:  form.description.trim(),
        status:       "open",
        employeeId:   user.uid,
        employeeName: userData?.name || "Employee",
        replies:      [],
        createdAt:    { seconds: Math.floor(Date.now() / 1000) },
      };
      setTickets(prev => [newTicket, ...prev]);
      setShowNewModal(false);
      showToast("Ticket raised successfully");
    } catch (err) {
      console.error(err);
      showToast("Failed to create ticket", "error");
    }
  };

  // ── Reply ──────────────────────────────────────────────────────
  const handleReply = async (ticketId, message, name) => {
    const role = isAdmin ? "admin" : "employee";
    const newReply = {
      role,
      name:      name || (isAdmin ? adminData?.name : userData?.name) || role,
      message,
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
    };
    try {
      await updateDoc(doc(db, "tickets", ticketId), {
        replies:   arrayUnion(newReply),
        updatedAt: serverTimestamp(),
      });
      setTickets(prev =>
        prev.map(t =>
          t.id === ticketId
            ? { ...t, replies: [...(t.replies || []), newReply] }
            : t
        )
      );
      showToast("Reply sent");
      return newReply;
    } catch (err) {
      console.error(err);
      showToast("Failed to send reply", "error");
      return null;
    }
  };

  // ── Status change (admin only) ─────────────────────────────────
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, "tickets", ticketId), {
        status:    newStatus,
        updatedAt: serverTimestamp(),
      });
      setTickets(prev =>
        prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t)
      );
      showToast(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      showToast("Failed to update status", "error");
    }
  };

  // ── Filter + Search ────────────────────────────────────────────
  const filtered = tickets.filter(t => {
    const matchFilter = filter === "all" || t.status === filter;
    const matchSearch =
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const counts = {
    total:      tickets.length,
    open:       tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved:   tickets.filter(t => t.status === "resolved").length,
  };

  return (
    <Layout title="Support Tickets">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 px-5 mt-5">
        {[
          { label: "Total",       val: counts.total,      Icon: TicketCheck,  color: "text-indigo-600", bg: "bg-indigo-50"  },
          { label: "Open",        val: counts.open,       Icon: Circle,       color: "text-blue-600",   bg: "bg-blue-50"    },
          { label: "In Progress", val: counts.inProgress, Icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50"   },
          { label: "Resolved",    val: counts.resolved,   Icon: CheckCircle2, color: "text-emerald-600",bg: "bg-emerald-50" },
        ].map(s => (
          <div key={s.label}
            className="bg-white rounded-2xl p-4 border border-gray-100
                       shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={18} className={s.color} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter + New Ticket */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5 px-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by subject, employee or category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                       focus:border-[#1D7872] transition-all bg-white shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {["all", "open", "in-progress", "resolved", "closed"].map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer
                ${filter === tab
                  ? "bg-[#1D7872] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-[#1D7872]"
                }`}>
              {tab}
            </button>
          ))}
          {/* Employees (and admins) can raise tickets */}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D7872] text-white
                       text-sm font-bold hover:opacity-90 transition-all shadow-md cursor-pointer ml-1">
            <Plus size={15} /> New Ticket
          </button>
        </div>
      </div>

      {/* Ticket List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TicketCheck size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-bold text-gray-500">No tickets found</p>
            <p className="text-xs text-gray-400 font-medium mt-1">
              {tickets.length === 0
                ? "No tickets raised yet — click New Ticket to get started"
                : "Try adjusting your search or filter"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(ticket => {
              const isUrgent = ticket.status === "open";
              // Unread = last reply is from employee (for admin view) or admin (for employee view)
              const lastReply = ticket.replies?.[ticket.replies.length - 1];
              const hasUnread = lastReply && (
                isAdmin
                  ? lastReply.role === "employee"
                  : lastReply.role === "admin"
              );
              return (
                <div key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50
                             cursor-pointer transition-colors group">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${isUrgent ? "bg-blue-50" : "bg-gray-50"}`}>
                      <TicketCheck size={18} className={isUrgent ? "text-blue-400" : "text-gray-300"} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate group-hover:text-[#1D7872] transition-colors">
                        {ticket.subject}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500 font-semibold">
                          <User size={10} /> {ticket.employeeName || "Employee"}
                        </span>
                        <span className="text-gray-200">•</span>
                        <span className="text-xs text-gray-400 font-medium">{ticket.category}</span>
                        <span className="text-gray-200">•</span>
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <MessageSquare size={10} /> {ticket.replies?.length || 0} replies
                        </span>
                        <span className="text-gray-200">•</span>
                        <span className="text-xs text-gray-400 font-medium">
                          {ticket.createdAt
                            ? new Date(ticket.createdAt.seconds * 1000)
                                .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    {hasUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title="New reply" />
                    )}
                    <StatusBadge status={ticket.status} />
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-[#1D7872] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewModal && (
        <NewTicketModal
          onClose={() => setShowNewModal(false)}
          onSubmit={handleCreateTicket}
        />
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onReply={handleReply}
          onStatusChange={handleStatusChange}
          isAdmin={isAdmin}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5
          rounded-2xl shadow-2xl text-white text-sm font-semibold
          ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </Layout>
  );
};

export default EmployeeTickets;