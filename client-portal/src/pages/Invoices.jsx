import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db }          from "../firebase/config";
import useAuthStore    from "../store/authStore";
import useRazorpay     from "../hooks/useRazorpay";
import Layout          from "../components/Layout";
import StatusBadge     from "../components/StatusBadge";
import { FileText, CreditCard, CheckCircle, Receipt, TrendingDown } from "lucide-react";

// ✅ FIX: safe date formatter — handles both plain "YYYY-MM-DD" string and Firestore Timestamp
const fmtDate = (val) => {
  if (!val) return "—";
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("en-IN");
  return new Date(val).toLocaleDateString("en-IN");
};

const Invoices = () => {
  const { user }            = useAuthStore();
  const { initiatePayment } = useRazorpay();
  const [invoices,   setInvoices]   = useState([]);
  const [filter,     setFilter]     = useState("all");
  const [loading,    setLoading]    = useState(true);
  const [payingId,   setPayingId]   = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchInvoices = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "invoices"),
        where("clientId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [user]);

  const filtered = filter === "all" ? invoices : invoices.filter((i) => i.status === filter);

  // ✅ FIX: was using inv.amount — admin saves the field as "total"
  const totalPending = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.total || i.amount || 0), 0);

  const handlePay = async (invoice) => {
    setPayingId(invoice.id);
    await initiatePayment({
      invoiceId:   invoice.id,
      // ✅ FIX: was invoice.amount — admin saves as "total"
      amount:      invoice.total || invoice.amount,
      // ✅ FIX: was invoice.invoiceNumber — admin saves as "invoiceNo"
      description: invoice.notes || `Invoice #${invoice.invoiceNo || invoice.id.slice(0, 6).toUpperCase()}`,
      onSuccess: (response) => {
        setSuccessMsg(`Payment successful! ID: ${response.razorpay_payment_id}`);
        fetchInvoices();
        setTimeout(() => setSuccessMsg(""), 5000);
      },
    });
    setPayingId(null);
  };

  return (
    <Layout title="Invoices & Payments">

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Invoices",  value: invoices.length,                                         Icon: Receipt,      color: "text-indigo-600",  bg: "bg-indigo-50"  },
          { label: "Pending Amount",  value: `₹${totalPending.toLocaleString("en-IN")}`,              Icon: TrendingDown, color: "text-red-600",     bg: "bg-red-50"     },
          { label: "Paid Invoices",   value: invoices.filter(i => i.status === "paid").length,        Icon: CheckCircle,  color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={22} className={s.color} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4">
          <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Filters — ✅ FIX: tabs now match admin statuses (draft/sent/paid/overdue) */}
      <div className="flex gap-2 mb-4">
        {["all", "sent", "paid", "overdue", "draft"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all cursor-pointer
              ${filter === tab
                ? "bg-[#153485] text-white shadow-md"
                : "bg-white text-gray-500 border border-gray-200 hover:text-[#153485]"
              }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Receipt size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">No invoices found</p>
            <p className="text-xs mt-1 text-gray-400">Your CA team's invoices will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Invoice #", "Description", "Amount", "Due Date", "Status", "Action"].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-bold text-black font-mono">
                    {/* ✅ FIX: admin saves invoiceNo not invoiceNumber */}
                    #{inv.invoiceNo || inv.invoiceNumber || inv.id.slice(0, 6).toUpperCase()}
                  </td>
                  <td className="px-5 py-4 text-gray-600 font-medium">
                    {inv.notes || inv.description || "—"}
                  </td>
                  <td className="px-5 py-4 font-black text-gray-800">
                    {/* ✅ FIX: admin saves total not amount */}
                    ₹{(inv.total || inv.amount || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {/* ✅ FIX: admin saves dueDate as plain string, not Timestamp */}
                    {fmtDate(inv.dueDate)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 items-center">
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 transition-all font-medium"
                        >
                          <FileText size={12} /> PDF
                        </a>
                      )}
                      {(inv.status === "sent" || inv.status === "overdue") && (
                        <button
                          onClick={() => handlePay(inv)}
                          disabled={payingId === inv.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#153485] text-white hover:opacity-90 transition-all font-semibold disabled:opacity-50"
                        >
                          <CreditCard size={12} />
                          {payingId === inv.id ? "Opening..." : "Pay Now"}
                        </button>
                      )}
                      {inv.status === "paid" && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle size={13} /> Paid
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export default Invoices;