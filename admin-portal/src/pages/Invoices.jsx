import { useEffect, useState, useRef } from "react";
import {
  collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { db }          from "../firebase/config";
import useAuthStore    from "../store/authStore";
import Layout          from "../components/Layout";
import {
  Plus, Search, Pencil, Trash2, X,
  FileText, UserSquare2, IndianRupee,
  CheckCircle2, AlertCircle, ChevronDown,
  Eye, Send, Calendar, Hash, Printer
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────
const STATUSES = [
  { value: "draft",   label: "Draft",   color: "text-gray-500",    bg: "bg-gray-100      border-gray-200"      },
  { value: "sent",    label: "Sent",    color: "text-blue-600",    bg: "bg-blue-50       border-blue-100"      },
  { value: "paid",    label: "Paid",    color: "text-emerald-600", bg: "bg-emerald-50    border-emerald-100"   },
  { value: "overdue", label: "Overdue", color: "text-red-500",     bg: "bg-red-50        border-red-100"       },
];

const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);

const genInvoiceNo = () =>
  `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
    ${type === "success" ? "bg-emerald-500" : "bg-red-500"} text-white text-sm font-semibold`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
  </div>
);

// ─── Shared input class ───────────────────────────────────────────
const inputCls = (extra = "") =>
  `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
   placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400
   focus:border-amber-400 transition-all ${extra}`;

const selectCls =
  `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
   focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400
   appearance-none transition-all`;

// ─── Line Item Row ────────────────────────────────────────────────
const LineItemRow = ({ item, idx, onChange, onRemove }) => (
  <div className="grid grid-cols-12 gap-2 items-center">
    <input
      className="col-span-5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800
                 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
      placeholder="Description"
      value={item.description}
      onChange={e => onChange(idx, "description", e.target.value)}
    />
    <input type="number" min="1"
      className="col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800
                 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
      placeholder="Qty"
      value={item.qty}
      onChange={e => onChange(idx, "qty", e.target.value)}
    />
    <input type="number" min="0"
      className="col-span-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800
                 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all"
      placeholder="Rate ₹"
      value={item.rate}
      onChange={e => onChange(idx, "rate", e.target.value)}
    />
    <div className="col-span-1 text-xs text-gray-500 font-mono text-right">
      {fmtINR((+item.qty || 0) * (+item.rate || 0)).replace("₹", "")}
    </div>
    <button type="button" onClick={() => onRemove(idx)}
      className="col-span-1 w-6 h-6 rounded-lg bg-gray-100 hover:bg-red-50 hover:border hover:border-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all mx-auto"
      aria-label="Remove line">
      <X size={11} />
    </button>
  </div>
);

