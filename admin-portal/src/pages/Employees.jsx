import { useEffect, useState } from "react";
import {
  collection, getDocs, doc,
  updateDoc, deleteDoc, serverTimestamp, setDoc
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { db }            from "../firebase/config";
import { secondaryAuth } from "../firebase/secondaryApp";
import Layout            from "../components/Layout";
import {
  Plus, Search, Pencil, Trash2, X,
  User, Mail, Phone, Briefcase,
  Eye, EyeOff, CheckCircle2, AlertCircle,
  Users, UserCheck, UserX,
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

// ─── Shared input class ───────────────────────────────────────────
const inputCls = (padLeft = true) =>
  `w-full bg-gray-50 border border-gray-200 rounded-xl ${padLeft ? "pl-10" : "pl-4"} pr-4 py-2.5
   text-sm text-gray-800 placeholder:text-gray-400
   disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed
   focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499] transition-all`;

// ─── Employee Form Modal ──────────────────────────────────────────
const EmployeeModal = ({ emp, onClose, onSave }) => {
  const isEdit = !!emp?.uid;
  const [form, setForm] = useState({
    name:       emp?.name       || "",
    email:      emp?.email      || "",
    phone:      emp?.phone      || "",
    department: emp?.department || "",
    role:       emp?.role       || "employee",
    password:   "",
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
      await onSave(form, isEdit ? emp.uid : null);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  const fields = [
    { key: "name",       label: "Full Name *",  type: "text",  icon: User,      placeholder: "John Doe",            required: true  },
    { key: "email",      label: "Email *",      type: "email", icon: Mail,      placeholder: "john@company.com",    required: true, disabled: isEdit },
    { key: "phone",      label: "Phone",        type: "tel",   icon: Phone,     placeholder: "+91 98765 43210"      },
    { key: "department", label: "Department",   type: "text",  icon: Briefcase, placeholder: "Engineering"          },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl shadow-gray-200/80 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00A499] border border-[#00A499] flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <h2 className="text-sm font-black text-gray-900">
              {isEdit ? "Edit Employee" : "Add New Employee"}
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

          {/* Text Fields */}
          {fields.map(({ key, label, type, icon: Icon, placeholder, disabled, required }) => (
            <div key={key}>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <div className="relative">
                <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => set(key, e.target.value)}
                  placeholder={placeholder}
                  disabled={disabled}
                  required={required}
                  className={inputCls()}
                />
              </div>
            </div>
          ))}

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Role
            </label>
            <select
              value={form.role}
              onChange={e => set("role", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5
                         text-sm text-gray-800 focus:outline-none focus:ring-2
                         focus:ring-[#00A499] focus:border-[#00A499] transition-all"
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="accountant">Accountant</option>
              <option value="hr">HR</option>
            </select>
          </div>

          {/* Password — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className={`w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-11 py-2.5
                    text-sm text-gray-800 placeholder:text-gray-400
                    focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499] transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5 font-medium">
                Employee uses this to log in to their portal
              </p>
            </div>
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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#00A499] cursor-pointer disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-blue-200"
            >
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Employee Card ────────────────────────────────────────────────
const EmployeeCard = ({ emp, onEdit, onDelete }) => {
  const initials = emp.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const colors   = ["bg-[#00A499]","bg-[#00A499]","bg-[#00A499]","bg-[#00A499]","bg-[#00A499]","bg-[#00A499]"];
  const color    = colors[emp.name?.charCodeAt(0) % colors.length] || colors[0];

  const isActive = emp.status !== "inactive";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-gray-200 transition-all duration-200 shadow-sm group">

      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{emp.name}</p>
            <p className="text-xs text-gray-400 truncate font-medium">{emp.email}</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(emp)}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 hover:bg-blue-50 hover:border-blue-200 flex items-center justify-center text-gray-400 hover:text-blue-600 transition-all"
            aria-label="Edit employee"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(emp)}
            className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"
            aria-label="Delete employee"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {emp.phone && (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <Phone size={12} className="text-gray-400 flex-shrink-0" />
            <span>{emp.phone}</span>
          </div>
        )}
        {emp.department && (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
            <Briefcase size={12} className="text-gray-400 flex-shrink-0" />
            <span>{emp.department}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
        <span className="text-xs font-bold text-[#00A499] bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full capitalize">
          {emp.role || "employee"}
        </span>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize
          ${isActive
            ? "text-emerald-600 bg-emerald-50 border-emerald-100"
            : "text-gray-400 bg-gray-50 border-gray-200"
          }`}>
          {emp.status || "active"}
        </span>
      </div>
    </div>
  );
};

// ─── Delete Confirm Modal ─────────────────────────────────────────
const DeleteModal = ({ emp, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-gray-200/80 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={20} className="text-red-500" />
      </div>
      <h3 className="text-base font-black text-gray-900 mb-1">Delete Employee</h3>
      <p className="text-sm text-gray-500 font-medium mb-6">
        Are you sure you want to delete{" "}
        <span className="text-gray-900 font-bold">{emp?.name}</span>?{" "}
        This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-red-100"
        >
          {loading ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ─── Employees Page ───────────────────────────────────────────────
export default function Employees() {
  const [employees,    setEmployees]    = useState([]);
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

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "employees"));
      setEmployees(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch {
      showToast("Failed to load employees", "error");
    }
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleSave = async (form, existingUid) => {
    if (existingUid) {
      await updateDoc(doc(db, "employees", existingUid), {
        name:       form.name,
        phone:      form.phone,
        department: form.department,
        role:       form.role,
        updatedAt:  serverTimestamp(),
      });
      setEmployees(prev => prev.map(e =>
        e.uid === existingUid ? { ...e, ...form } : e
      ));
      showToast("Employee updated successfully");
    } else {
      const { user } = await createUserWithEmailAndPassword(
        secondaryAuth, form.email, form.password
      );
      await updateProfile(user, { displayName: form.name });

      const empData = {
        uid:        user.uid,
        name:       form.name,
        email:      form.email,
        phone:      form.phone      || "",
        department: form.department || "",
        role:       form.role       || "employee",
        status:     "active",
        createdAt:  serverTimestamp(),
      };
      await setDoc(doc(db, "employees", user.uid), empData);
      await secondaryAuth.signOut();

      setEmployees(prev => [...prev, { uid: user.uid, ...empData }]);
      showToast("Employee created successfully");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "employees", deleteTarget.uid));
      setEmployees(prev => prev.filter(e => e.uid !== deleteTarget.uid));
      showToast("Employee deleted");
    } catch {
      showToast("Failed to delete employee", "error");
    }
    setDelLoading(false);
    setDeleteTarget(null);
  };

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase())       ||
    e.email?.toLowerCase().includes(search.toLowerCase())      ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:    employees.length,
    active:   employees.filter(e => e.status !== "inactive").length,
    inactive: employees.filter(e => e.status === "inactive").length,
  };

  const statCards = [
    { label: "Total Employees", value: stats.total,    icon: Users,     bg: "bg-blue-50",    border: "border-blue-100",    iconColor: "text-blue-600",    valueColor: "text-gray-900" },
    { label: "Active",          value: stats.active,   icon: UserCheck, bg: "bg-emerald-50", border: "border-emerald-100", iconColor: "text-emerald-600", valueColor: "text-gray-900" },
    { label: "Inactive",        value: stats.inactive, icon: UserX,     bg: "bg-gray-50",    border: "border-gray-200",    iconColor: "text-gray-400",    valueColor: "text-gray-500" },
  ];

  return (
    <Layout title="Employees">

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {statCards.map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div>
              <p className={`text-2xl font-black ${s.valueColor}`}>{s.value}</p>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400
                       focus:border-blue-400 transition-all shadow-sm"
          />
        </div>
        <button
          onClick={() => setModal("add")}
          className="flex items-center gap-2 bg-[#00A499] text-white font-bold
                     px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-blue-200"
        >
          <Plus size={16} />
          Add Employee
        </button>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-44 border border-gray-100 animate-pulse shadow-sm" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-500">
            {employees.length === 0 ? "No employees yet" : "No results found"}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {employees.length === 0
              ? `Click "Add Employee" to get started`
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <EmployeeCard
              key={emp.uid}
              emp={emp}
              onEdit={e => setModal(e)}
              onDelete={e => setDeleteTarget(e)}
            />
          ))}
        </div>
      )}

      {modal && (
        <EmployeeModal
          emp={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          emp={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={delLoading}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}