import { useEffect, useState } from "react";
import {
  collection, query, where,
  getDocs, doc, updateDoc, addDoc,
  arrayUnion, serverTimestamp, orderBy
} from "firebase/firestore";
import { db }          from "../firebase/config";
import useAuthStore    from "../store/authStore";
import Layout          from "../components/Layout";
import {
  ClipboardList, Search, Flag, Calendar,
  ChevronRight, X, Send, Loader2,
  CheckCircle2, Loader, ListTodo,
  MessageSquare, Tag, User, GripVertical,
  Plus
} from "lucide-react";


// ─── Priority Config ──────────────────────────────────────────────
const priorityConfig = {
  high:   { color: "text-red-500",     bg: "bg-red-50",     border: "border-red-200"     },
  medium: { color: "text-amber-500",   bg: "bg-amber-50",   border: "border-amber-200"   },
  low:    { color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200"  },
  urgent: { color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200"      },
};


// ─── Status Columns ───────────────────────────────────────────────
const statusColumns = [
  { key: "to-do",       label: "To Do",       Icon: ListTodo,     bg: "bg-violet-50",  border: "border-violet-200",  accent: "border-violet-400" },
  { key: "in-progress", label: "In Progress", Icon: Loader,       bg: "bg-amber-50",   border: "border-amber-200",   accent: "border-amber-400"  },
  { key: "completed",   label: "Completed",   Icon: CheckCircle2, bg: "bg-emerald-50", border: "border-emerald-200", accent: "border-emerald-400"},
];


// ─── Status normalization ─────────────────────────────────────────
const normalizeStatus = (s) => {
  if (!s || s === "pending")  return "to-do";
  if (s === "in_progress")    return "in-progress";
  if (s === "cancelled")      return "to-do";
  return s;
};

const toFirestoreStatus = (s) => {
  if (s === "to-do")       return "pending";
  if (s === "in-progress") return "in_progress";
  return s;
};


// ─── Safe deadline helpers ────────────────────────────────────────
const getDeadlineDate = (task) => {
  if (!task) return null;
  if (task.dueDate)           return new Date(task.dueDate);
  if (task.deadline?.seconds) return new Date(task.deadline.seconds * 1000);
  if (task.deadline instanceof Date) return task.deadline;
  return null;
};

const fmtDeadline = (task, opts) => {
  const d = getDeadlineDate(task);
  if (!d || isNaN(d)) return "No deadline";
  return d.toLocaleDateString("en-IN", opts || { day: "numeric", month: "short" });
};


// ─── Create Task Modal ────────────────────────────────────────────
const CreateTaskModal = ({ onClose, onCreated, userData, userId }) => {
  const [form, setForm] = useState({
    title:       "",
    description: "",
    priority:    "medium",
    category:    "",
    dueDate:     "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim(),
        priority:    form.priority,
        category:    form.category.trim() || "General",
        dueDate:     form.dueDate || null,
        status:      "pending",           // to-do
        assignedTo:  userId,
        createdBy:   userId,
        createdByName: userData?.name || "Employee",
        notes:       [],
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "tasks"), payload);
      onCreated({ id: ref.id, ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } });
      onClose();
    } catch (err) {
      console.error("Failed to create task:", err);
      setError("Failed to create task. Please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 ">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Plus size={16} className="text-indigo-600" />
            </div>
            <h2 className="text-lg font-black text-gray-900">Create Task</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Task Title <span className="text-red-400">*</span>
            </label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Prepare monthly report"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none
                         focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="What needs to be done?"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none
                         focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white resize-none"
            />
          </div>

          {/* Priority + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none
                           focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g. Design, Dev…"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none
                           focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white"
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              name="dueDate"
              value={form.dueDate}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none
                         focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500
                         hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white
                         text-sm font-semibold hover:opacity-90 transition-all shadow-md disabled:opacity-50
                         flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                : <><Plus size={14} /> Create Task</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─── Task Detail Modal ────────────────────────────────────────────
const TaskModal = ({ task, onClose, onStatusChange, onAddNote, userData }) => {
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updating,   setUpdating]   = useState(false);
  const [localTask,  setLocalTask]  = useState(task);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    await onStatusChange(localTask.id, newStatus);
    setLocalTask(prev => ({ ...prev, status: newStatus }));
    setUpdating(false);
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setSubmitting(true);
    const newNote = await onAddNote(localTask.id, note, userData?.name);
    if (newNote) {
      setLocalTask(prev => ({ ...prev, notes: [...(prev.notes || []), newNote] }));
    }
    setNote("");
    setSubmitting(false);
  };

  const pConfig         = priorityConfig[localTask.priority] || priorityConfig.low;
  const normalizedStatus = normalizeStatus(localTask.status);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-3xl flex items-start justify-between z-10">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${pConfig.bg} ${pConfig.color} ${pConfig.border}`}>
                <Flag size={10} className="inline mr-1" />{localTask.priority || "low"} priority
              </span>
              <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-2.5 py-0.5 rounded-full font-semibold">
                <Tag size={10} className="inline mr-1" />{localTask.category || "General"}
              </span>
            </div>
            <h2 className="text-xl font-black text-gray-900 leading-tight">{localTask.title}</h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Description */}
          {localTask.description && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{localTask.description}</p>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-indigo-400" />
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Deadline</p>
              </div>
              <p className="text-sm font-bold text-gray-800">
                {fmtDeadline(localTask, { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-1">
                <User size={14} className="text-purple-400" />
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Client</p>
              </div>
              <p className="text-sm font-bold text-gray-800 truncate">{localTask.clientName || "—"}</p>
            </div>
          </div>

          {/* Status Update */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Update Status</p>
            <div className="flex gap-2 flex-wrap">
              {["to-do", "in-progress", "completed"].map((s) => (
                <button key={s} onClick={() => handleStatusChange(s)}
                  disabled={normalizedStatus === s || updating}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all border
                    ${normalizedStatus === s
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md"
                      : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-500"
                    } disabled:opacity-50`}>
                  {updating && normalizedStatus !== s
                    ? <Loader2 size={13} className="animate-spin inline mr-1" />
                    : null}
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Notes & Updates</p>
            {localTask.notes?.length > 0 ? (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {localTask.notes.map((n, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-indigo-600">{n.authorName || "You"}</p>
                      <p className="text-xs text-gray-400 font-medium">
                        {n.createdAt
                          ? new Date(n.createdAt.seconds ? n.createdAt.seconds * 1000 : n.createdAt)
                              .toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                          : "Just now"}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-400 text-xs font-medium mb-3 py-3">
                <MessageSquare size={14} /> No notes yet — add the first one below
              </div>
            )}
            <div className="flex gap-2">
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                placeholder="Add a note or update..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white resize-none" />
              <button onClick={handleAddNote} disabled={!note.trim() || submitting}
                className="w-10 h-10 mt-auto rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 shadow-md">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── Draggable Task Card ──────────────────────────────────────────
const TaskCard = ({ task, onClick, onDragStart, onDragEnd, isDragging }) => {
  const pConfig = priorityConfig[task.priority] || priorityConfig.low;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white rounded-xl p-4 border border-gray-100 group
                  transition-all duration-200 select-none
                  ${isDragging
                    ? "opacity-40 scale-95 shadow-none cursor-grabbing"
                    : "cursor-grab hover:shadow-[0_4px_20px_-2px_rgba(79,70,229,0.12)] hover:-translate-y-0.5 hover:border-indigo-100 shadow-sm"
                  }`}
    >
      <div className="flex items-center justify-between mb-2.5 ">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical size={13} className="text-gray-300 flex-shrink-0 group-hover:text-indigo-300 transition-colors" />
          <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 truncate max-w-[140px]">
            {task.category || "General"}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${pConfig.bg} ${pConfig.color} border ${pConfig.border} flex-shrink-0`}>
          <Flag size={9} />
          {task.priority || "low"}
        </div>
      </div>

      <h4 className="text-sm font-bold text-gray-800 mb-1.5 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-gray-500 mb-3 leading-relaxed line-clamp-2">{task.description}</p>
      )}

      {task.clientName && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-600 text-xs font-bold">{task.clientName.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-xs text-gray-500 font-medium truncate">{task.clientName}</span>
        </div>
      )}

      {/* Self-created badge */}
      {task.createdBy === task.assignedTo && !task.clientName && (
        <div className="flex items-center gap-1 mb-3">
          <span className="text-xs text-indigo-400 font-medium bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            Self-created
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
          <Calendar size={11} />
          {fmtDeadline(task)}
        </div>
        <div className="flex items-center gap-2">
          {task.notes?.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
              <MessageSquare size={10} /> {task.notes.length}
            </span>
          )}
          <ChevronRight size={13} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
        </div>
      </div>
    </div>
  );
};


// ─── Droppable Column ─────────────────────────────────────────────
const KanbanColumn = ({ col, tasks, onCardClick, draggingId, onDragStart, onDragEnd, onDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) onDrop(taskId, col.key);
  };

  return (
    <div className="flex flex-col px-2">
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border mb-3 transition-all
        ${isDragOver ? `${col.bg} ${col.accent} border-2` : `${col.bg} ${col.border}`}`}>
        <div className="flex items-center gap-2">
          <col.Icon size={14} className="text-gray-600" />
          <span className="text-sm font-bold text-gray-700">{col.label}</span>
        </div>
        <span className="text-xs font-bold bg-white/70 text-gray-600 px-2 py-0.5 rounded-full border border-current/10">
          {tasks.length}
        </span>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 rounded-xl transition-all duration-150 min-h-[120px]
          ${isDragOver ? `bg-indigo-50/60 border-2 border-dashed ${col.accent} p-2` : "p-0"}`}
      >
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-10 text-xs font-medium gap-2 rounded-xl border border-dashed transition-all
              ${isDragOver
                ? "border-indigo-300 text-indigo-400 bg-indigo-50/80"
                : "border-gray-200 text-gray-400 bg-gray-50/50"
              }`}>
              <col.Icon size={20} className={isDragOver ? "text-indigo-300" : "text-gray-300"} />
              {isDragOver ? `Drop here → ${col.label}` : `No ${col.label.toLowerCase()} tasks`}
            </div>
          ) : (
            <>
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isDragging={draggingId === task.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onClick={() => !draggingId && onCardClick(task)}
                />
              ))}
              {isDragOver && (
                <div className="h-16 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 flex items-center justify-center text-xs text-indigo-400 font-medium">
                  Drop here
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};


// ─── My Tasks Page ────────────────────────────────────────────────
const MyTasks = () => {
  const { user, userData }          = useAuthStore();
  const [tasks,          setTasks]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [selectedTask,   setSelectedTask]   = useState(null);
  const [showCreate,     setShowCreate]     = useState(false);   // ← new
  const [draggingId,     setDraggingId]     = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "tasks"),
          where("assignedTo", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load tasks:", err);
      }
      setLoading(false);
    };
    fetchTasks();
  }, [user?.uid]);

  // ─── Task Created callback ────────────────────────────────────
  const handleTaskCreated = (newTask) => {
    setTasks(prev => [newTask, ...prev]);
  };

  // ─── Drag handlers ────────────────────────────────────────────
  const handleDragStart = (taskId) => setDraggingId(taskId);
  const handleDragEnd   = ()        => setDraggingId(null);

  const handleDrop = async (taskId, newColumnKey) => {
    setDraggingId(null);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentNormalized = normalizeStatus(task.status);
    if (currentNormalized === newColumnKey) return;
    const firestoreStatus = toFirestoreStatus(newColumnKey);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: firestoreStatus } : t));
    try {
      await updateDoc(doc(db, "tasks", taskId), { status: firestoreStatus, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error("Failed to update status:", err);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  const handleStatusChange = async (taskId, newKanbanStatus) => {
    const firestoreStatus = toFirestoreStatus(newKanbanStatus);
    await updateDoc(doc(db, "tasks", taskId), { status: firestoreStatus, updatedAt: serverTimestamp() });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: firestoreStatus } : t));
  };

  const handleAddNote = async (taskId, text, authorName) => {
    const newNote = {
      text,
      authorName: authorName || userData?.name || "Employee",
      authorId:   user.uid,
      createdAt:  { seconds: Math.floor(Date.now() / 1000) },
    };
    await updateDoc(doc(db, "tasks", taskId), { notes: arrayUnion(newNote), updatedAt: serverTimestamp() });
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, notes: [...(t.notes || []), newNote] } : t
    ));
    return newNote;
  };

  const filtered = tasks.filter(t =>
    t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  const getByStatus = (columnKey) =>
    filtered.filter(t => normalizeStatus(t.status) === columnKey);

  const counts = {
    total:      tasks.length,
    todo:       tasks.filter(t => normalizeStatus(t.status) === "to-do").length,
    inProgress: tasks.filter(t => normalizeStatus(t.status) === "in-progress").length,
    completed:  tasks.filter(t => normalizeStatus(t.status) === "completed").length,
  };

  return (
    <Layout title="My Tasks">

      {/* Page header row with Create button */}
      <div className="flex items-center justify-between mb-6 px-5 mt-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 mr-4">
          {[
            { label: "Total Tasks", val: counts.total,      color: "text-indigo-600", bg: "bg-indigo-50",  Icon: ClipboardList },
            { label: "To Do",       val: counts.todo,        color: "text-violet-600", bg: "bg-violet-50",  Icon: ListTodo      },
            { label: "In Progress", val: counts.inProgress,  color: "text-amber-600",  bg: "bg-amber-50",   Icon: Loader        },
            { label: "Completed",   val: counts.completed,   color: "text-emerald-600",bg: "bg-emerald-50", Icon: CheckCircle2  },
          ].map(s => (
            <div key={s.label}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] flex items-center gap-3">
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

        {/* Create Task Button */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1D7872] cursor-pointer text-white
                       rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Task</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5 py-5 px-5"  >
        <Search size={15} className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search tasks, clients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 px-10 text-sm text-gray-800
                     placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-300
                     focus:border-indigo-400 transition-all shadow-sm"
        />
      </div>

      {/* Drag hint */}
      {!loading && tasks.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mb-4 px-1">
          <GripVertical size={13} className="text-gray-300" />
          Drag cards between columns to update status
        </div>
      )}

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              {[...Array(3)].map((__, j) => (
                <div key={j} className="h-32 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {statusColumns.map(col => (
            <KanbanColumn
              key={col.key}
              col={col}
              tasks={getByStatus(col.key)}
              draggingId={draggingId}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onCardClick={task => setSelectedTask(task)}
            />
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <CreateTaskModal
          userId={user.uid}
          userData={userData}
          onClose={() => setShowCreate(false)}
          onCreated={handleTaskCreated}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          userData={userData}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onAddNote={handleAddNote}
        />
      )}
    </Layout>
  );
};

export default MyTasks;