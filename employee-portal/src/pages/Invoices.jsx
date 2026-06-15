import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  orderBy, doc, getDoc
} from "firebase/firestore";
import { db }       from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout       from "../components/Layout";
import {
  FileText, Search, Eye, X,
  Calendar, Building2, Hash,
  IndianRupee, CheckCircle2,
  Clock, AlertCircle, ChevronRight, User
} from "lucide-react";

const fmtDate = (val, opts = { day: "numeric", month: "long", year: "numeric" }) => {
  if (!val) return "—";
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("en-IN", opts);
  return new Date(val).toLocaleDateString("en-IN", opts);
};

// ─── Invoice Detail Modal ─────────────────────────────────────────
const InvoiceModal = ({ invoice, onClose }) => {
  const statusStyle = {
    draft:   { bg: "bg-gray-50",    border: "border-gray-200",    text: "text-gray-600"    },
    sent:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700"    },
    paid:    { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
    overdue: { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-600"     },
  };
  const s = statusStyle[invoice.status] || statusStyle.sent;
  const total = invoice.total
    || invoice.items?.reduce((sum, i) => sum + (+(i.qty) || 1) * (+(i.rate) || 0), 0)
    || 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#153485] flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                Invoice #{invoice.invoiceNo || invoice.invoiceNumber || invoice.id?.slice(0, 8).toUpperCase()}
              </h2>
              <p className="text-xs text-gray-400 font-medium">{invoice.clientName}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Status Banner */}
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${s.bg} ${s.border}`}>
            {invoice.status === "paid"
              ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
              : invoice.status === "overdue"
              ? <AlertCircle  size={18} className="text-red-500 flex-shrink-0" />
              : <Clock        size={18} className="text-blue-500 flex-shrink-0" />
            }
            <p className={`text-sm font-bold capitalize ${s.text}`}>
              {invoice.status === "paid"    ? "This invoice has been paid"
               : invoice.status === "overdue" ? "This invoice is overdue"
               : invoice.status === "sent"    ? "Sent to client — awaiting payment"
               : "Draft — not yet sent"}
            </p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Hash,      label: "Invoice No.", value: `#${invoice.invoiceNo || invoice.id?.slice(0, 8).toUpperCase()}` },
              { Icon: Building2, label: "Client",      value: invoice.clientName },
              { Icon: Calendar,  label: "Issue Date",  value: fmtDate(invoice.issueDate) },
              { Icon: Calendar,  label: "Due Date",    value: fmtDate(invoice.dueDate)   },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} className="text-[#153485]" />
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                </div>
                <p className="text-sm font-bold text-gray-800 truncate">{value || "—"}</p>
              </div>
            ))}
          </div>

          {/* Line Items */}
          {invoice.items?.filter(i => i.description).length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Services / Items</p>
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["Description", "Qty", "Rate", "Amount"].map(h => (
                        <th key={h} className={`py-2.5 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider
                          ${h === "Description" ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.filter(i => i.description).map((item, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 text-gray-700 font-medium">{item.description}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{item.qty || 1}</td>
                        <td className="px-4 py-3 text-right text-gray-600">₹{(+(item.rate) || 0).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">
                          ₹{((+(item.qty) || 1) * (+(item.rate) || 0)).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-1.5">
                  {invoice.gstRate > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-gray-500 font-medium">
                        <span>Subtotal</span>
                        <span>₹{(invoice.subtotal || 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-500 font-medium">
                        <span>GST ({invoice.gstRate}%)</span>
                        <span>₹{(invoice.gstAmt || 0).toLocaleString("en-IN")}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-black text-gray-900 pt-1.5 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-[#153485]">₹{(invoice.total || total).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {invoice.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1.5">Notes</p>
              <p className="text-sm text-amber-800 leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          <p className="text-xs text-center text-gray-400 font-medium bg-gray-50 border border-gray-100 rounded-xl py-2.5 px-4">
            Read-only view — contact admin to make changes
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Invoice Card ─────────────────────────────────────────────────
const InvoiceCard = ({ invoice, onClick }) => {
  const statusConfig = {
    draft:   { bg: "bg-gray-50",    border: "border-gray-200",    dot: "bg-gray-400",    text: "text-gray-600"    },
    sent:    { bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-400",    text: "text-blue-700"    },
    paid:    { bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400", text: "text-emerald-700" },
    overdue: { bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-400",     text: "text-red-600"     },
  };
  const sc = statusConfig[invoice.status] || statusConfig.sent;
  const grandTotal = invoice.total
    || invoice.items?.reduce((sum, i) => sum + (+(i.qty) || 1) * (+(i.rate) || 0), 0)
    || 0;

  return (
    <div onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-gray-100 cursor-pointer group
                 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]
                 hover:shadow-[0_8px_30px_-4px_rgba(79,70,229,0.15)]
                 hover:-translate-y-0.5 hover:border-indigo-100
                 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider truncate">
              #{invoice.invoiceNo || invoice.id?.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <h3 className="font-bold text-gray-900 text-sm truncate">{invoice.clientName || "—"}</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5 truncate">
            {invoice.notes || invoice.description || "Invoice"}
          </p>
        </div>
        <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1 ml-2" />
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div>
          <p className="text-xs text-gray-400 font-medium">Total Amount</p>
          <p className="text-lg font-black text-gray-900">₹{grandTotal.toLocaleString("en-IN")}</p>
        </div>
        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold capitalize ${sc.bg} ${sc.border} ${sc.text}`}>
          {invoice.status || "draft"}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 font-medium">
        <Calendar size={12} />
        <span>Due: {fmtDate(invoice.dueDate, { day: "numeric", month: "short", year: "numeric" })}</span>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────
const Invoices = () => {
  const { user } = useAuthStore();

  const [assignedClientIds, setAssignedClientIds] = useState([]);
  const [invoices,  setInvoices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState("all");
  const [selected,  setSelected]  = useState(null);

  // ── Step 1: Load assigned client IDs from employee doc ──────────
  useEffect(() => {
    if (!user?.uid) return;
    const loadAssigned = async () => {
      try {
        const empSnap     = await getDoc(doc(db, "employees", user.uid));
        const assignedIds = empSnap.data()?.assignedClients || [];
        setAssignedClientIds(assignedIds);
      } catch (err) {
        console.error("Failed to load assigned clients:", err);
        setLoading(false);
      }
    };
    loadAssigned();
  }, [user?.uid]);

  // ── Step 2: Fetch invoices for all assigned clients ─────────────
  // Firestore "in" query supports max 30 items at a time
  useEffect(() => {
    if (assignedClientIds.length === 0) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    const fetchInvoices = async () => {
      setLoading(true);
      try {
        // Chunk into groups of 30 (Firestore "in" limit)
        const chunks = [];
        for (let i = 0; i < assignedClientIds.length; i += 30) {
          chunks.push(assignedClientIds.slice(i, i + 30));
        }

        const results = await Promise.all(
          chunks.map(chunk =>
            getDocs(
              query(
                collection(db, "invoices"),
                where("clientId", "in", chunk),
                orderBy("createdAt", "desc")
              )
            )
          )
        );

        const all = results.flatMap(snap =>
          snap.docs.map(d => ({ id: d.id, ...d.data() }))
        );

        // Sort merged results by createdAt descending
        all.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setInvoices(all);
      } catch (err) {
        console.error("Invoice fetch error:", err);
      }
      setLoading(false);
    };

    fetchInvoices();
  }, [assignedClientIds]);

  const filtered = invoices.filter(inv => {
    const matchSearch =
      inv.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      (inv.invoiceNo || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.notes || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || inv.status === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total:      invoices.length,
    paid:       invoices.filter(i => i.status === "paid").length,
    sent:       invoices.filter(i => i.status === "sent").length,
    overdue:    invoices.filter(i => i.status === "overdue").length,
    totalValue: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
  };

  return (
    <Layout title="Invoices">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Invoices", value: stats.total,   color: "text-gray-700"    },
          { label: "Paid",           value: stats.paid,    color: "text-emerald-600" },
          { label: "Sent",           value: stats.sent,    color: "text-blue-600"    },
          { label: "Overdue",        value: stats.overdue, color: "text-red-500"     },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Total Value Banner */}
      {invoices.length > 0 && (
        <div className="bg-[#153485] rounded-2xl p-5 mb-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IndianRupee size={22} />
            <div>
              <p className="text-xs text-white/80 font-medium uppercase tracking-wider">
                Total Invoice Value (Assigned Clients)
              </p>
              <p className="text-2xl font-black">₹{stats.totalValue.toLocaleString("en-IN")}</p>
            </div>
          </div>
          <p className="text-xs text-white/80 font-medium text-right">
            Across {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
        <div className="flex gap-2 flex-wrap">
          {["all", "draft", "sent", "paid", "overdue"].map(tab => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all cursor-pointer
                ${filter === tab
                  ? "bg-[#153485] text-white shadow-md"
                  : "bg-white text-gray-500 border border-gray-200 hover:text-[#153485]"
                }`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search invoices..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#153485]
                       focus:border-[#153485] transition-all bg-white" />
        </div>
      </div>

      {/* No clients assigned */}
      {!loading && assignedClientIds.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center
                        shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
          <User size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-bold text-gray-500">No clients assigned to you yet</p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            Ask your admin to assign clients — their invoices will appear here
          </p>
        </div>
      )}

      {/* Invoice Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-44 border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : assignedClientIds.length > 0 && filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <FileText size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-base font-bold text-gray-500">No invoices found</p>
          <p className="text-sm text-gray-400 font-medium mt-1">
            {invoices.length === 0
              ? "No invoices have been created for your assigned clients yet"
              : "Try a different filter or search"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(inv => (
            <InvoiceCard key={inv.id} invoice={inv} onClick={() => setSelected(inv)} />
          ))}
        </div>
      )}

      {selected && <InvoiceModal invoice={selected} onClose={() => setSelected(null)} />}
    </Layout>
  );
};

export default Invoices;