// ─── Invoice Form Modal ───────────────────────────────────────────
const InvoiceModal = ({ invoice, clients, onClose, onSave }) => {
  const isEdit = !!invoice?.id;
  const [form, setForm] = useState({
    invoiceNo:     invoice?.invoiceNo     || genInvoiceNo(),
    clientId:      invoice?.clientId      || "",
    clientName:    invoice?.clientName    || "",
    clientAddress: invoice?.clientAddress || "",
    clientGST:     invoice?.clientGST     || "",
    issueDate:     invoice?.issueDate     || new Date().toISOString().slice(0, 10),
    dueDate:       invoice?.dueDate       || "",
    status:        invoice?.status        || "draft",
    gstRate:       invoice?.gstRate       ?? 18,
    notes:         invoice?.notes         || "",
    items:         invoice?.items         || [{ description: "", qty: 1, rate: "" }],
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleClientChange = (uid) => {
    const cl = clients.find(c => c.uid === uid);
    setForm(f => ({
      ...f,
      clientId:      uid,
      clientName:    cl?.name      || "",
      clientAddress: cl?.address   || "",
      clientGST:     cl?.gstNumber || "",
    }));
  };

  const handleItemChange = (idx, key, val) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: val };
      return { ...f, items };
    });
  };

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, { description: "", qty: 1, rate: "" }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const subtotal = form.items.reduce((s, i) => s + (+i.qty || 0) * (+i.rate || 0), 0);
  const gstAmt   = (subtotal * (+form.gstRate || 0)) / 100;
  const total    = subtotal + gstAmt;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.clientId) { setError("Please select a client"); return; }
    if (form.items.every(i => !i.description)) { setError("Add at least one line item"); return; }
    setLoading(true);
    try {
      await onSave({ ...form, subtotal, gstAmt, total }, isEdit ? invoice.id : null);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl shadow-gray-200/80 max-h-[94vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
              <FileText size={16} className="text-amber-600" />
            </div>
            <h2 className="text-sm font-black text-gray-900">
              {isEdit ? "Edit Invoice" : "Create Invoice"}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Invoice No + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                <Hash size={11} className="inline mr-1" />Invoice No
              </label>
              <input type="text" value={form.invoiceNo}
                onChange={e => set("invoiceNo", e.target.value)}
                className={`${inputCls()} font-mono`} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
              <div className="relative">
                <select value={form.status} onChange={e => set("status", e.target.value)} className={selectCls}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Client */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              <UserSquare2 size={11} className="inline mr-1" />Bill To Client *
            </label>
            <div className="relative">
              <select value={form.clientId} onChange={e => handleClientChange(e.target.value)} className={selectCls}>
                <option value="">— Select client —</option>
                {clients.map(c => (
                  <option key={c.uid} value={c.uid}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            {form.clientGST && (
              <p className="text-xs text-gray-400 mt-1.5 font-mono font-medium">GST: {form.clientGST}</p>
            )}
          </div>

          {/* Issue + Due Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                <Calendar size={11} className="inline mr-1" />Issue Date
              </label>
              <input type="date" value={form.issueDate} onChange={e => set("issueDate", e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} className={inputCls()} />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Line Items</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors">
                <Plus size={12} /> Add Item
              </button>
            </div>
            <div className="grid grid-cols-12 gap-2 mb-1.5">
              {["Description", "Qty", "Rate (₹)", "Amount", ""].map((h, i) => (
                <span key={i} className={`text-xs font-bold text-gray-400 uppercase tracking-wider
                  ${i === 0 ? "col-span-5" : i === 1 ? "col-span-2" : i === 2 ? "col-span-3" : i === 3 ? "col-span-1 text-right" : "col-span-1"}`}>
                  {h}
                </span>
              ))}
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <LineItemRow key={idx} item={item} idx={idx} onChange={handleItemChange} onRemove={removeItem} />
              ))}
            </div>
            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-medium">Subtotal</span>
                <span className="text-gray-800 font-bold font-mono">{fmtINR(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">GST</span>
                  <input type="number" value={form.gstRate} min="0" max="100"
                    onChange={e => set("gstRate", e.target.value)}
                    className="w-14 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 text-center focus:outline-none focus:ring-1 focus:ring-amber-400 transition-all" />
                  <span className="text-gray-500">%</span>
                </div>
                <span className="text-gray-800 font-bold font-mono">{fmtINR(gstAmt)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-900 font-black">Total</span>
                <span className="text-amber-600 font-black font-mono">{fmtINR(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Payment terms, bank details, thank you note…"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
                         placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400
                         focus:border-amber-400 transition-all resize-none"
            />
          </div>

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
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-amber-100">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Invoice View Modal ───────────────────────────────────────────
const InvoiceView = ({ invoice, onClose }) => {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${invoice.invoiceNo}</title>
      <style>
        body { font-family: sans-serif; color: #111; padding: 40px; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f4f4f4; padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        @media print { body { padding: 0; } }
      </style></head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  // ✅ FIX: safe date formatter handles both plain string "YYYY-MM-DD" and Firestore Timestamp
  const fmtDate = (val) => {
    if (!val) return "—";
    if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const sm = STATUSES.find(s => s.value === invoice.status) || STATUSES[0];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl shadow-gray-200/80 max-h-[92vh] overflow-y-auto border border-gray-200">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <span className="text-sm font-black text-gray-800 font-mono">{invoice.invoiceNo}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm shadow-amber-100">
              <Printer size={13} /> Print / PDF
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        <div ref={printRef} className="p-8 text-gray-800">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-black text-gray-900">INVOICE</h1>
              <p className="text-sm text-gray-400 font-mono mt-1">{invoice.invoiceNo}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${sm.bg} ${sm.color}`}>
              {sm.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Bill To</p>
              <p className="font-bold text-gray-900">{invoice.clientName}</p>
              {invoice.clientAddress && <p className="text-gray-500 text-xs mt-0.5">{invoice.clientAddress}</p>}
              {invoice.clientGST     && <p className="text-gray-500 text-xs font-mono">GST: {invoice.clientGST}</p>}
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Issue Date</p>
              <p className="font-bold text-gray-900">{fmtDate(invoice.issueDate)}</p>
              {invoice.dueDate && (
                <>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mt-2 mb-1">Due Date</p>
                  <p className="font-bold text-gray-900">{fmtDate(invoice.dueDate)}</p>
                </>
              )}
            </div>
          </div>

          <table className="w-full mb-4 text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-2.5 px-3 text-xs uppercase tracking-wider text-gray-500 font-bold rounded-l-lg">Description</th>
                <th className="text-center py-2.5 px-3 text-xs uppercase tracking-wider text-gray-500 font-bold w-16">Qty</th>
                <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-gray-500 font-bold w-28">Rate</th>
                <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-gray-500 font-bold w-28 rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.filter(i => i.description).map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2.5 px-3 text-gray-800">{item.description}</td>
                  <td className="py-2.5 px-3 text-center text-gray-500">{item.qty}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-500">{fmtINR(item.rate)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-800">
                    {fmtINR((+item.qty || 0) * (+item.rate || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 px-3 text-right text-sm text-gray-500">Subtotal</td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-gray-800">{fmtINR(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 px-3 text-right text-sm text-gray-500">GST ({invoice.gstRate}%)</td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-gray-800">{fmtINR(invoice.gstAmt)}</td>
              </tr>
              <tr className="border-t-2 border-gray-200">
                <td colSpan={3} className="py-3 px-3 text-right font-black text-base text-gray-900">Total</td>
                <td className="py-3 px-3 text-right font-black font-mono text-base text-amber-600">{fmtINR(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-600">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Invoice Row ──────────────────────────────────────────────────
const InvoiceRow = ({ inv, onEdit, onDelete, onView, onStatusChange }) => {
  const sm = STATUSES.find(s => s.value === inv.status) || STATUSES[0];
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      <td className="py-3.5 px-4">
        <p className="text-sm font-bold text-gray-900 font-mono">{inv.invoiceNo}</p>
        <p className="text-xs text-gray-400 font-medium">{inv.issueDate}</p>
      </td>
      <td className="py-3.5 px-4">
        <p className="text-sm font-semibold text-gray-800">{inv.clientName}</p>
      </td>
      <td className="py-3.5 px-4 text-right">
        <p className="text-sm font-black text-amber-600 font-mono">{fmtINR(inv.total)}</p>
        <p className="text-xs text-gray-400 font-medium">{inv.gstRate}% GST</p>
      </td>
      <td className="py-3.5 px-4">
        <div className="relative inline-block">
          <select
            value={inv.status}
            onChange={e => onStatusChange(inv.id, e.target.value)}
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border appearance-none cursor-pointer bg-transparent focus:outline-none pr-6 ${sm.bg} ${sm.color}`}
          >
            {STATUSES.map(s => (
              <option key={s.value} value={s.value} className="bg-white text-gray-800">{s.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${sm.color}`} />
        </div>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onView(inv)} aria-label="View invoice"
            className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-100 hover:bg-amber-100 flex items-center justify-center text-amber-600 transition-all">
            <Eye size={13} />
          </button>
          <button onClick={() => onEdit(inv)} aria-label="Edit invoice"
            className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-100 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(inv)} aria-label="Delete invoice"
            className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 hover:bg-red-50 hover:border-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── Delete Modal ─────────────────────────────────────────────────
const DeleteModal = ({ inv, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-gray-200/80 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={20} className="text-red-500" />
      </div>
      <h3 className="text-base font-black text-gray-900 mb-1">Delete Invoice</h3>
      <p className="text-sm text-gray-500 font-medium mb-6">
        Delete <span className="text-gray-900 font-bold font-mono">{inv?.invoiceNo}</span>?{" "}
        This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-red-100">
          {loading ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ─── Invoices Page ────────────────────────────────────────────────
export default function Invoices() {
  // ✅ FIX: import user from authStore so createdBy is set correctly
  const { user }           = useAuthStore();
  const [invoices,     setInvoices]     = useState([]);
  const [clients,      setClients]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [modal,        setModal]        = useState(null);
  const [viewInvoice,  setViewInvoice]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delLoading,   setDelLoading]   = useState(false);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [invSnap, clientSnap] = await Promise.all([
          getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"))),
          getDocs(collection(db, "users")),
        ]);
        setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setClients(clientSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
      } catch {
        showToast("Failed to load invoices", "error");
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const handleSave = async (form, existingId) => {
    if (existingId) {
      await updateDoc(doc(db, "invoices", existingId), { ...form, updatedAt: serverTimestamp() });
      setInvoices(prev => prev.map(i => i.id === existingId ? { ...i, ...form } : i));
      showToast("Invoice updated");
    } else {
      // ✅ FIX: was createdBy: null — now correctly stores the admin's uid
      const ref = await addDoc(collection(db, "invoices"), {
        ...form,
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
      });
      setInvoices(prev => [{ id: ref.id, ...form }, ...prev]);
      showToast("Invoice created");
    }
  };

  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, "invoices", id), { status, updatedAt: serverTimestamp() });
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "invoices", deleteTarget.id));
      setInvoices(prev => prev.filter(i => i.id !== deleteTarget.id));
      showToast("Invoice deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
    setDelLoading(false);
    setDeleteTarget(null);
  };

  const filtered = invoices.filter(i => {
    const matchSearch = i.invoiceNo?.toLowerCase().includes(search.toLowerCase()) ||
                        i.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || i.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total || 0), 0);
  const outstanding  = invoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + (i.total || 0), 0);

  const statCards = [
    { label: "Total Invoices", val: invoices.length,                                icon: FileText,     bg: "bg-gray-50",    border: "border-gray-200",    iconColor: "text-gray-500",    valColor: "text-gray-900"  },
    { label: "Paid",           val: invoices.filter(i => i.status === "paid").length, icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-100", iconColor: "text-emerald-600", valColor: "text-gray-900"  },
    { label: "Outstanding",    val: fmtINR(outstanding),                             icon: Send,         bg: "bg-blue-50",    border: "border-blue-100",    iconColor: "text-blue-600",    valColor: "text-gray-900"  },
    { label: "Revenue",        val: fmtINR(totalRevenue),                            icon: IndianRupee,  bg: "bg-amber-50",   border: "border-amber-100",   iconColor: "text-amber-600",   valColor: "text-amber-600" },
  ];

  return (
    <Layout title="Invoices">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div className="min-w-0">
              <p className={`text-lg font-black truncate ${s.valColor}`}>{s.val}</p>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400
                       focus:border-amber-400 transition-all shadow-sm"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl pl-4 pr-8 py-2.5 text-xs text-gray-700 font-bold
                       focus:outline-none focus:ring-2 focus:ring-amber-400 appearance-none transition-all shadow-sm"
          >
            <option value="all">All Status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <button
          onClick={() => setModal("new")}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-amber-100 ml-auto"
        >
          <Plus size={16} /> New Invoice
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
              <FileText size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-500">
              {invoices.length === 0 ? "No invoices yet" : "No matching invoices"}
            </p>
            <p className="text-xs text-gray-400 font-medium mt-1">
              {invoices.length === 0 ? `Click "New Invoice" to create your first` : "Try adjusting filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {["Invoice", "Client", "Amount", "Status", "Actions"].map((h, i) => (
                    <th key={h}
                      className={`py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider
                        ${i === 2 || i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <InvoiceRow
                    key={inv.id}
                    inv={inv}
                    onEdit={i   => setModal(i)}
                    onDelete={i => setDeleteTarget(i)}
                    onView={i   => setViewInvoice(i)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <InvoiceModal
          invoice={modal === "new" ? null : modal}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {viewInvoice && <InvoiceView invoice={viewInvoice} onClose={() => setViewInvoice(null)} />}
      {deleteTarget && (
        <DeleteModal inv={deleteTarget} onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)} loading={delLoading} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}