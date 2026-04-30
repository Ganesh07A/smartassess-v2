"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Settings, 
  LogOut 
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session || session.user.role !== "TEACHER") {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm relative">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-blue-600">SmartAssess</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Teacher Portal</p>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          <Link
            href="/teacher"
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            Dashboard
          </Link>
          <Link
            href="/teacher/batches"
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <Users className="w-5 h-5 mr-3" />
            Batches
          </Link>
          <Link
            href="/teacher/exams"
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <BookOpen className="w-5 h-5 mr-3" />
            Exams
          </Link>
          <Link
            href="/teacher/settings"
            className="flex items-center px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 mr-3" />
            Settings
          </Link>
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t">
          <div className="flex items-center px-4 py-3 text-gray-700">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
              {session.user.name?.[0]}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full mt-2 flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
