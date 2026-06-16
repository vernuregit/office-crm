import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";
import Layout from "../components/Layout";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList, Receipt, FolderOpen, TicketCheck,
  CreditCard, Upload, Bot, Headphones,
  ChevronRight, Pin, Sun, Sunset, Moon
} from "lucide-react";

// ─── Stat Card ────────────────────────────────────────────────────
const StatCard = ({ Icon, label, value, sub, gradient, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white rounded-2xl p-5 border border-gray-100 cursor-pointer group
               shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]
               hover:shadow-[0_8px_30px_-4px_rgba(79,70,229,0.15)]
               hover:-translate-y-0.5 transition-all duration-200"
  >
    {/* <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
      <Icon size={22} className="text-white" />
    </div> */}
    <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
    <p className="text-sm font-semibold text-gray-600 mt-0.5">{label}</p>
    <p className="text-xs text-gray-400 mt-1 font-medium">{sub}</p>
  </div>
);

// ─── Quick Action ─────────────────────────────────────────────────
const QuickAction = ({ Icon, label, description, gradient, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white
               cursor-pointer
               shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]
               hover:shadow-[0_8px_30px_-4px_rgba(79,70,229,0.10)]
               hover:-translate-y-0.5 transition-all duration-200 text-left w-full"
  >
    {/* <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
      <Icon size={20} className="text-white" />
    </div> */}
    <div >
      <p className="text-sm font-bold text-gray-800">{label}</p>
      <p className="text-xs text-gray-400 font-medium mt-0.5">{description}</p>
    </div>
    <ChevronRight size={16} className="ml-auto text-gray-300" />
  </button>
);

// ─── Task Status Style ────────────────────────────────────────────
const taskStatusStyle = (status) => {
  if (status === "completed")   return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "in-progress") return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-violet-50 text-violet-700 border border-violet-200";
};

// ─── Greeting ─────────────────────────────────────────────────────
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning",   Icon: Sun    };
  if (h < 17) return { text: "Good afternoon", Icon: Sunset };
  return       { text: "Good evening",         Icon: Moon   };
};

// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = () => {
  const { user, userData } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeServices: 0, pendingInvoices: 0,
    pendingAmount: 0, openTickets: 0, totalDocuments: 0,
  });
  const [recentTasks,    setRecentTasks]    = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const invSnap    = await getDocs(query(collection(db, "invoices"),  where("clientId", "==", user.uid)));
        const taskSnap   = await getDocs(query(collection(db, "tasks"),     where("clientId", "==", user.uid)));
        const ticketSnap = await getDocs(query(collection(db, "tickets"),   where("clientId", "==", user.uid), where("status", "==", "open")));
        const docSnap    = await getDocs(query(collection(db, "documents"), where("clientId", "==", user.uid)));

        const allInvoices    = invSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const allTasks       = taskSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const unpaidInvoices = allInvoices.filter((i) => i.status === "unpaid" || i.status === "overdue");
        const pendingAmount  = unpaidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

        setStats({
          activeServices:  allTasks.filter((t) => t.status !== "completed").length,
          pendingInvoices: unpaidInvoices.length,
          pendingAmount,
          openTickets:     ticketSnap.size,
          totalDocuments:  docSnap.size,
        });
        setRecentTasks(allTasks.slice(0, 4));
        setRecentInvoices(allInvoices.slice(0, 3));
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchStats();
  }, [user]);

  const { text: greetText, Icon: GreetIcon } = getGreeting();

  return (
    <Layout title="Dashboard">

      {/* ── Welcome Hero ──────────────────────────────────────── */}
      <div className="relative bg-[#1D7872] rounded-3xl p-7 mb-6 text-white overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-14 right-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-4 right-32 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-white  text-sm font-semibold mb-1 flex items-center gap-1.5">
              <GreetIcon size={15} />
              {greetText}
            </p>
            <h2 className="text-3xl font-black tracking-tight">
              {userData?.name?.split(" ")[0] || "Client"}
            </h2>
            <p className="text-white text-sm mt-2 max-w-sm font-medium">
              Here's a snapshot of your account with us today.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => navigate("/invoices")}
                className="bg-white text-[#1D7872] text-sm font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Receipt size={14} /> View Invoices
              </button>
              <button
                onClick={() => navigate("/chatbot")}
                className="bg-white/20 text-white cursor-pointer text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/30 transition-colors border border-white/20 flex items-center gap-1.5"
              >
                <Bot size={14} /> Ask AI
              </button>
            </div>
          </div>

          <div className="hidden md:flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-3xl bg-white/20 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm shadow-xl">
              <span className="text-4xl font-black text-white">
                {userData?.name?.charAt(0).toUpperCase() || "C"}
              </span>
            </div>
            <span className="text-xs text-white font-medium">Client Account</span>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-36 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard Icon={ClipboardList} label="Active Services"  value={stats.activeServices}  sub="Currently running"   gradient="from-indigo-400 to-indigo-600" onClick={() => navigate("/service-status")} />
          <StatCard Icon={Receipt}       label="Pending Invoices" value={stats.pendingInvoices} sub={`₹${stats.pendingAmount.toLocaleString("en-IN")} due`} gradient="from-rose-400 to-pink-600"    onClick={() => navigate("/invoices")}       />
          <StatCard Icon={FolderOpen}    label="Documents"        value={stats.totalDocuments}  sub="Total files stored"  gradient="from-violet-400 to-purple-600" onClick={() => navigate("/documents")}       />
          <StatCard Icon={TicketCheck}   label="Open Tickets"     value={stats.openTickets}     sub="Awaiting response"   gradient="from-amber-400 to-orange-500"  onClick={() => navigate("/support")}         />
        </div>
      )}

      {/* ── Main Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Recent Tasks */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-black text-gray-900 text-base tracking-tight">Service Updates</h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Latest task activity on your account</p>
            </div>
            <button
              onClick={() => navigate("/service-status")}
              className="text-[#1D7872] text-sm font-bold cursor-pointer transition-colors flex items-center gap-1"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ClipboardList size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No service tasks yet</p>
              <p className="text-xs mt-1">Your CA team will update tasks here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3.5 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Pin size={15} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                        {task.title}
                      </p>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Due:{" "}
                        {task.deadline
                          ? new Date(task.deadline.seconds * 1000).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })
                          : "No deadline set"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${taskStatusStyle(task.status)}`}>
                    {task.status || "to-do"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
        <div className="flex items-c~enter justify-between mb-5">
            <div>
              <h3 className="font-black text-gray-900 text-base tracking-tight">Recent Invoices</h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Latest billing</p>
            </div>
            <button
              onClick={() => navigate("/invoices")}
              className="text-[#1D7872] text-sm font-bold cursor-pointer   transition-colors flex items-center gap-1"
            >
              All <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Receipt size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No invoices yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => navigate("/invoices")}
                  className="p-3.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-gray-800">
                      #{inv.invoiceNumber || inv.id.slice(0, 6).toUpperCase()}
                    </p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize
                      ${inv.status === "paid"    ? "bg-emerald-50 text-emerald-700"
                      : inv.status === "overdue" ? "bg-orange-50 text-orange-600"
                      :                            "bg-red-50 text-red-600"}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-medium truncate">{inv.description || "Service Invoice"}</p>
                  <p className="text-sm font-black text-indigo-600 mt-1">
                    ₹{(inv.amount || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)]">
        <div className="mb-5">
          <h3 className="font-black text-gray-900 text-base tracking-tight">Quick Actions</h3>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Common tasks at your fingertips</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction Icon={CreditCard} label="Pay Invoice"      description="Clear pending dues"    gradient="from-rose-400 to-pink-500"     onClick={() => navigate("/invoices")}  />
          <QuickAction Icon={Upload}     label="Upload Document"  description="Share files with CA"   gradient="from-violet-400 to-purple-600" onClick={() => navigate("/documents")} />
          <QuickAction Icon={Bot}        label="Ask AI Assistant" description="Tax & GST queries"     gradient="from-indigo-400 to-indigo-600" onClick={() => navigate("/chatbot")}   />
          <QuickAction Icon={Headphones} label="Raise a Ticket"   description="Get help from CA team" gradient="from-amber-400 to-orange-500"  onClick={() => navigate("/support")}   />
        </div>
      </div>

    </Layout>
  );
};

export default Dashboard;
