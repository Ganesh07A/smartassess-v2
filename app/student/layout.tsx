"use client";

import { ReactNode } from "react";
import { signOut, useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!session || session.user.role !== "STUDENT") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Student Header */}
      <header className="bg-white border-b shadow-sm px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{session.user.name}</h1>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Student Portal</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
