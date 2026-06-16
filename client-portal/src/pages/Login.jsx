import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, CheckCircle, Building2, ArrowRight, Loader2 } from "lucide-react";
import logo from "./../assets/vinpro.jpg"


const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch {
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) return setError("Enter your email first to reset password.");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle dot-grid background */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Soft ambient glow — top center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
      {/* Background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">



        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 mb-5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-500" />
              <p>{error}</p>
            </div>
          )}

          {/* Reset sent */}
          {resetSent && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-5">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5 text-emerald-500" />
              <p>Password reset email sent! Check your inbox.</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-28 h-20 rounded-2xl flex  flex items-center justify-center mb-4 mx-auto">
                <img src={logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Welcome back</h1>
              <p className="text-gray-500 text-sm mt-2 font-medium">
                Sign in to your client portal
              </p>
            </div>
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-#1D7872 focus:border-[#1D7872] transition-all bg-gray-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7872] focus:border-[#1D7872] transition-all bg-gray-50 focus:bg-white"
                />
              </div>
            </div>

            {/* Forgot */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-gray-600 cursor-pointer font-semibold hover:underline transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1D7872] cursor-pointer text-white font-bold py-3 rounded-xl hover:opacity-90 transition-all duration-150 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                : <><span>Sign In</span><ArrowRight size={16} /></>
              }
            </button>
          </form>

          {/* <p className="text-center text-xs text-gray-400 mt-6">
            Having trouble?{" "}
            <a href="mailto:support@cafirm.com" className="text-indigo-500 hover:underline font-medium">
              Contact support
            </a>
          </p> */}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 CA Firm. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
