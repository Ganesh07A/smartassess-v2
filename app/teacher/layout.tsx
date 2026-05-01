"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Settings, 
  LogOut,
  Command,
  ChevronRight,
  Bell
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fdfdfd]">
        <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session || session.user.role !== "TEACHER") {
    redirect("/login");
  }

  const navItems = [
    { name: "Overview", href: "/teacher", icon: LayoutDashboard },
    { name: "Batches", href: "/teacher/batches", icon: Users },
    { name: "Examinations", href: "/teacher/exams", icon: BookOpen },
    { name: "Settings", href: "/teacher/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F9FAFB]">
      {/* Sidebar */}
      <aside className="w-[280px] bg-white border-r border-gray-200 flex flex-col">
        {/* Brand */}
        <div className="h-20 flex items-center px-6">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
              <Command className="w-5 h-5 text-white" />
            </div>
            <span className="text-[17px] font-bold tracking-tight text-gray-900">SmartAssess</span>
          </div>
        </div>

        <div className="px-4 mb-4">
          <p className="px-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">Main Menu</p>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/teacher" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? "bg-gray-900 text-white shadow-sm" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <div className="flex items-center">
                    <item.icon className={`w-[18px] h-[18px] mr-3 transition-colors ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-900"}`} />
                    <span className="text-[14px] font-semibold tracking-tight">{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto p-4 border-t border-gray-100">
          <button 
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center px-3 py-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm group"
          >
            <LogOut className="w-[18px] h-[18px] mr-3 group-hover:text-red-600" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-10 shrink-0">
          <h2 className="text-[15px] font-bold text-gray-800">
            {pathname.split('/').slice(2).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ') || 'Dashboard'}
          </h2>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-6 w-[1px] bg-gray-100 mx-2"></div>
            <div className="flex items-center space-x-3">
              <span className="text-[13px] font-bold text-gray-700">{session.user.name}</span>
              <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200"></div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F9FAFB] p-10">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
