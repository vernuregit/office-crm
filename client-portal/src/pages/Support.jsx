import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  addDoc, orderBy, serverTimestamp,
  doc, updateDoc, arrayUnion
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import {
  TicketCheck, Plus, ChevronRight,
  X, Send, Loader2, AlertCircle,
  CheckCircle, MessageSquare, Tag
} from "lucide-react";

const CATEGORIES = [
  "ITR Filing", "GST Query", "TDS Issue",
  "Invoice Dispute", "Document Request", "General Query"
];

// ─── New Ticket Form ──────────────────────────────────────────────
const NewTicketForm = ({ onSubmit, onCancel }) => {
  const [subject,     setSubject]     = useState("");
  const [category,    setCategory]    = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    await onSubmit({ subject, category, description });
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00A499] flex items-center justify-center">
            <TicketCheck size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-base">Raise a New Ticket</h3>
            <p className="text-xs text-gray-400 font-medium">We'll respond within 24 hours</p>
          </div>
        </div>
        <button onClick={onCancel} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
          <div className="relative">
            <Tag size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border accent-[#00A499] border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499] transition-all bg-white appearance-none"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief summary of your issue"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499] transition-all bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue in detail..."
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A499]focus:border-[#00A499] transition-all bg-white resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A499] text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting...</> : <><Send size={14} /> Submit Ticket</>}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Ticket Detail ────────────────────────────────────────────────
const TicketDetail = ({ ticket, onClose, onReply }) => {
  const [reply,      setReply]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { userData } = useAuthStore();

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    await onReply(ticket.id, reply, userData?.name);
    setReply("");
    setSubmitting(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] p-6 mb-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs 
             text-[#00A499] border border-indigo-100 px-2.5 py-0.5 rounded-full font-semibold">
              {ticket.category}
            </span>
            <StatusBadge status={ticket.status} />
          </div>
          <h3 className="font-black text-gray-900 text-lg">{ticket.subject}</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Opened on{" "}
            {ticket.createdAt
              ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                  day: "numeric", month: "long", year: "numeric",
                })
              : "—"}
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Original Message */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
        <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Your Message</p>
        <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
      </div>

      {/* Replies */}
      {ticket.replies && ticket.replies.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Conversation</p>
          {ticket.replies.map((r, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 ${
                r.role === "client"
                  ? "bg-indigo-50 border border-indigo-100 ml-6"
                  : "bg-purple-50 border border-purple-100 mr-6"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-gray-700">
                  {r.role === "client" ? "You" : `CA Team — ${r.name || "Staff"}`}
                </p>
                <p className="text-xs text-gray-400 font-medium">
                  {r.createdAt
                    ? new Date(r.createdAt.toDate()).toLocaleString("en-IN", {
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
      )}

      {/* Reply Input */}
      {ticket.status !== "resolved" && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Add a Reply</p>
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply here..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499] transition-all bg-white resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={handleReply}
              disabled={!reply.trim() || submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00A499] text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : <><Send size={14} /> Send Reply</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Support Page ────────────────────────────────────────────
const Support = () => {
  const { user, userData }   = useAuthStore();
  const [tickets,         setTickets]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [showForm,        setShowForm]        = useState(false);
  const [selectedTicket,  setSelectedTicket]  = useState(null);
  const [filter,          setFilter]          = useState("all");
  const [success,         setSuccess]         = useState("");

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "tickets"),
        where("clientId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [user]);

  const handleCreateTicket = async ({ subject, category, description }) => {
    await addDoc(collection(db, "tickets"), {
      clientId:   user.uid,
      clientName: userData?.name || "Client",
      subject, category, description,
      status:     "open",
      replies:    [],
      createdAt:  serverTimestamp(),
    });
    setShowForm(false);
    setSuccess("Ticket submitted! Our team will respond within 24 hours.");
    setTimeout(() => setSuccess(""), 5000);
    fetchTickets();
  };

  const handleReply = async (ticketId, message, name) => {
    await updateDoc(doc(db, "tickets", ticketId), {
      replies: arrayUnion({
        role: "client", name: name || "Client",
        message, createdAt: new Date(),
      }),
    });
    setSelectedTicket((prev) => ({
      ...prev,
      replies: [
        ...(prev.replies || []),
        { role: "client", name, message, createdAt: { toDate: () => new Date() } },
      ],
    }));
    fetchTickets();
  };

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const stats = {
    total:      tickets.length,
    open:       tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in-progress").length,
    resolved:   tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <Layout title="Support">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Tickets", value: stats.total,      color: "text-gray-700",  bg: "bg-indigo-50"  },
          { label: "Open",          value: stats.open,       color: "text-gray-700",    bg: "bg-blue-50"    },
          { label: "In Progress",   value: stats.inProgress, color: "text-gray-700",   bg: "bg-amber-50"   },
          { label: "Resolved",      value: stats.resolved,   color: "text-gray-700", bg: "bg-emerald-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4">
          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
          {success}
        </div>
      )}

      {showForm && (
        <NewTicketForm onSubmit={handleCreateTicket} onCancel={() => setShowForm(false)} />
      )}
      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onReply={handleReply}
        />
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {["all", "open", "in-progress", "resolved"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all cursor-pointer
                ${filter === tab
                  ? "bg-[#00A499] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200  hover:text-[#00A499]"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {!showForm && !selectedTicket && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00A499] cursor-pointer text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md"
          >
            <Plus size={15} /> Raise Ticket
          </button>
        )}
      </div>

      {/* Ticket List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TicketCheck size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">No tickets found</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-gray-700 cursor-pointer text-sm font-semibold hover:underline">
              Raise your first ticket →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => { setSelectedTicket(ticket); setShowForm(false); }}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0  transition-colors">
                    <TicketCheck size={18} className="text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800  transition-colors">
                      {ticket.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 font-medium">{ticket.category}</span>
                      <span className="text-gray-200">•</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                        <MessageSquare size={10} /> {ticket.replies?.length || 0} replies
                      </span>
                      <span className="text-gray-200">•</span>
                      <span className="text-xs text-gray-400 font-medium">
                        {ticket.createdAt
                          ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString("en-IN")
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={ticket.status} />
                  <ChevronRight size={16} className="text-gray-300  transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Support;
