"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Command, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/",
        redirect: false, // Change to false to handle error with toast
      });

      if (res?.error) {
        const msg = "Invalid credentials. Please check your email and password.";
        setError(msg);
        toast.error(msg);
        setLoading(false);
      } else {
        toast.success("Login successful! Redirecting...");
        window.location.href = "/";
      }
    } catch {
      const msg = "A connection error occurred. Please try again.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-6">
      <div className="max-w-md w-full">
        {/* Brand Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 mb-6 transition-transform hover:scale-105">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">SmartAssess</h1>
          <p className="text-gray-500 font-medium">Secure AI-Powered Examination Platform</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800">Welcome Back</h2>
            <p className="text-sm text-gray-400 font-medium mt-1">Sign in to your account to continue</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Email Address</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-red-700 leading-tight">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center justify-center group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Command className="w-5 h-5 mr-2 text-gray-400 group-hover:text-white transition-colors" />
              )}
              {loading ? "Authenticating..." : "Sign In to Portal"}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-50 text-center">
            <p className="text-xs text-gray-400 font-medium italic">
              Strict proctoring and tab-monitoring enabled.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-sm font-bold text-gray-400">
          Trouble signing in? <span className="text-blue-600 hover:underline cursor-pointer">Contact Administration</span>
        </p>
      </div>
    </div>
  );
}
