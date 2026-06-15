import { useEffect, useState } from "react";
import {
  collection, getDocs, doc,
  updateDoc, deleteDoc, serverTimestamp, setDoc
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, updateProfile
} from "firebase/auth";
import { db }            from "../firebase/config";
import { secondaryAuth } from "../firebase/secondaryApp";
import Layout            from "../components/Layout";
import {
  Plus, Search, Pencil, Trash2, X,
  UserSquare2, Mail, Phone, Building2,
  MapPin, Eye, EyeOff, CheckCircle2,
  AlertCircle, Globe
} from "lucide-react";

// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
    ${type === "success" ? "bg-emerald-500" : "bg-red-500"} text-white text-sm font-semibold`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
  </div>
);

// ─── Input Field ──────────────────────────────────────────────────
const Field = ({ label, icon: Icon, error, children }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
      {label}
    </label>
    <div className="relative">
      {Icon && (
        <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      )}
      {children}
    </div>
    {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
  </div>
);

const inputCls = (hasIcon = true, extra = "") =>
  `w-full bg-gray-50 border border-gray-200 rounded-xl ${hasIcon ? "pl-10" : "pl-4"} pr-4 py-2.5
   text-sm text-gray-800 placeholder:text-gray-400
   focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border--[#153485]
   disabled:opacity-50 disabled:bg-gray-100 transition-all ${extra}`;

// ─── Client Form Modal ────────────────────────────────────────────
const ClientModal = ({ client, onClose, onSave }) => {
  const isEdit = !!client?.uid;
  const [form, setForm] = useState({
    name:      client?.name      || "",
    email:     client?.email     || "",
    phone:     client?.phone     || "",
    company:   client?.company   || "",
    address:   client?.address   || "",
    gstNumber: client?.gstNumber || "",
    password:  "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onSave(form, isEdit ? client.uid : null);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl shadow-gray-200/80 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#153485] flex items-center justify-center">
              <UserSquare2 size={16} className="text-[#153485]" />
            </div>
            <h2 className="text-sm font-black text-gray-900">
              {isEdit ? "Edit Client" : "Add New Client"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Name */}
          <Field label="Full Name *" icon={UserSquare2}>
            <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Client Name" required
              className={inputCls()} />
          </Field>

          {/* Email */}
          <Field label="Email *" icon={Mail}>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
              placeholder="client@company.com" required disabled={isEdit}
              className={inputCls()} />
          </Field>

          {/* Phone */}
          <Field label="Phone" icon={Phone}>
            <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
              placeholder="+91 98765 43210"
              className={inputCls()} />
          </Field>

          {/* Company */}
          <Field label="Company" icon={Building2}>
            <input type="text" value={form.company} onChange={e => set("company", e.target.value)}
              placeholder="Company Pvt. Ltd."
              className={inputCls()} />
          </Field>

          {/* Address */}
          <Field label="Address" icon={MapPin}>
            <textarea value={form.address} onChange={e => set("address", e.target.value)}
              placeholder="123 Street, City, State"
              rows={2}
              className={`w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5
                text-sm text-gray-800 placeholder:text-gray-400
                focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border-[#153485]
                transition-all resize-none`}
            />
          </Field>

          {/* GST Number */}
          <Field label="GST Number" icon={Globe}>
            <input type="text" value={form.gstNumber} onChange={e => set("gstNumber", e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              className={inputCls()} />
          </Field>

          {/* Password — only on create */}
          {!isEdit && (
            <Field label="Portal Password *">
              <input
                type={showPwd ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                placeholder="Min. 6 characters"
                required
                minLength={6}
                className={`w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-11 py-2.5
                  text-sm text-gray-800 placeholder:text-gray-400
                  focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border-[#153485] transition-all`}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <p className="text-xs text-gray-400 mt-1.5 font-medium">
                Client uses this to login to their portal
              </p>
            </Field>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#153485] cursor-pointer disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-indigo-200">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Client Card ──────────────────────────────────────────────────
const ClientCard = ({ client, onEdit, onDelete }) => {
  const initials = client.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const colors   = ["bg-[#153485]"];
  const color    = colors[client.name?.charCodeAt(0) % colors.length] || colors[0];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-gray-200 transition-all duration-200 shadow-sm group">

      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{client.name}</p>
            <p className="text-xs text-gray-400 truncate font-medium">{client.email}</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(client)}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200  flex items-center justify-center  transition-all"
            aria-label="Edit client"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(client)}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
            aria-label="Delete client"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {client.company && (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <Building2 size={12} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{client.company}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <Phone size={12} className="text-gray-400 flex-shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.address && (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <span className="truncate">{client.address}</span>
          </div>
        )}
        {client.gstNumber && (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <Globe size={12} className="text-gray-400 flex-shrink-0" />
            <span className="font-mono tracking-wide">{client.gstNumber}</span>
          </div>
        )}
      </div>

      {/* Footer badge */}
      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
        <span className="text-xs font-bold text-[#153485] bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
          Client
        </span>
        {client.assignedToName && (
          <span className="text-xs text-gray-400 font-medium truncate max-w-[120px]">
            → {client.assignedToName}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────
const DeleteModal = ({ client, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-gray-200/80 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={20} className="text-red-500" />
      </div>
      <h3 className="text-base font-black text-gray-900 mb-1">Delete Client</h3>
      <p className="text-sm text-gray-500 font-medium mb-6">
        Delete <span className="text-gray-900 font-bold">{client?.name}</span>?{" "}
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

// ─── Clients Page ─────────────────────────────────────────────────
export default function Clients() {
  const [clients,      setClients]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [modal,        setModal]        = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delLoading,   setDelLoading]   = useState(false);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      setClients(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch {
      showToast("Failed to load clients", "error");
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSave = async (form, existingUid) => {
    if (existingUid) {
      await updateDoc(doc(db, "users", existingUid), {
        name:      form.name,
        phone:     form.phone,
        company:   form.company,
        address:   form.address,
        gstNumber: form.gstNumber,
        updatedAt: serverTimestamp(),
      });
      setClients(prev => prev.map(c =>
        c.uid === existingUid ? { ...c, ...form } : c
      ));
      showToast("Client updated successfully");
    } else {
      const { user } = await createUserWithEmailAndPassword(
        secondaryAuth, form.email, form.password
      );
      await updateProfile(user, { displayName: form.name });

      const clientData = {
        uid:       user.uid,
        name:      form.name,
        email:     form.email,
        phone:     form.phone      || "",
        company:   form.company    || "",
        address:   form.address    || "",
        gstNumber: form.gstNumber  || "",
        role:      "client",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", user.uid), clientData);
      await secondaryAuth.signOut();

      setClients(prev => [...prev, { uid: user.uid, ...clientData }]);
      showToast("Client created successfully");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "users", deleteTarget.uid));
      setClients(prev => prev.filter(c => c.uid !== deleteTarget.uid));
      showToast("Client deleted");
    } catch {
      showToast("Failed to delete client", "error");
    }
    setDelLoading(false);
    setDeleteTarget(null);
  };

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())  ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Clients">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
            <UserSquare2 size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{clients.length}</p>
            <p className="text-xs text-gray-400 font-medium">Total Clients</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-gray-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">
              {clients.filter(c => c.company).length}
            </p>
            <p className="text-xs text-gray-400 font-medium">With Company</p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400
                       focus:border-indigo-400 transition-all shadow-sm"
          />
        </div>
        <button
          onClick={() => setModal("add")}
          className="flex items-center gap-2 bg-[#153485] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-indigo-200"
        >
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-48 border border-gray-100 animate-pulse shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
            <UserSquare2 size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-500">
            {clients.length === 0 ? "No clients yet" : "No results found"}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {clients.length === 0
              ? `Click "Add Client" to get started`
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ClientCard
              key={c.uid}
              client={c}
              onEdit={c => setModal(c)}
              onDelete={c => setDeleteTarget(c)}
            />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <ClientModal
          client={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          client={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={delLoading}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}