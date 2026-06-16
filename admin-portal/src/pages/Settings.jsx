import { useState }                          from "react";
import {
  updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential
} from "firebase/auth";
import { doc, setDoc, getDoc }               from "firebase/firestore";
import { auth, db }                          from "../firebase/config";
import { useAuth }                           from "../context/AuthContext";
import Layout                                from "../components/Layout";
import {
  User, Lock, Building2, Save,
  CheckCircle2, AlertCircle, X,
  Eye, EyeOff, ShieldAlert, LogOut
} from "lucide-react";
import { signOut }                           from "firebase/auth";
import { useNavigate }                       from "react-router-dom";

// ─── Toast ────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
    ${type === "success" ? "bg-emerald-500" : "bg-red-500"} text-white text-sm font-semibold`}>
    {type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
    {msg}
    <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
  </div>
);

// ─── Section Card ─────────────────────────────────────────────────
const Section = ({ icon, title, iconBg = "bg-gray-50", iconBorder = "border-gray-200", iconColor = "text-gray-500", children }) => (
  <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
      <div className={`w-8 h-8 rounded-lg ${iconBg} ${iconBorder} border flex items-center justify-center flex-shrink-0`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <h2 className="text-sm font-black text-gray-800">{title}</h2>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ─── Field + Input helpers ────────────────────────────────────────
const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
      {label}
    </label>
    {children}
  </div>
);

const Input = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800
      placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1D7872] focus:border-[#1D7872]
      transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
  />
);

// ─── Settings Page ────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Profile ──
  const [displayName,   setDisplayName]   = useState(user?.displayName || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Password ──
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [pwdSaving,  setPwdSaving]  = useState(false);

  // ── Company Info ──
  const [company, setCompany] = useState({
    name: "", address: "", gst: "", phone: "", email: "", website: "",
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [companyLoaded, setCompanyLoaded] = useState(false);

  // Load company info once
  useState(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (snap.exists() && snap.data().company) {
          setCompany(prev => ({ ...prev, ...snap.data().company }));
        }
      } catch {}
      setCompanyLoaded(true);
    };
    if (user?.uid) load();
  });

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Save Profile ──
  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return showToast("Name cannot be empty", "error");
    setProfileSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      showToast("Profile updated successfully");
    } catch (err) {
      showToast(err.message || "Failed to update profile", "error");
    }
    setProfileSaving(false);
  };

  // ── Change Password ──
  const handlePasswordSave = async (e) => {
    e.preventDefault();
    if (newPwd.length < 6)     return showToast("Password must be at least 6 characters", "error");
    if (newPwd !== confirmPwd) return showToast("Passwords do not match", "error");
    setPwdSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPwd);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      showToast("Password changed successfully");
    } catch (err) {
      showToast(
        err.code === "auth/wrong-password"
          ? "Current password is incorrect"
          : err.message || "Failed to change password",
        "error"
      );
    }
    setPwdSaving(false);
  };

  // ── Save Company ──
  const handleCompanySave = async (e) => {
    e.preventDefault();
    setCompanySaving(true);
    try {
      await setDoc(doc(db, "admins", user.uid), { company }, { merge: true });
      showToast("Company info saved");
    } catch (err) {
      showToast(err.message || "Failed to save company info", "error");
    }
    setCompanySaving(false);
  };

  // ── Sign Out ──
  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // ── Save button shared style ──
  const saveBtn = (loading, label, loadingLabel, icon) => (
    <button type="submit" disabled={loading}
      className="flex items-center gap-2 bg-[#1D7872] disabled:opacity-50
                 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-blue-100">
      {icon}
      {loading ? loadingLabel : label}
    </button>
  );

  return (
    <Layout title="Settings">
      <div className="max-w-2xl space-y-5">

        {/* ── Admin Info Banner ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl bg-[#1D7872] flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-sm shadow-blue-100">
            {(user?.displayName || user?.email || "A")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-gray-900 truncate">
              {user?.displayName || "Admin"}
            </p>
            <p className="text-xs text-gray-400 font-medium truncate">{user?.email}</p>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full mt-1 inline-block">
              Administrator
            </span>
          </div>
          {/* Quick sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500
                       bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-100
                       px-3 py-2 rounded-xl transition-all flex-shrink-0"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>

        {/* ── Profile Section ── */}
        <Section
          icon={<User size={15} />}
          title="Profile"
          iconBg="bg-[#1D7872]" iconBorder="border-[#1D7872]" iconColor="text-white"
        >
          <form onSubmit={handleProfileSave} className="space-y-4">
            <Field label="Display Name">
              <Input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                value={user?.email || ""}
                disabled
              />
              <p className="text-xs text-gray-400 font-medium mt-1.5">
                Email cannot be changed here. Use Firebase Console to update it.
              </p>
            </Field>
            <div className="flex justify-end pt-1">
              {saveBtn(profileSaving, "Save Profile", "Saving…", <Save size={14} />)}
            </div>
          </form>
        </Section>

        {/* ── Password Section ── */}
        <Section
          icon={<Lock size={15} />}
          title="Change Password"
          iconBg="bg-[#1D7872]" iconBorder="border-[#1D7872]" iconColor="text-white"
        >
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <Field label="Current Password">
              <div className="relative">
                <Input
                  type={showCur ? "text" : "password"}
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  className="pr-11"
                />
                <button type="button" onClick={() => setShowCur(!showCur)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showCur ? "Hide password" : "Show password"}>
                  {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label="New Password">
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="pr-11"
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showNew ? "Hide password" : "Show password"}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label="Confirm New Password">
              <Input
                type="password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                placeholder="Repeat new password"
              />
              {confirmPwd && (
                <p className={`text-xs font-semibold mt-1.5 flex items-center gap-1
                  ${newPwd === confirmPwd ? "text-emerald-600" : "text-red-500"}`}>
                  {newPwd === confirmPwd
                    ? <><CheckCircle2 size={12} /> Passwords match</>
                    : <><AlertCircle size={12} /> Passwords do not match</>
                  }
                </p>
              )}
            </Field>

            <div className="flex justify-end pt-1">
              {saveBtn(pwdSaving, "Change Password", "Changing…", <Lock size={14} />)}
            </div>
          </form>
        </Section>

        {/* ── Company Info Section ── */}
        <Section
          icon={<Building2 size={15} />}
          title="Company Information"
          iconBg="bg-[#1D7872]" iconBorder="border-[#1D7872]" iconColor="text-white"
        >
          <p className="text-xs text-gray-400 font-medium mb-5">
            Used on invoices and documents generated by this panel.
          </p>
          <form onSubmit={handleCompanySave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company Name">
                <Input
                  type="text"
                  value={company.name}
                  onChange={e => setCompany(p => ({ ...p, name: e.target.value }))}
                  placeholder="Acme Pvt. Ltd."
                />
              </Field>
              <Field label="Phone">
                <Input
                  type="tel"
                  value={company.phone}
                  onChange={e => setCompany(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={company.email}
                  onChange={e => setCompany(p => ({ ...p, email: e.target.value }))}
                  placeholder="billing@company.com"
                />
              </Field>
              <Field label="GST Number">
                <Input
                  type="text"
                  value={company.gst}
                  onChange={e => setCompany(p => ({ ...p, gst: e.target.value }))}
                  placeholder="22AAAAA0000A1Z5"
                  className="font-mono"
                />
              </Field>
              <Field label="Website">
                <Input
                  type="url"
                  value={company.website}
                  onChange={e => setCompany(p => ({ ...p, website: e.target.value }))}
                  placeholder="https://company.com"
                />
              </Field>
            </div>
            <Field label="Address">
              <textarea
                value={company.address}
                onChange={e => setCompany(p => ({ ...p, address: e.target.value }))}
                placeholder="123 Street, City, State, PIN"
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
                           text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2
                           focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              />
            </Field>
            <div className="flex justify-end pt-1">
              {saveBtn(companySaving, "Save Company Info", "Saving…", <Save size={14} />)}
            </div>
          </form>
        </Section>

        {/* ── Session / Sign Out Section ── */}
        <Section
          icon={<ShieldAlert size={15} />}
          title="Session"
          iconBg="bg-red-50" iconBorder="border-red-100" iconColor="text-red-500"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-gray-800">Sign Out</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                You'll be redirected to the login page.
              </p>
            </div>
            <button onClick={handleSignOut}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-100
                         hover:border-red-200 text-red-500 font-bold px-4 py-2.5 rounded-xl text-sm
                         transition-all flex-shrink-0">
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </Section>

      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Layout>
  );
}