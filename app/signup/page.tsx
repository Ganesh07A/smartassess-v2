"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { 
  ShieldCheck, 
  Loader2, 
  AlertCircle, 
  User, 
  Mail, 
  Lock, 
  Hash, 
  Key, 
  CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Role } from "@prisma/client";

export default function SignUpPage() {
  const [role, setRole] = useState<Role>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prn, setPrn] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("AIML");
  const [year, setYear] = useState("Third Year");
  const [division, setDivision] = useState("A");
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Client-side checks
    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      const msg = "Password must be at least 6 characters.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    try {
      // 2. Call server-side sign up action
      const res = await signUp({
        name,
        email,
        password,
        role,
        prn: role === "STUDENT" ? prn : undefined,
        inviteCode: role === "TEACHER" ? inviteCode : undefined,
        department,
        year: role === "STUDENT" ? year : undefined,
        division: role === "STUDENT" ? division : undefined,
      });

      if (!res.success) {
        const msg = res.error || "Failed to create account.";
        setError(msg);
        toast.error(msg);
        setLoading(false);
        return;
      }

      toast.success("Account created successfully! Logging you in...");

      // 3. Automatically sign in the user
      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        toast.error("Auto-login failed. Please sign in manually.");
        window.location.href = "/login";
      } else {
        // Fetch session to retrieve user role and redirect
        const session = await getSession();
        const userRole = session?.user?.role;
        
        if (userRole === "TEACHER") {
          window.location.href = "/teacher";
        } else if (userRole === "STUDENT") {
          window.location.href = "/student";
        } else {
          window.location.href = "/";
        }
      }
    } catch (err) {
      console.error("Signup submission error:", err);
      const msg = "An error occurred. Please try again later.";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] py-12 px-6">
      <div className="max-w-md w-full">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 mb-4 transition-transform hover:scale-105">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Create Account</h1>
          <p className="text-sm text-gray-500 font-medium">Join SmartAssess secure examination portal</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-gray-50 rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => {
                setRole("STUDENT");
                setError("");
              }}
              className={`py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center ${
                role === "STUDENT"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <User className="w-4 h-4 mr-2" />
              Student
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("TEACHER");
                setError("");
              }}
              className={`py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center ${
                role === "TEACHER"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Teacher
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Full Name */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400 text-sm"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400 text-sm"
                  placeholder="john@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Department (Common to both Student & Teacher) */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                Department
              </label>
              <div className="relative">
                <select
                  required
                  className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold text-sm cursor-pointer"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="AIML">AIML (AI & Machine Learning)</option>
                  <option value="CSE">CSE (Computer Science)</option>
                  <option value="ECE">ECE (Electronics & Comm)</option>
                  <option value="MECH">MECH (Mechanical)</option>
                  <option value="CIVIL">CIVIL (Civil)</option>
                </select>
              </div>
            </div>

            {/* Student: PRN */}
            {role === "STUDENT" && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                  Permanent Registration Number (PRN)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <Hash className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400 text-sm"
                    placeholder="PRN2026109923"
                    value={prn}
                    onChange={(e) => setPrn(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Student: Year & Division */}
            {role === "STUDENT" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                    Year
                  </label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold text-sm cursor-pointer"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="First Year">First Year</option>
                    <option value="Second Year">Second Year</option>
                    <option value="Third Year">Third Year</option>
                    <option value="Fourth Year">Fourth Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                    Division
                  </label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold text-sm cursor-pointer"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              </div>
            )}

            {/* Teacher: Admin Invite Code */}
            {role === "TEACHER" && (
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                  Admin Invite Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400 text-sm"
                    placeholder="Enter registration invite key (optional if using institutional email)"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 px-1">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900 font-bold placeholder:text-gray-400 text-sm"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Error Message display */}
            {error && (
              <div className="p-3.5 bg-red-50 rounded-xl border border-red-100 flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-red-700 leading-tight">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 bg-gray-900 hover:bg-black text-white font-black rounded-2xl transition-all shadow-lg shadow-gray-200 flex items-center justify-center group disabled:opacity-50 text-sm"
            >
              {loading ? (
                <Loader2 className="w-4.5 h-4.5 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4.5 h-4.5 mr-2 text-gray-400 group-hover:text-white transition-colors" />
              )}
              {loading ? "Creating Account..." : "Register Now"}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 pt-6 border-t border-gray-50 text-center">
            <p className="text-xs text-gray-500 font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 font-bold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
