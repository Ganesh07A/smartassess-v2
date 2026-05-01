"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  LayoutDashboard, 
  History, 
  Settings, 
  LogOut,
  Command,
  ChevronRight,
  Bell,
  GraduationCap,
  Menu,
  X
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (status === "loading") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#fdfdfd]">
        <div className="w-8 h-8 border-2 border-black/10 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session || session.user.role !== "STUDENT") {
    redirect("/login");
  }

  const navItems = [
    { name: "My Dashboard", href: "/student", icon: LayoutDashboard, filter: null },
    { name: "Active Exams", href: "/student?filter=active", icon: GraduationCap, filter: "active" },
    { name: "Completed", href: "/student?filter=completed", icon: History, filter: "completed" },
    { name: "Settings", href: "/student/settings", icon: Settings, filter: null },
  ];

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="h-20 flex items-center px-6 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Command className="w-5 h-5 text-white" />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-gray-900">SmartAssess</span>
        </div>
      </div>

      <div className="px-4 mb-4 flex-1">
        <p className="px-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2">Student Menu</p>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.filter 
              ? currentFilter === item.filter 
              : (pathname === item.href && !currentFilter);
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsSidebarOpen(false)}
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
      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center px-3 py-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm group"
        >
          <LogOut className="w-[18px] h-[18px] mr-3 group-hover:text-red-600" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[280px] bg-white border-r border-gray-200 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar / Drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 transition-all duration-300 ${isSidebarOpen ? "visible" : "invisible pointer-events-none"}`}>
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setIsSidebarOpen(false)}
        />
        
        {/* Drawer */}
        <aside className={`absolute top-0 left-0 bottom-0 w-[280px] bg-white flex flex-col shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="absolute top-5 right-4 z-10">
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <SidebarContent />
        </aside>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 md:h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-10 shrink-0 z-10">
          <div className="flex items-center">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 mr-2 text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-[14px] md:text-[15px] font-bold text-gray-800 truncate">
              {currentFilter 
                ? currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1) + " Exams" 
                : pathname === "/student" ? "My Dashboard" : "Settings"}
            </h2>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <button className="hidden sm:flex p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full border-2 border-white"></span>
            </button>
            <div className="hidden sm:block h-6 w-[1px] bg-gray-100 mx-2"></div>
            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <p className="text-[13px] font-bold text-gray-900 leading-none">{session.user.name}</p>
                <p className="text-[11px] text-gray-400 font-medium mt-1">PRN: {session.user.prn || "N/A"}</p>
              </div>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 font-bold text-sm">
                {session.user.name?.[0]}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#F9FAFB]">
          <div className="p-4 md:p-10 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

