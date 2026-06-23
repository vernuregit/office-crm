import { useEffect, useState } from "react";
import {
  collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, serverTimestamp, query, orderBy
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import Layout       from "../components/Layout";
import {
  Plus, Search, Pencil, Trash2, X,
  ClipboardList, UserCheck, UserSquare2,
  Calendar, Flag, CheckCircle2, AlertCircle,
  Clock, Circle, ChevronDown, Filter, UserCog
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────
const STATUSES = [
  { value: "pending",     label: "Pending",     color: "text-gray-500",  bg: "bg-gray-100  border-gray-200"  },
  { value: "in_progress", label: "In Progress", color: "text-amber-600", bg: "bg-amber-50  border-amber-200" },
  { value: "completed",   label: "Completed",   color: "text-[#0F6E56]", bg: "bg-[#E1F5EE] border-[#5DCAA5]" },
  { value: "cancelled",   label: "Cancelled",   color: "text-red-500",   bg: "bg-red-50    border-red-200"   },
];

const PRIORITIES = [
  { value: "low",    label: "Low",    color: "text-[#0F6E56]", bg: "bg-[#E1F5EE] border-[#5DCAA5]" },
  { value: "medium", label: "Medium", color: "text-[#1D7872]", bg: "bg-[#E6F1FB] border-[#85B7EB]" },
  { value: "high",   label: "High",   color: "text-amber-700", bg: "bg-amber-50  border-amber-200" },
  { value: "urgent", label: "Urgent", color: "text-red-600",   bg: "bg-red-50    border-red-200"   },
];

const statusMeta   = (v) => STATUSES.find(s  => s.value === v) || STATUSES[0];
const priorityMeta = (v) => PRIORITIES.find(p => p.value === v) || PRIORITIES[0];

// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
    ${type === "success" ? "bg-[#1D7872]" : "bg-red-500"} text-white text-sm font-semibold`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100 cursor-pointer">
      <X size={14} />
    </button>
  </div>
);

// ─── Shared field styles ──────────────────────────────────────────
const inputCls =
  `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
   placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1D7872]/30
   focus:border-[#1D7872] transition-all`;

const selectCls =
  `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
   focus:outline-none focus:ring-2 focus:ring-[#1D7872]/30 focus:border-[#1D7872]
   appearance-none transition-all cursor-pointer`;

// ─── Task Form Modal ──────────────────────────────────────────────
const TaskModal = ({ task, employees, clients, onClose, onSave }) => {
  const isEdit = !!task?.id;
  const [form, setForm] = useState({
    title:          task?.title          || "",
    description:    task?.description    || "",
    assignedTo:     task?.assignedTo     || "",
    assignedToName: task?.assignedToName || "",
    clientId:       task?.clientId       || "",
    clientName:     task?.clientName     || "",
    priority:       task?.priority       || "medium",
    status:         task?.status         || "pending",
    dueDate:        task?.dueDate        || "",
    createdBy:      task?.createdBy      || "",
    createdByName:  task?.createdByName  || "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleEmpChange = (uid) => {
    const emp = employees.find(e => e.uid === uid);
    set("assignedTo",     uid);
    set("assignedToName", emp?.name || "");
  };

  const handleClientChange = (uid) => {
    const cl = clients.find(c => c.uid === uid);
    set("clientId",   uid);
    set("clientName", cl?.name || "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    try {
      await onSave(form, isEdit ? task.id : null);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-100 rounded-2xl w-full max-w-lg shadow-2xl shadow-gray-200/80 max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E6F1FB] border border-[#85B7EB]/40 flex items-center justify-center">
              <ClipboardList size={16} className="text-[#1D7872]" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">
              {isEdit ? "Edit Task" : "Create New Task"}
            </h2>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-all cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Task Title *
            </label>
            <input type="text" value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="What needs to be done?" required
              className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Add details about this task…" rows={3}
              className={`${inputCls} resize-none`} />
          </div>

          {/* Assign Employee */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              <UserCheck size={12} className="inline mr-1" />Assign To Employee
            </label>
            <div className="relative">
              <select value={form.assignedTo} onChange={e => handleEmpChange(e.target.value)}
                className={selectCls}>
                <option value="">— Select employee —</option>
                {employees.map(e => (
                  <option key={e.uid} value={e.uid}>
                    {e.name}{e.department ? ` (${e.department})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Linked Client */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              <UserSquare2 size={12} className="inline mr-1" />Linked Client
            </label>
            <div className="relative">
              <select value={form.clientId} onChange={e => handleClientChange(e.target.value)}
                className={selectCls}>
                <option value="">— Select client (optional) —</option>
                {clients.map(c => (
                  <option key={c.uid} value={c.uid}>
                    {c.name}{c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                <Flag size={12} className="inline mr-1" />Priority
              </label>
              <div className="relative">
                <select value={form.priority} onChange={e => set("priority", e.target.value)}
                  className={selectCls}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <div className="relative">
                <select value={form.status} onChange={e => set("status", e.target.value)}
                  className={selectCls}>
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              <Calendar size={12} className="inline mr-1" />Due Date
            </label>
            <input type="date" value={form.dueDate}
              onChange={e => set("dueDate", e.target.value)}
              className={inputCls} />
          </div>

          {/* ── Created By — read-only on edit ── */}
          {isEdit && form.createdByName && (
            <div className="bg-[#E6F1FB] border border-[#85B7EB]/40 rounded-xl px-4 py-3 flex items-center gap-2">
              <UserCog size={14} className="text-[#1D7872] flex-shrink-0" />
              <span className="text-xs text-[#1D7872] font-medium">Task created by</span>
              <span className="text-xs text-[#0F4F6B] font-bold">{form.createdByName}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-[#1D7872] hover:bg-[#155e5a] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm border border-white/10 shadow-md shadow-[#1D7872]/20 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 cursor-pointer">
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────
const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const sm = statusMeta(task.status);
  const pm = priorityMeta(task.priority);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "completed";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5
                    hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-100/80 hover:border-gray-200
                    transition-all duration-300 ease-out shadow-sm">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug
            ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => onEdit(task)}
            className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 hover:bg-[#E6F1FB] hover:border-[#85B7EB]/40 flex items-center justify-center text-gray-400 hover:text-[#1D7872] transition-all duration-200 cursor-pointer"
            aria-label="Edit task">
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(task)}
            className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 hover:bg-red-50 hover:border-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all duration-200 cursor-pointer"
            aria-label="Delete task">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pm.bg} ${pm.color}`}>
          <Flag size={10} className="inline mr-1" />{pm.label}
        </span>
        {task.assignedToName && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-[#85B7EB]/40 bg-[#E6F1FB] text-[#1D7872]">
            <UserCheck size={10} className="inline mr-1" />{task.assignedToName}
          </span>
        )}
        {task.clientName && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-[#AFA9EC] bg-[#EEEDFE] text-[#3C3489]">
            <UserSquare2 size={10} className="inline mr-1" />{task.clientName}
          </span>
        )}
        {task.dueDate && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border
            ${isOverdue ? "border-red-100 bg-red-50 text-red-500" : "border-gray-200 bg-gray-50 text-gray-500"}`}>
            <Calendar size={10} className="inline mr-1" />
            {new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            {isOverdue && " · Overdue"}
          </span>
        )}
      </div>

      {/* ── Created By — always shown when present ── */}
      {task.createdByName && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#F0FAF7] border border-[#B6E4D7] rounded-lg mb-3">
          <UserCog size={11} className="text-[#1D7872] flex-shrink-0" />
          <span className="text-xs text-[#1D7872] font-medium">Created by</span>
          <span className="text-xs font-bold text-[#0F4F3A]">{task.createdByName}</span>
        </div>
      )}

      {/* Status selector */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
        <span className="text-xs text-gray-400 font-medium flex-shrink-0">Status:</span>
        <div className="relative flex-1">
          <select
            value={task.status}
            onChange={e => onStatusChange(task.id, e.target.value)}
            className={`w-full text-xs font-semibold px-2.5 py-1 rounded-lg border appearance-none cursor-pointer
                        bg-transparent focus:outline-none pr-6 ${sm.bg} ${sm.color}`}>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value} className="bg-white text-gray-800">{s.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${sm.color}`} />
        </div>
      </div>
    </div>
  );
};

// ─── Delete Confirm ───────────────────────────────────────────────
const DeleteModal = ({ task, onConfirm, onClose, loading }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
    <div className="bg-white border border-gray-100 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-gray-200/80 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
        <Trash2 size={20} className="text-red-500" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">Delete Task</h3>
      <p className="text-sm text-gray-500 font-medium mb-6 line-clamp-2">
        Delete <span className="text-gray-900 font-bold">"{task?.title}"</span>? This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 cursor-pointer">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm shadow-sm shadow-red-200 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 cursor-pointer">
          {loading ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ─── Tasks Page ───────────────────────────────────────────────────
export default function Tasks() {
  const [tasks,          setTasks]          = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [clients,        setClients]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [modal,          setModal]          = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [delLoading,     setDelLoading]     = useState(false);
  const [toast,          setToast]          = useState(null);

  // ── Store the full auth user object (not just the name) ──────────
  // We resolve the real name at save-time from the employees list,
  // which is guaranteed to be loaded by then. No race condition.
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        let taskDocs = [];
        try {
          const taskSnap = await getDocs(
            query(collection(db, "tasks"), orderBy("createdAt", "desc"))
          );
          taskDocs = taskSnap.docs;
        } catch (indexErr) {
          console.error("⚠️ Firestore index missing for tasks.\n", indexErr);
          const fallbackSnap = await getDocs(collection(db, "tasks"));
          taskDocs = fallbackSnap.docs;
        }

        const [empSnap, clientSnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "users")),
        ]);

        setTasks(taskDocs.map(d => ({ id: d.id, ...d.data() })));
        setEmployees(empSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
        setClients(clientSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load data:", err);
        showToast("Failed to load tasks", "error");
      }
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── KEY FIX: resolve admin name at save-time from already-loaded employees ──
  // ── Resolves the admin's real name + role label ──────────────────
const resolveAdminName = () => {
  if (!currentUser) return "Admin";

  let name = "";

  // 1. Match UID in the already-loaded employees list
  const matchInEmployees = employees.find(e => e.uid === currentUser.uid);
  if (matchInEmployees?.name) {
    name = matchInEmployees.name;
  } else if (currentUser.displayName) {
    name = currentUser.displayName;
  } else if (currentUser.email) {
    name = currentUser.email.split("@")[0];
  } else {
    name = "Admin";
  }

  // Append "(Admin)" so the card shows e.g. "Arunachalam B (Admin)"
  return `${name} (Admin)`;
};

  const handleSave = async (form, existingId) => {
    const payload = {
      title:          form.title.trim(),
      description:    form.description.trim(),
      assignedTo:     form.assignedTo     || null,
      assignedToName: form.assignedToName || null,
      clientId:       form.clientId       || null,
      clientName:     form.clientName     || null,
      priority:       form.priority,
      status:         form.status,
      dueDate:        form.dueDate        || null,
      updatedAt:      serverTimestamp(),
    };

    if (existingId) {
      // Edit — never overwrite createdBy/createdByName
      await updateDoc(doc(db, "tasks", existingId), payload);
      setTasks(prev => prev.map(t => t.id === existingId ? { ...t, ...payload } : t));
      showToast("Task updated");
    } else {
      // ── Resolve name synchronously from already-loaded data ──
      const createdByName = resolveAdminName();

      const newPayload = {
        ...payload,
        createdBy:     currentUser?.uid || null,
        createdByName: createdByName,       // ← always the correct real name
        createdAt:     serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "tasks"), newPayload);
      setTasks(prev => [{ id: ref.id, ...newPayload }, ...prev]);
      showToast("Task created");
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: newStatus, updatedAt: serverTimestamp() });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error("Status update failed:", err);
      showToast("Failed to update status", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDelLoading(true);
    try {
      await deleteDoc(doc(db, "tasks", deleteTarget.id));
      setTasks(prev => prev.filter(t => t.id !== deleteTarget.id));
      showToast("Task deleted");
    } catch {
      showToast("Failed to delete", "error");
    }
    setDelLoading(false);
    setDeleteTarget(null);
  };

  const filtered = tasks.filter(t => {
    const matchSearch =
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.assignedToName?.toLowerCase().includes(search.toLowerCase()) ||
      t.clientName?.toLowerCase().includes(search.toLowerCase()) ||
      t.createdByName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus   = filterStatus   === "all" || t.status   === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const counts = {
    total:      tasks.length,
    pending:    tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed:  tasks.filter(t => t.status === "completed").length,
    overdue:    tasks.filter(t =>
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed"
    ).length,
  };

  const statCards = [
    { label: "Total",       val: counts.total,      icon: ClipboardList, bg: "bg-[#E6F1FB]", border: "border-[#85B7EB]/40", iconColor: "text-[#1D7872]", valColor: "text-[#1D7872]" },
    { label: "Pending",     val: counts.pending,    icon: Circle,        bg: "bg-gray-50",   border: "border-gray-200",     iconColor: "text-gray-400",  valColor: "text-gray-700"  },
    { label: "In Progress", val: counts.inProgress, icon: Clock,         bg: "bg-amber-50",  border: "border-amber-200",    iconColor: "text-amber-500", valColor: "text-amber-700" },
    { label: "Completed",   val: counts.completed,  icon: CheckCircle2,  bg: "bg-[#E1F5EE]", border: "border-[#5DCAA5]/50", iconColor: "text-[#0F6E56]", valColor: "text-[#0F6E56]" },
  ];

  return (
    <Layout title="Tasks">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {statCards.map(s => (
          <div key={s.label}
            className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:shadow-gray-100 transition-all duration-300 ease-out">
            <div className={`w-10 h-10 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${s.valColor}`}>{s.val}</p>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Overdue alert ── */}
      {counts.overdue > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-3.5 mb-5 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-semibold">
            {counts.overdue} task{counts.overdue > 1 ? "s are" : " is"} overdue
          </p>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">

        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search tasks, creator…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20
                       focus:border-[#1D7872] transition-all shadow-sm" />
        </div>

        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl pl-8 pr-8 py-2.5 text-xs text-gray-700
                       font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20
                       focus:border-[#1D7872] appearance-none transition-all shadow-sm cursor-pointer hover:border-gray-300">
            <option value="all">All Status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <Flag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl pl-8 pr-8 py-2.5 text-xs text-gray-700
                       font-semibold focus:outline-none focus:ring-2 focus:ring-[#1D7872]/20
                       focus:border-[#1D7872] appearance-none transition-all shadow-sm cursor-pointer hover:border-gray-300">
            <option value="all">All Priority</option>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        <button onClick={() => setModal("add")}
          className="flex items-center gap-2 bg-[#1D7872] text-white font-bold px-4 py-2.5 rounded-xl text-sm
                     ml-auto cursor-pointer border border-white/10 shadow-md shadow-[#1D7872]/20
                     transition-all duration-300 ease-out hover:-translate-y-1
                     hover:shadow-lg active:translate-y-0 active:shadow-sm">
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* ── Task Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-48 border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F1FB] border border-[#85B7EB]/40 flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={24} className="text-[#1D7872]" />
          </div>
          <p className="text-sm font-bold text-gray-600">
            {tasks.length === 0 ? "No tasks yet" : "No matching tasks"}
          </p>
          <p className="text-xs text-gray-400 font-medium mt-1">
            {tasks.length === 0 ? `Click "New Task" to get started` : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task}
              onEdit={t   => setModal(t)}
              onDelete={t => setDeleteTarget(t)}
              onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      {modal && (
        <TaskModal
          task={modal === "add" ? null : modal}
          employees={employees}
          clients={clients}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          task={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          loading={delLoading}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}