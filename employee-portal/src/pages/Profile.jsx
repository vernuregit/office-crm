import { useState, useRef } from "react";
import {
  doc, updateDoc
} from "firebase/firestore";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../firebase/config";
import useAuthStore           from "../store/authStore";
import Layout                 from "../components/Layout";
import {
  User, Mail, Phone, Building2,
  Briefcase, Lock, Camera, Save,
  Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Shield, Clock,
  Calendar, Edit3, X
} from "lucide-react";

// ─── Section Card ─────────────────────────────────────────────────
const SectionCard = ({ title, description, icon: Icon, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(79,70,229,0.07)] overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
      <div className="w-9 h-9 rounded-xl bg-[#153485] flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <h3 className="font-black text-gray-900 text-sm tracking-tight">{title}</h3>
        {description && <p className="text-xs text-gray-400 font-medium mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ─── Input Field ──────────────────────────────────────────────────
const InputField = ({ label, icon: Icon, type = "text", value, onChange, placeholder, disabled, rightElement }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    <div className="relative">
      {Icon && <Icon size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full border rounded-xl py-2.5 text-sm transition-all
          ${Icon ? "pl-11" : "pl-4"}
          ${rightElement ? "pr-11" : "pr-4"}
          ${disabled
            ? "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed"
            : "border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border-[#153485]"
          }`}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
      )}
    </div>
  </div>
);

// ─── Alert ────────────────────────────────────────────────────────
const Alert = ({ type, message }) => {
  const config = {
    success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", Icon: CheckCircle,  iconColor: "text-emerald-500" },
    error:   { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-600",     Icon: AlertCircle,  iconColor: "text-red-500"     },
  };
  const c = config[type];
  return (
    <div className={`flex items-start gap-3 ${c.bg} border ${c.border} ${c.text} text-sm rounded-2xl px-4 py-3`}>
      <c.Icon size={16} className={`flex-shrink-0 mt-0.5 ${c.iconColor}`} />
      <p>{message}</p>
    </div>
  );
};

// ─── Main Profile Page ────────────────────────────────────────────
const Profile = () => {
  const { user, userData, setUserData } = useAuthStore();
  const fileInputRef = useRef(null);

  // Personal Info State
  const [name,        setName]        = useState(userData?.name        || "");
  const [phone,       setPhone]       = useState(userData?.phone       || "");
  const [city,        setCity]        = useState(userData?.city        || "");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoMsg,     setInfoMsg]     = useState(null);

  // Password State
  const [currentPwd,  setCurrentPwd]  = useState("");
  const [newPwd,      setNewPwd]      = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading,  setPwdLoading]  = useState(false);
  const [pwdMsg,      setPwdMsg]      = useState(null);

  // Avatar State
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarMsg,     setAvatarMsg]     = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(userData?.photoURL || null);

  // ── Password Strength ──────────────────────────────────────────
  const passwordStrength = (pwd) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[0-9]/.test(pwd))        score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: "Weak",   color: "bg-red-400",    width: "w-1/4" };
    if (score === 2) return { label: "Fair",   color: "bg-amber-400",  width: "w-2/4" };
    if (score === 3) return { label: "Good",   color: "bg-blue-400",   width: "w-3/4" };
    return               { label: "Strong", color: "bg-emerald-400", width: "w-full" };
  };
  const strength = passwordStrength(newPwd);

  // ── Save Personal Info ─────────────────────────────────────────
  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setInfoLoading(true);
    setInfoMsg(null);
    try {
      await updateDoc(doc(db, "employees", user.uid), { name, phone, city });
      setUserData({ ...userData, name, phone, city });
      setInfoMsg({ type: "success", text: "Profile updated successfully!" });
    } catch {
      setInfoMsg({ type: "error", text: "Failed to update profile. Try again." });
    }
    setInfoLoading(false);
    setTimeout(() => setInfoMsg(null), 4000);
  };

  // ── Change Password ────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) return setPwdMsg({ type: "error", text: "New passwords do not match." });
    if (newPwd.length < 8)     return setPwdMsg({ type: "error", text: "Password must be at least 8 characters." });
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPwd);
      setPwdMsg({ type: "success", text: "Password changed successfully!" });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      if (err.code === "auth/wrong-password") {
        setPwdMsg({ type: "error", text: "Current password is incorrect." });
      } else {
        setPwdMsg({ type: "error", text: "Failed to change password. Try again." });
      }
    }
    setPwdLoading(false);
    setTimeout(() => setPwdMsg(null), 5000);
  };

  // ── Upload Avatar ──────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setAvatarMsg({ type: "error", text: "Only image files are allowed." });
    if (file.size > 2 * 1024 * 1024)    return setAvatarMsg({ type: "error", text: "Image must be under 2MB." });

    setAvatarLoading(true);
    setAvatarMsg(null);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);

    try {
      const storageRef = ref(storage, `avatars/employees/${user.uid}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on("state_changed", null, () => {
        setAvatarMsg({ type: "error", text: "Upload failed. Try again." });
        setAvatarLoading(false);
      }, async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(doc(db, "employees", user.uid), { photoURL: url });
        setUserData({ ...userData, photoURL: url });
        setAvatarMsg({ type: "success", text: "Profile photo updated!" });
        setAvatarLoading(false);
        setTimeout(() => setAvatarMsg(null), 4000);
      });
    } catch {
      setAvatarMsg({ type: "error", text: "Something went wrong." });
      setAvatarLoading(false);
    }
  };

  // ── Joined date ────────────────────────────────────────────────
  const joinedDate = userData?.joiningDate
    ? new Date(userData.joiningDate.seconds * 1000).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <Layout title="My Profile">

      {/* ── Profile Hero ──────────────────────────────────────── */}
      <div className="relative bg-[#f7f7f7]  p-7 mb-6 text-black overflow-hidden shadow-sm shadow-black ">
        {/* <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-14 right-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none " /> */}

        <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 ">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-3xl bg-white/20 border-2 border-black overflow-hidden shadow-xl">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl font-black text-black">
                    {userData?.name?.charAt(0).toUpperCase() || "E"}
                  </span>
                </div>
              )}
            </div>
            {/* Camera button */}
            {/* <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white text-[#153485] cursor-pointer flex items-center justify-center shadow-lg  transition-colors border "
            >
              {avatarLoading
                ? <Loader2 size={13} className="animate-spin" />
                : <Camera size={13} />
              }
            </button> */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl text-black font-black tracking-tight">{userData?.name}</h2>
            <p className="text-black font-medium mt-1">
              {userData?.designation || "Employee"} · {userData?.department || ""}
            </p>
            <p className="text-black text-sm mt-0.5">{user?.email}</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
              <span className="flex items-center gap-1.5 bg-white/20 text-black text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                <Calendar size={12} /> Joined {joinedDate}
              </span>
              <span className="flex items-center gap-1.5 bg-white/20 text-black text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20">
                <Building2 size={12} /> {userData?.department || "Department"}
              </span>
              <span className="flex items-center gap-1.5  bg-white/20 text-black text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-300/30">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Active Employee
              </span>
            </div>
          </div>
        </div>

        {/* Avatar message */}
        {avatarMsg && (
          <div className={`relative mt-4 text-sm font-medium px-4 py-2 rounded-xl
            ${avatarMsg.type === "success"
              ? "bg-emerald-400/20 text-white border border-emerald-300/30"
              : "bg-red-400/20 text-white border border-red-300/30"
            }`}
          >
            {avatarMsg.text}
          </div>
        )}
      </div>

      {/* ── Two Column Layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left Column ───────────────────────────────────── */}
        <div className="space-y-6">

          {/* Personal Info */}
          <SectionCard
            title="Personal Information"
            description="Update your personal details"
            icon={User}
          >
            {infoMsg && <div className="mb-4"><Alert type={infoMsg.type} message={infoMsg.text} /></div>}
            <form onSubmit={handleSaveInfo} className="space-y-4">
              <InputField
                label="Full Name"
                icon={User}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
              <InputField
                label="Work Email"
                icon={Mail}
                value={user?.email || ""}
                disabled
                placeholder="your@email.com"
              />
              <InputField
                label="Phone Number"
                icon={Phone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
              />
              <InputField
                label="City"
                icon={Building2}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Chennai"
              />
              <button
                type="submit"
                disabled={infoLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#153485] text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all shadow-md disabled:opacity-50 text-sm"
              >
                {infoLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                  : <><Save size={15} /> Save Changes</>
                }
              </button>
            </form>
          </SectionCard>

          {/* Work Info (Read Only) */}
          <SectionCard
            title="Work Information"
            description="Managed by your admin"
            icon={Briefcase}
          >
            <div className="space-y-3">
              {[
                { label: "Department",   value: userData?.department,   Icon: Building2  },
                { label: "Designation",  value: userData?.designation,  Icon: Briefcase  },
                { label: "Joining Date", value: joinedDate,             Icon: Calendar   },
                { label: "Employee ID",  value: user?.uid?.slice(0, 8).toUpperCase(), Icon: Shield },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[#153485]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{value || "—"}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                      Read only
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-3 flex items-center gap-1.5">
              <AlertCircle size={12} className="text-amber-400" />
              Contact your admin to update work details
            </p>
          </SectionCard>
        </div>

        {/* ── Right Column ──────────────────────────────────── */}
        <div className="space-y-6">

          {/* Change Password */}
          <SectionCard
            title="Change Password"
            description="Keep your account secure"
            icon={Lock}
          >
            {pwdMsg && <div className="mb-4"><Alert type={pwdMsg.type} message={pwdMsg.text} /></div>}
            <form onSubmit={handleChangePassword} className="space-y-4">

              {/* Current Password */}
              <InputField
                label="Current Password"
                icon={Lock}
                type={showCurrent ? "text" : "password"}
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="Your current password"
                rightElement={
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />

              {/* New Password */}
              <InputField
                label="New Password"
                icon={Lock}
                type={showNew ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Min. 8 characters"
                rightElement={
                  <button type="button" onClick={() => setShowNew(!showNew)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />

              {/* Password Strength */}
              {newPwd && strength && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-gray-500 font-medium">Password strength</p>
                    <p className={`text-xs font-bold
                      ${strength.label === "Strong" ? "text-emerald-500"
                      : strength.label === "Good"   ? "text-blue-500"
                      : strength.label === "Fair"   ? "text-amber-500"
                      : "text-red-500"}`}
                    >
                      {strength.label}
                    </p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                  </div>
                  <ul className="mt-2 space-y-1">
                    {[
                      { rule: newPwd.length >= 8,          text: "At least 8 characters"     },
                      { rule: /[A-Z]/.test(newPwd),        text: "One uppercase letter"       },
                      { rule: /[0-9]/.test(newPwd),        text: "One number"                 },
                      { rule: /[^A-Za-z0-9]/.test(newPwd), text: "One special character"      },
                    ].map(({ rule, text }) => (
                      <li key={text} className={`flex items-center gap-1.5 text-xs font-medium
                        ${rule ? "text-emerald-600" : "text-gray-400"}`}
                      >
                        <CheckCircle size={11} className={rule ? "text-emerald-500" : "text-gray-300"} />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Confirm Password */}
              <InputField
                label="Confirm New Password"
                icon={Lock}
                type={showConfirm ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-enter new password"
                rightElement={
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />

              {/* Match indicator */}
              {confirmPwd && (
                <p className={`text-xs font-semibold flex items-center gap-1.5
                  ${newPwd === confirmPwd ? "text-emerald-600" : "text-red-500"}`}
                >
                  {newPwd === confirmPwd
                    ? <><CheckCircle size={12} /> Passwords match</>
                    : <><X size={12} /> Passwords do not match</>
                  }
                </p>
              )}

              <button
                type="submit"
                disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                className="w-full flex items-center justify-center bg-[#153485] cursor-pointer gap-2 bg- text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all shadow-md disabled:opacity-50 text-sm"
              >
                {pwdLoading
                  ? <><Loader2 size={15} className="animate-spin" /> Updating...</>
                  : <><Shield size={15} /> Update Password</>
                }
              </button>
            </form>
          </SectionCard>

          {/* Account Info */}
          <SectionCard
            title="Account Details"
            description="Your account at a glance"
            icon={Shield}
          >
            <div className="space-y-3">
              {[
                {
                  label: "Account Status",
                  value: "Active",
                  Icon: CheckCircle,
                  valueColor: "text-emerald-600",
                  valueStyle: "flex items-center gap-1.5",
                },
                {
                  label: "Role",
                  value: "Employee",
                  Icon: User,
                  valueColor: "text-[#153485]",
                },
                {
                  label: "Last Sign In",
                  value: user?.metadata?.lastSignInTime
                    ? new Date(user.metadata.lastSignInTime).toLocaleString("en-IN", {
                        day: "numeric", month: "short",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : "—",
                  Icon: Clock,
                  valueColor: "text-gray-700",
                },
                {
                  label: "Account Created",
                  value: user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString("en-IN", {
                        day: "numeric", month: "long", year: "numeric",
                      })
                    : "—",
                  Icon: Calendar,
                  valueColor: "text-gray-700",
                },
              ].map(({ label, value, Icon, valueColor, valueStyle }) => (
                <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-[#153485]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                    <p className={`text-sm font-semibold ${valueColor} ${valueStyle || ""}`}>
                      {label === "Account Status" && (
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      )}
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </div>
    </Layout>
  );
};

export default Profile;

