import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  getDoc, doc
} from "firebase/firestore";
import { db }       from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout       from "../components/Layout";
import {
  Users, Search, Phone, Mail,
  Building2, ClipboardList, ChevronRight,
  X, MapPin, Calendar, Briefcase
} from "lucide-react";


// ─── Client Detail Modal ──────────────────────────────────────────
const ClientModal = ({ client, taskCount, onClose }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">

      {/* Header */}
      <div className="bg-[#00A499] rounded-t-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="flex items-start justify-between relative">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-white">
                {client.name?.charAt(0).toUpperCase() || "C"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">{client.name}</h2>
              <p className="text-white text-sm font-medium mt-0.5">
                {client.businessName || "Individual Client"}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span className="text-xs text-white font-medium">Active Client</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">

        {/* Contact Info */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Contact Information
          </p>
          <div className="space-y-2.5">
            {[
              { Icon: Mail,  label: "Email",  value: client.email },
              { Icon: Phone, label: "Phone",  value: client.phone },
              { Icon: MapPin,label: "City",   value: client.city  },
            ].map(({ Icon, label, value }) => value ? (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-[#00A499]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                </div>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Business Info */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            Business Information
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Briefcase,    label: "Business Type", value: client.businessType },
              { Icon: Building2,    label: "GSTIN",         value: client.gstin        },
              { Icon: Calendar,     label: "Client Since",  value: client.createdAt
                  ? new Date(client.createdAt.seconds * 1000).toLocaleDateString("en-IN", {
                      month: "short", year: "numeric",
                    })
                  : "—"
              },
              { Icon: ClipboardList, label: "Active Tasks", value: taskCount },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} className="text-[#00A499]" />
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                </div>
                <p className="text-sm font-bold text-gray-800">{value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6">
        <p className="text-xs text-center text-gray-400 font-medium bg-amber-50 border border-amber-100 rounded-xl py-2.5 px-4">
          Read-only view — contact admin to make changes
        </p>
      </div>
    </div>
  </div>
);


// ─── Client Card ──────────────────────────────────────────────────
const ClientCard = ({ client, taskCount, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-2xl p-5 border border-gray-100 cursor-pointer group
               shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]
               hover:shadow-[0_8px_30px_-4px_rgba(79,70,229,0.15)]
               hover:-translate-y-0.5 hover:border-indigo-100
               transition-all duration-200"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#00A499] flex items-center justify-center shadow-md flex-shrink-0">
          <span className="text-white font-black text-lg">
            {client.name?.charAt(0).toUpperCase() || "C"}
          </span>
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm transition-colors">
            {client.name}
          </h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5 truncate max-w-[140px]">
            {client.businessName || "Individual"}
          </p>
        </div>
      </div>
      <ChevronRight size={16} className="text-gray-300 transition-colors mt-1" />
    </div>

    <div className="space-y-2">
      {client.email && (
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <Mail size={12} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{client.email}</span>
        </div>
      )}
      {client.phone && (
        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <Phone size={12} className="text-gray-400 flex-shrink-0" />
          <span>{client.phone}</span>
        </div>
      )}
    </div>

    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
        <ClipboardList size={12} className="text-[#00A499]" />
        <span>{taskCount} active task{taskCount !== 1 ? "s" : ""}</span>
      </div>
      <span className="w-2 h-2 bg-emerald-400 rounded-full" title="Active" />
    </div>
  </div>
);


// ─── Clients Page ─────────────────────────────────────────────────
const Clients = () => {
  const { user }                             = useAuthStore();
  const [clients,        setClients]         = useState([]);
  const [taskCounts,     setTaskCounts]      = useState({});
  const [loading,        setLoading]         = useState(true);
  const [search,         setSearch]          = useState("");
  const [selectedClient, setSelectedClient]  = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchClients = async () => {
      setLoading(true);
      try {
        // ── 1. Read assignedClients array directly from employee doc ──
        const empSnap     = await getDoc(doc(db, "employees", user.uid));
        const assignedIds = empSnap.data()?.assignedClients || [];

        // ── 2. Count active tasks per client (unchanged) ──
        const taskQ    = query(collection(db, "tasks"), where("assignedTo", "==", user.uid));
        const taskSnap = await getDocs(taskQ);
        const tasks    = taskSnap.docs.map((d) => d.data());

        const counts = {};
        tasks.forEach((t) => {
          if (t.clientId && t.status !== "completed") {
            counts[t.clientId] = (counts[t.clientId] || 0) + 1;
          }
        });
        setTaskCounts(counts);

        // ── 3. Fetch client docs for each assigned ID ──
        if (assignedIds.length > 0) {
          const clientDocs = await Promise.all(
            assignedIds.map((id) =>
              getDocs(query(collection(db, "users"), where("__name__", "==", id)))
            )
          );
          const clientData = clientDocs
            .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
            .filter(Boolean);
          setClients(clientData);
        } else {
          setClients([]);
        }
      } catch (err) {
        console.error("Failed to fetch clients:", err);
      }
      setLoading(false);
    };

    fetchClients();
  }, [user]);

  const filtered = clients.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.businessName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Clients">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500 font-medium">
            {clients.length} client{clients.length !== 1 ? "s" : ""} assigned to you
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#00A499] focus:border-[#00A499]
                       transition-all bg-white"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-40 border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-base font-bold text-gray-500">No clients found</p>
          <p className="text-sm mt-1 font-medium">
            {clients.length === 0
              ? "Clients will appear here once the admin assigns them to you"
              : "No clients match your search"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              taskCount={taskCounts[client.id] || 0}
              onClick={() => setSelectedClient(client)}
            />
          ))}
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <ClientModal
          client={selectedClient}
          taskCount={taskCounts[selectedClient.id] || 0}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </Layout>
  );
};

export default Clients;