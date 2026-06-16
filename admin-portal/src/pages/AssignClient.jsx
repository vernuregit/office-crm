import { useEffect, useState } from "react";
import {
  collection, getDocs, doc,
  updateDoc, arrayUnion, arrayRemove,
  getDoc
} from "firebase/firestore";
import { db }    from "../firebase/config";
import Layout    from "../components/Layout";
import {
  Users, UserSquare2, Link2, Unlink,
  CheckCircle2, AlertCircle, X,
  Search, ChevronRight, Building2,
  UserCheck, ArrowRight
} from "lucide-react";


// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5
    rounded-2xl shadow-2xl text-white text-sm font-semibold
    ${type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
      <X size={14} />
    </button>
  </div>
);


// ─── Avatar ───────────────────────────────────────────────────────
const Avatar = ({ name, size = "md" }) => {
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} rounded-xl flex items-center justify-center text-white font-black flex-shrink-0 shadow-sm`}
      style={{ backgroundColor: "#1D7872" }}
    >
      {initials}
    </div>
  );
};


// ─── AssignClient Page ────────────────────────────────────────────
export default function AssignClient() {
  const [employees,         setEmployees]         = useState([]);
  const [clients,           setClients]           = useState([]);
  const [selectedEmployee,  setSelectedEmployee]  = useState(null);
  const [assignedClientIds, setAssignedClientIds] = useState([]);
  const [empSearch,         setEmpSearch]         = useState("");
  const [clientSearch,      setClientSearch]      = useState("");
  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(null);
  const [toast,             setToast]             = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Initial data load ──
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [empSnap, clientSnap] = await Promise.all([
          getDocs(collection(db, "employees")),
          getDocs(collection(db, "users")),
        ]);
        setEmployees(empSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
        setClients(clientSnap.docs.map(d => ({ uid: d.id, ...d.data() })));
      } catch {
        showToast("Failed to load data", "error");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // ── Select employee → load their assignedClients array ──
  const handleSelectEmployee = async (emp) => {
    setSelectedEmployee(emp);
    setClientSearch("");
    try {
      const snap = await getDoc(doc(db, "employees", emp.uid));
      setAssignedClientIds(snap.data()?.assignedClients || []);
    } catch {
      setAssignedClientIds([]);
    }
  };

  // ── Toggle assign / unassign ──
  const handleToggleClient = async (client) => {
    if (!selectedEmployee) return;
    setSaving(client.uid);
    const isAssigned = assignedClientIds.includes(client.uid);

    try {
      if (isAssigned) {
        // ── UNASSIGN ──
        await updateDoc(doc(db, "employees", selectedEmployee.uid), {
          assignedClients: arrayRemove(client.uid),
        });
        await updateDoc(doc(db, "users", client.uid), {
          assignedTo: null,
          assignedToName: null,
        });
        setAssignedClientIds(prev => prev.filter(id => id !== client.uid));
        // Update local clients list so the amber badge disappears
        setClients(prev => prev.map(c =>
          c.uid === client.uid
            ? { ...c, assignedTo: null, assignedToName: null }
            : c
        ));
        showToast(`${client.name} unassigned`);
      } else {
        // ── ASSIGN ──
        // If client was previously assigned to another employee, remove from their array
        if (client.assignedTo && client.assignedTo !== selectedEmployee.uid) {
          await updateDoc(doc(db, "employees", client.assignedTo), {
            assignedClients: arrayRemove(client.uid),
          });
        }
        await updateDoc(doc(db, "employees", selectedEmployee.uid), {
          assignedClients: arrayUnion(client.uid),
        });
        await updateDoc(doc(db, "users", client.uid), {
          assignedTo:     selectedEmployee.uid,
          assignedToName: selectedEmployee.name,
        });
        // Reflect new assignment in local state
        setClients(prev => prev.map(c =>
          c.uid === client.uid
            ? { ...c, assignedTo: selectedEmployee.uid, assignedToName: selectedEmployee.name }
            : c
        ));
        // Also update the employee's local assignedClients count so the badge updates
        setEmployees(prev => prev.map(e =>
          e.uid === selectedEmployee.uid
            ? { ...e, assignedClients: [...(e.assignedClients || []), client.uid] }
            : e
        ));
        setAssignedClientIds(prev => [...prev, client.uid]);
        showToast(`${client.name} assigned to ${selectedEmployee.name}`);
      }
    } catch (err) {
      showToast("Assignment failed: " + err.message, "error");
    }
    setSaving(null);
  };

  const filteredEmployees = employees.filter(e =>
    e.name?.toLowerCase().includes(empSearch.toLowerCase()) ||
    e.department?.toLowerCase().includes(empSearch.toLowerCase())
  );

  const filteredClients = clients.filter(c =>
    c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.company?.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <Layout title="Assign Client">

      {/* ── Info Banner ── */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
          style={{ backgroundColor: "#1D7872" }}>
          <Link2 size={15} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">How to Assign</p>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            1. Select an employee on the left &nbsp;→&nbsp;
            2. Click clients on the right to assign or unassign them
          </p>
        </div>
      </div>

      {/* ── Loading Skeletons ── */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-96 border border-gray-100 animate-pulse shadow-sm" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── LEFT: Employee List ── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <Users size={16} style={{ color: "#1D7872" }} />
                Employees
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {employees.length}
                </span>
              </h2>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees…"
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2
                             text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none
                             focus:ring-2 transition-all"
                  style={{ "--tw-ring-color": "#1D7872" }}
                  onFocus={e  => e.target.style.borderColor = "#1D7872"}
                  onBlur={e   => e.target.style.borderColor = ""}
                />
              </div>
            </div>

            {/* Employee Rows */}
            <div className="overflow-y-auto max-h-[480px]">
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={32} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs text-gray-400 font-medium">No employees found</p>
                </div>
              ) : (
                filteredEmployees.map(emp => {
                  const isSelected    = selectedEmployee?.uid === emp.uid;
                  const assignedCount = emp.assignedClients?.length || 0;
                  return (
                    <button
                      key={emp.uid}
                      onClick={() => handleSelectEmployee(emp)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-50
                                  last:border-0 text-left transition-all
                        ${isSelected ? "bg-teal-50" : "hover:bg-gray-50"}`}
                      style={isSelected ? { borderLeft: "3px solid #1D7872" } : {}}
                    >
                      <Avatar name={emp.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate"
                          style={{ color: isSelected ? "#1D7872" : "#1f2937" }}>
                          {emp.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate font-medium">
                          {emp.department || emp.role || "Employee"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {assignedCount > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
                            style={{ backgroundColor: "#1D787215", borderColor: "#1D787230", color: "#1D7872" }}>
                            {assignedCount}
                          </span>
                        )}
                        <ChevronRight size={14}
                          style={{ color: isSelected ? "#1D7872" : "#d1d5db" }} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT: Clients Panel ── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">

            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                <UserSquare2 size={16} style={{ color: "#1D7872" }} />
                Clients
                {selectedEmployee && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full border"
                    style={{ backgroundColor: "#1D787215", borderColor: "#1D787230", color: "#1D7872" }}>
                    for {selectedEmployee.name.split(" ")[0]}
                  </span>
                )}
              </h2>
              {selectedEmployee && (
                <span className="text-xs text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
                  {assignedClientIds.length} assigned
                </span>
              )}
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={e => setClientSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2
                             text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none
                             focus:ring-2 transition-all"
                  onFocus={e => e.target.style.borderColor = "#1D7872"}
                  onBlur={e  => e.target.style.borderColor = ""}
                />
              </div>
            </div>

            {/* No employee selected */}
            {!selectedEmployee ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4 shadow-sm">
                  <ArrowRight size={22} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">Select an employee first</p>
                <p className="text-xs text-gray-400 font-medium mt-1 max-w-[200px]">
                  Choose an employee from the left to manage their clients
                </p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <UserSquare2 size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-xs text-gray-400 font-medium">No clients found</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[480px]">
                {filteredClients.map(client => {
                  const isAssigned      = assignedClientIds.includes(client.uid);
                  const isSaving        = saving === client.uid;
                  const assignedToOther = client.assignedTo && client.assignedTo !== selectedEmployee.uid;

                  return (
                    <div
                      key={client.uid}
                      className={`flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 transition-all
                        ${isAssigned ? "bg-teal-50/60" : "hover:bg-gray-50"}`}
                    >
                      <Avatar name={client.name} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate"
                          style={{ color: isAssigned ? "#1D7872" : "#1f2937" }}>
                          {client.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {client.company && (
                            <span className="flex items-center gap-1 text-xs text-gray-400 truncate font-medium">
                              <Building2 size={10} />
                              {client.company}
                            </span>
                          )}
                          {assignedToOther && (
                            <span className="text-xs text-amber-600 font-semibold flex-shrink-0 bg-amber-50 px-1.5 py-0.5 rounded-md">
                              → {client.assignedToName || "Other employee"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assign / Unassign Button */}
                      <button
                        onClick={() => handleToggleClient(client)}
                        disabled={isSaving}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold
                                    transition-all flex-shrink-0 border
                          ${isSaving
                            ? "opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400"
                            : isAssigned
                            ? "bg-red-50 border-red-100 text-red-500 hover:bg-red-100"
                            : ""
                          }`}
                        style={!isSaving && !isAssigned ? {
                          backgroundColor: "#1D787212",
                          borderColor:     "#1D787230",
                          color:           "#1D7872",
                        } : {}}
                        onMouseEnter={e => { if (!isSaving && !isAssigned) e.currentTarget.style.backgroundColor = "#1D787225"; }}
                        onMouseLeave={e => { if (!isSaving && !isAssigned) e.currentTarget.style.backgroundColor = "#1D787212"; }}
                      >
                        {isSaving ? (
                          <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                            <path d="M4 12a8 8 0 018-8v8H4z" fill="currentColor" className="opacity-75" />
                          </svg>
                        ) : isAssigned ? (
                          <><Unlink size={12} /> Unassign</>
                        ) : (
                          <><Link2 size={12} /> Assign</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Summary Strip ── */}
      {selectedEmployee && assignedClientIds.length > 0 && (
        <div className="mt-5 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <UserCheck size={14} className="text-emerald-500" />
            {selectedEmployee.name}'s Assigned Clients
            <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full normal-case font-bold">
              {assignedClientIds.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {assignedClientIds.map(cid => {
              const c = clients.find(cl => cl.uid === cid);
              if (!c) return null;
              return (
                <div
                  key={cid}
                  className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm"
                >
                  <Avatar name={c.name} size="sm" />
                  <span className="text-xs font-semibold text-gray-700">{c.name}</span>
                  <button
                    onClick={() => handleToggleClient(c)}
                    className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                    aria-label={`Remove ${c.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}