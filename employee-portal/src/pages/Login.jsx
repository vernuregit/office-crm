import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import {
  Mail, Lock, AlertCircle,
  CheckCircle, ArrowRight, Loader2, KeyRound
} from "lucide-react";
import logo from "./../assets/vinpro.jpg";

const Login = () => {
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [error,      setError]      = useState("");
  const [resetSent,  setResetSent]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const navigate = useNavigate();
  const { user }  = useAuthStore();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetSent(false);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // useEffect handles redirect
    } catch (err) {
      console.error("Login error:", err.code);
      switch (err.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          setError("Invalid email or password. Please try again.");
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please wait a moment or reset your password.");
          break;
        case "auth/user-disabled":
          setError("This account has been disabled. Contact your admin.");
          break;
        default:
          setError("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    // Prevent any form submission
    e.preventDefault();
    e.stopPropagation();

    setError("");
    setResetSent(false);

    if (!email.trim()) {
      setError("Enter your work email above first, then click Forgot Password.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err) {
      console.error("Reset error:", err.code);
      switch (err.code) {
        case "auth/user-not-found":
          setError("No account found with this email. Check the address or contact admin.");
          break;
        case "auth/invalid-email":
          setError("Invalid email address format.");
          break;
        case "auth/too-many-requests":
          setError("Too many reset attempts. Please wait a few minutes.");
          break;
        default:
          setError("Could not send reset email. Please try again.");
      }
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600
                            text-sm rounded-2xl px-4 py-3 mb-5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
              <p>{error}</p>
            </div>
          )}

          {/* Success banner */}
          {resetSent && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200
                            text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-5">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-emerald-500" />
              <div>
                <p className="font-bold">Reset email sent!</p>
                <p className="text-xs mt-0.5 text-emerald-600">
                  Check your inbox at <span className="font-semibold">{email}</span> and follow the link to reset your password.
                </p>
              </div>
            </div>
          )}

          {/* ── Login Form ── */}
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Logo + Title */}
            <div className="text-center mb-8">
              <div className="w-28 h-20 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Employee Portal</h1>
              <p className="text-gray-500 text-sm mt-2 font-medium">Sign in to your work account</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); setResetSent(false); }}
                  required placeholder="you@cafirm.com"
                  className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border-[#153485]
                             transition-all bg-gray-50 focus:bg-white" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="password" value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-[#153485] focus:border-[#153485]
                             transition-all bg-gray-50 focus:bg-white" />
              </div>
            </div>

            {/* Forgot Password — OUTSIDE form submit, uses onClick only */}
            <div className="flex justify-end">
              <button type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="flex items-center gap-1.5 text-sm text-[#153485] font-semibold
                           hover:underline transition-colors disabled:opacity-50 cursor-pointer">
                {resetLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Sending...</>
                  : <><KeyRound size={13} /> Forgot password?</>
                }
              </button>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-[#153485] text-white font-bold py-3 rounded-xl
                         hover:opacity-90 transition-all shadow-lg hover:shadow-xl
                         disabled:opacity-50 disabled:cursor-not-allowed text-sm
                         flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                : <><span>Sign In</span><ArrowRight size={16} /></>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 CA Firm. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;