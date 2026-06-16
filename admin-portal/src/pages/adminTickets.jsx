import { useEffect, useState } from "react";
import {
  collection, query, getDocs,
  doc, updateDoc, arrayUnion,
  orderBy, serverTimestamp,
} from "firebase/firestore";
import { db }       from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout       from "../components/Layout";
import StatusBadge  from "../components/StatusBadge";
import {
  TicketCheck, ChevronRight, X, Send,
  Loader2, MessageSquare, Tag, Search,
  User, Clock, CheckCircle2, AlertCircle,
  Circle, RefreshCw, Filter,
} from "lucide-react";


// ─── Status config ────────────────────────────────────────────────
const STATUSES = [
  { value: "open",        label: "Open",        color: "text-blue-600",    bg: "bg-blue-50    border-blue-200"    },
  { value: "in-progress", label: "In Progress", color: "text-amber-600",   bg: "bg-amber-50   border-amber-200"   },
  { value: "resolved",    label: "Resolved",    color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  { value: "closed",      label: "Closed",      color: "text-gray-500",    bg: "bg-gray-100   border-gray-200"    },
];

const CATEGORIES = [
  "All", "IT Support", "HR", "Payroll", "Leave", "Facilities", "Admin", "Other",
];

const statusMeta = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];


// ─── Ticket Detail Modal ──────────────────────────────────────────
const TicketDetail = ({ ticket, onClose, onReply, onStatusChange }) => {
  const [reply,       setReply]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [updating,    setUpdating]    = useState(false);
  const [localTicket, setLocalTicket] = useState(ticket);
  const { adminData } = useAuthStore();

  // Sync if parent ticket changes (e.g. after status update from list)
  useEffect(() => setLocalTicket(ticket), [ticket]);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    const newReply = await onReply(localTicket.id, reply, adminData?.name);
    if (newReply) {
      setLocalTicket(prev => ({
        ...prev,
        replies: [...(prev.replies || []), newReply],
      }));
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

  const sm = statusMeta(localTicket.status);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-4 rounded-t-3xl flex items-start justify-between flex-shrink-0">
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Status Update */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map(s => (
                <button key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={localTicket.status === s.value || updating}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all border
                    ${localTicket.status === s.value
                      ? `${s.bg} ${s.color} border-current shadow-sm`
                      : "bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600"
                    } disabled:opacity-50 cursor-pointer`}>
                  {updating && localTicket.status !== s.value
                    ? <Loader2 size={11} className="animate-spin inline mr-1" />
                    : null}
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Issue Description */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Issue Description
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{localTicket.description}</p>
          </div>

          {/* Conversation thread */}
          {localTicket.replies?.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Conversation ({localTicket.replies.length})
              </p>
              <div className="space-y-2">
                {localTicket.replies.map((r, i) => (
                  <div key={i}
                    className={`rounded-xl p-4 ${
                      r.role === "employee"
                        ? "bg-indigo-50 border border-indigo-100 mr-8"
                        : "bg-blue-50 border border-blue-100 ml-8"
                    }`}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <p className="text-xs font-bold text-gray-700">
                        {r.role === "employee"
                          ? `Employee — ${r.name || "Employee"}`
                          : `Admin — ${r.name || "Admin"}`}
                      </p>
                      <p className="text-xs text-gray-400 font-medium flex-shrink-0">
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

          {/* Reply box */}
          {localTicket.status !== "closed" ? (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Reply as Admin
              </p>
              <div className="flex gap-2">
                <textarea
                  rows={3}
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type your response to the employee…"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                             focus:border-[#1D7872] transition-all bg-white resize-none"
                />
                <button onClick={handleReply} disabled={!reply.trim() || submitting}
                  className="w-10 h-10 mt-auto rounded-xl bg-[#1D7872] text-white flex items-center
                             justify-center hover:opacity-90 transition-all disabled:opacity-40 shadow-md flex-shrink-0 cursor-pointer">
                  {submitting
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Send size={14} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 font-medium text-center py-2">
                This ticket is closed. Reopen it to reply.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── Admin Tickets Page ───────────────────────────────────────────
const AdminTickets = () => {
  const { adminData }             = useAuthStore();
  const [tickets,        setTickets]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [toast,          setToast]          = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch all tickets ──────────────────────────────────────────
  const fetchTickets = async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "tickets"), orderBy("createdAt", "desc"))
      );
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load tickets:", err);
      showToast("Failed to load tickets", "error");
    }
    silent ? setRefreshing(false) : setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  // ── Reply as admin ─────────────────────────────────────────────
  const handleReply = async (ticketId, message, name) => {
    const newReply = {
      role:      "admin",
      name:      name || adminData?.name || "Admin",
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
      showToast("Reply sent successfully");
      return newReply;
    } catch (err) {
      console.error(err);
      showToast("Failed to send reply", "error");
      return null;
    }
  };

  // ── Update status ──────────────────────────────────────────────
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, "tickets", ticketId), {
        status:    newStatus,
        updatedAt: serverTimestamp(),
      });
      setTickets(prev =>
        prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t)
      );
      // Keep modal in sync
      setSelectedTicket(prev =>
        prev?.id === ticketId ? { ...prev, status: newStatus } : prev
      );
      showToast(`Status updated to "${newStatus}"`);
    } catch (err) {
      console.error(err);
      showToast("Failed to update status", "error");
    }
  };

  // ── Filter + Search ────────────────────────────────────────────
  const filtered = tickets.filter(t => {
    const matchStatus   = statusFilter === "all" || t.status === statusFilter;
    const matchCategory = categoryFilter === "All" || t.category === categoryFilter;
    const matchSearch   =
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCategory && matchSearch;
  });

  const counts = {
    total:      tickets.length,
    open:       tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved:   tickets.filter(t => t.status === "resolved").length,
    closed:     tickets.filter(t => t.status === "closed").length,
  };

  // Unread = last reply is from employee
  const unreadCount = tickets.filter(t => {
    const last = t.replies?.[t.replies.length - 1];
    return last?.role === "employee";
  }).length;

  return (
    <Layout title="Tickets">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-gray-900">Support Tickets</h1>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Manage and respond to employee ticket requests
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600
                             bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {unreadCount} awaiting reply
            </span>
          )}
          <button
            onClick={() => fetchTickets(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200
                       text-sm font-semibold text-gray-600 hover:border-[#1D7872] hover:text-[#1D7872]
                       transition-all shadow-sm disabled:opacity-50 cursor-pointer">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total",       val: counts.total,      Icon: TicketCheck,  color: "text-indigo-600", bg: "bg-indigo-50"  },
          { label: "Open",        val: counts.open,       Icon: Circle,       color: "text-blue-600",   bg: "bg-blue-50"    },
          { label: "In Progress", val: counts.inProgress, Icon: Clock,        color: "text-amber-600",  bg: "bg-amber-50"   },
          { label: "Resolved",    val: counts.resolved,   Icon: CheckCircle2, color: "text-emerald-600",bg: "bg-emerald-50" },
          { label: "Closed",      val: counts.closed,     Icon: X,            color: "text-gray-500",   bg: "bg-gray-100"   },
        ].map(s => (
          <button key={s.label}
            onClick={() => setStatusFilter(s.label === "Total" ? "all" : s.label.toLowerCase().replace(" ", "-"))}
            className={`bg-white rounded-2xl p-4 border transition-all shadow-sm flex items-center gap-3 text-left cursor-pointer
              ${statusFilter === (s.label === "Total" ? "all" : s.label.toLowerCase().replace(" ", "-"))
                ? "border-[#1D7872] shadow-md"
                : "border-gray-100 hover:border-gray-200"
              }`}>
            <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={18} className={s.color} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.color} tabular-nums`}>{s.val}</p>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Search + Filters ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">

        {/* Search */}
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

        {/* Category filter */}
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-sm font-semibold
                       text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7872]
                       focus:border-[#1D7872] transition-all shadow-sm appearance-none cursor-pointer">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* ── Status Tab Pills ──────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap mb-5">
        {["all", "open", "in-progress", "resolved", "closed"].map(tab => (
          <button key={tab} onClick={() => setStatusFilter(tab)}
            className={`px-4 py-1.5 rounded-xl text-sm font-semibold capitalize transition-all cursor-pointer
              ${statusFilter === tab
                ? "bg-[#1D7872] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:text-[#1D7872] hover:border-blue-200"
              }`}>
            {tab === "all" ? `All (${counts.total})` : tab}
          </button>
        ))}
      </div>

      {/* ── Ticket List ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">

        {/* Table Header */}
        <div className="hidden sm:grid grid-cols-[1fr_140px_120px_80px_40px] gap-4 px-5 py-3
                        border-b border-gray-100 bg-gray-50/70">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Employee</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category</p>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</p>
          <p></p>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <TicketCheck size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-bold text-gray-500">No tickets found</p>
            <p className="text-xs text-gray-400 font-medium mt-1">
              {tickets.length === 0
                ? "No employee tickets have been raised yet"
                : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(ticket => {
              const isOpen  = ticket.status === "open";
              const lastReply = ticket.replies?.[ticket.replies.length - 1];
              const hasUnread = lastReply?.role === "employee";

              return (
                <div key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex sm:grid sm:grid-cols-[1fr_140px_120px_80px_40px] gap-4 items-center
                             px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors group">

                  {/* Subject + meta */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5
                      ${isOpen ? "bg-blue-50" : "bg-gray-50"}`}>
                      <TicketCheck size={16} className={isOpen ? "text-blue-400" : "text-gray-300"} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-800 truncate
                                      group-hover:text-[#1D7872] transition-colors">
                          {ticket.subject}
                        </p>
                        {hasUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" title="Employee replied — awaiting your response" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <MessageSquare size={10} /> {ticket.replies?.length || 0}
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

                  {/* Employee */}
                  <div className="hidden sm:flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#1D7872]/10 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-[#1D7872]" />
                    </div>
                    <p className="text-sm text-gray-700 font-semibold truncate">
                      {ticket.employeeName || "Employee"}
                    </p>
                  </div>

                  {/* Category */}
                  <div className="hidden sm:block">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100
                                     px-2.5 py-1 rounded-lg truncate block w-fit max-w-full">
                      {ticket.category}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block flex-shrink-0">
                    <StatusBadge status={ticket.status} />
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-end flex-shrink-0">
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-[#1D7872] transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400 font-medium">
              Showing {filtered.length} of {tickets.length} tickets
            </p>
          </div>
        )}
      </div>

      {/* ── Ticket Detail Modal ───────────────────────────────── */}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onReply={handleReply}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5
          rounded-2xl shadow-2xl text-white text-sm font-semibold animate-fade-in
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

export default AdminTickets;