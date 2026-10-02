"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { pusherClient } from "@/app/lib/pusher-client";
import { examChannel } from "@/app/lib/pusher-channels";
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  User as UserIcon,
  ShieldAlert,
  WifiOff,
  UserX,
  FilterX
} from "lucide-react";
import { FilterBar } from "@/ui/filters/filter-bar";
import { FilterModeProvider, useFilterParams } from "@/lib/filters/use-filter-params";
import type { FilterDef } from "@/ui/filters/filter-bar";

export interface StudentSession {
  studentId: string;
  studentName: string;
  prn: string;
  status: string;
  answeredCount: number;
  tabSwitches: number;
  violationCount: number;
  riskScore: number;
  lastHeartbeatAt: string | Date | null;
  startTime: string | Date;
  updatedAt: string | Date;
  ipAddress?: string;
}

interface LiveDashboardProps {
  examId: string;
  initialSessions: StudentSession[];
  totalQuestions: number;
}

/** Periodic timer hook to trigger re-renders for live heartbeat dots and idle calculation */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function getLiveness(s: StudentSession, now: number): { label: string; badgeClass: string; dotClass: string; pulse: boolean } {
  if (s.status === "NOT_STARTED") {
    return {
      label: "Offline",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
      dotClass: "bg-slate-400",
      pulse: false
    };
  }
  if (s.status === "COMPLETED" || s.status === "FORCE_SUBMITTED") {
    return {
      label: "Finished",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      dotClass: "bg-slate-500",
      pulse: false
    };
  }
  const lastTime = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : new Date(s.updatedAt).getTime();
  const diffSec = (now - lastTime) / 1000;
  if (diffSec < 60) {
    return {
      label: "Live",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotClass: "bg-emerald-500",
      pulse: true
    };
  }
  if (diffSec <= 180) {
    return {
      label: "Stale",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      dotClass: "bg-amber-500",
      pulse: false
    };
  }
  return {
    label: "Disconnected",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
    pulse: false
  };
}

function LiveDashboardInner({ examId, initialSessions, totalQuestions }: LiveDashboardProps) {
  const now = useNow(30_000);
  const { get, getAll, clearAll } = useFilterParams({ mode: "history" });

  const [sessions, setSessions] = useState<Record<string, StudentSession>>(() => {
    const map: Record<string, StudentSession> = {};
    initialSessions.forEach((s) => {
      map[s.studentId] = s;
    });
    return map;
  });

  const [alerts, setAlerts] = useState<{ id: string; message: string; type: 'warning' | 'info' }[]>([]);

  const addAlert = useCallback((message: string, type: 'warning' | 'info') => {
    const id = Math.random().toString(36).substring(7);
    setAlerts((prev) => [{ id, message, type }, ...prev].slice(0, 5));
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 5000);
  }, []);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Real-time Pusher synchronization
  useEffect(() => {
    if (!pusherClient) return;

    const channel = pusherClient.subscribe(examChannel(examId));

    channel.bind("student-joined", (data: { studentId: string; studentName: string; prn: string; startTime: string; ipAddress?: string }) => {
      const previous = sessionsRef.current;
      const hasIpCollision =
        Boolean(data.ipAddress) &&
        data.ipAddress !== "unknown" &&
        Object.values(previous).some(
          (other) =>
            other.ipAddress === data.ipAddress &&
            other.studentId !== data.studentId &&
            other.status === "STARTED",
        );

      setSessions((prev) => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          studentId: data.studentId,
          studentName: data.studentName,
          prn: data.prn,
          status: "STARTED",
          startTime: data.startTime,
          lastHeartbeatAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          answeredCount: prev[data.studentId]?.answeredCount || 0,
          tabSwitches: prev[data.studentId]?.tabSwitches || 0,
          violationCount: prev[data.studentId]?.violationCount || 0,
          riskScore: prev[data.studentId]?.riskScore || 0,
          ipAddress: data.ipAddress,
        },
      }));

      if (hasIpCollision) {
        addAlert(`Multiple students detected on IP: ${data.ipAddress}!`, "warning");
      }
      addAlert(`${data.studentName} joined the exam`, "info");
    });

    channel.bind("tab-switch", (data: { studentId: string; studentName: string; totalSwitches: number }) => {
      setSessions((prev) => {
        const existing = prev[data.studentId];
        const switches = data.totalSwitches;
        // Compute heuristic risk escalation if not set from server
        const riskScore = Math.min(100, switches * 20);
        return {
          ...prev,
          [data.studentId]: {
            ...existing,
            studentId: data.studentId,
            studentName: existing?.studentName || data.studentName,
            prn: existing?.prn || "N/A",
            status: existing?.status || "STARTED",
            answeredCount: existing?.answeredCount || 0,
            startTime: existing?.startTime || new Date().toISOString(),
            tabSwitches: switches,
            violationCount: switches,
            riskScore: Math.max(existing?.riskScore || 0, riskScore),
            lastHeartbeatAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      });
      addAlert(`${data.studentName} switched tabs! (Total: ${data.totalSwitches})`, "warning");
    });

    channel.bind("answer-saved", (data: { studentId: string; answeredCount: number }) => {
      setSessions((prev) => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          answeredCount: data.answeredCount,
          lastHeartbeatAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }));
    });

    channel.bind("student-submitted", (data: { studentId: string; status?: string }) => {
      const name = sessionsRef.current[data.studentId]?.studentName || "A student";
      setSessions((prev) => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          status: data.status === "FORCE_SUBMITTED" ? "FORCE_SUBMITTED" : "COMPLETED",
          updatedAt: new Date().toISOString(),
        },
      }));
      addAlert(
        data.status === "FORCE_SUBMITTED"
          ? `${name} was force-submitted`
          : `${name} submitted the exam`,
        "info",
      );
    });

    return () => {
      pusherClient?.unsubscribe(examChannel(examId));
    };
  }, [examId, addAlert]);

  const allSessions = useMemo(() => Object.values(sessions), [sessions]);

  // Track duplicate active IPs
  const duplicateIpSet = useMemo(() => {
    const ipCounts = new Map<string, number>();
    for (const s of allSessions) {
      if (s.ipAddress && s.ipAddress !== "unknown" && s.status === "STARTED") {
        ipCounts.set(s.ipAddress, (ipCounts.get(s.ipAddress) || 0) + 1);
      }
    }
    const dupes = new Set<string>();
    for (const [ip, count] of ipCounts.entries()) {
      if (count > 1) dupes.add(ip);
    }
    return dupes;
  }, [allSessions]);

  // Overall metric counts for summary cards and facets
  const activeCount = allSessions.filter((s) => s.status === "STARTED").length;
  const completedCount = allSessions.filter(
    (s) => s.status === "COMPLETED" || s.status === "FORCE_SUBMITTED",
  ).length;
  const notStartedCount = allSessions.filter((s) => s.status === "NOT_STARTED").length;
  const forceSubmittedCount = allSessions.filter((s) => s.status === "FORCE_SUBMITTED").length;
  const totalViolations = allSessions.reduce((acc, s) => acc + (s.violationCount || s.tabSwitches || 0), 0);

  const flaggedStudentsCount = allSessions.filter((s) => (s.riskScore || 0) >= 40).length;
  const criticalStudentsCount = allSessions.filter((s) => (s.riskScore || 0) >= 70).length;
  const disconnectedCount = allSessions.filter((s) => {
    if (s.status !== "STARTED") return false;
    const last = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : new Date(s.updatedAt).getTime();
    return (now - last) / 1000 > 180;
  }).length;

  // Active filter params from URL (in history mode)
  const q = get("q")?.trim().toLowerCase() || "";
  const statusFilter = getAll("status").map((s) => s.toLowerCase());
  const riskFilter = get("risk") || "all";
  const idleFilter = get("idle") ? parseInt(get("idle")!, 10) : null;
  const dupFilter = get("dup") === "true" || get("dup") === "1";
  const sortField = get("sort") || "risk";
  const sortDir = get("dir") || (sortField === "name" || sortField === "prn" ? "asc" : "desc");

  // In-memory bounded filtering & sorting
  const filteredSessions = useMemo(() => {
    const list = allSessions.filter((s) => {
      // 1. Text search
      if (q) {
        const matchName = s.studentName.toLowerCase().includes(q);
        const matchPrn = s.prn.toLowerCase().includes(q);
        if (!matchName && !matchPrn) return false;
      }

      // 2. Status filter
      if (statusFilter.length > 0 && !statusFilter.includes("all")) {
        const currentStatus = s.status.toLowerCase();
        if (!statusFilter.includes(currentStatus)) return false;
      }

      // 3. Risk filter
      if (riskFilter === "flagged" && (s.riskScore || 0) < 40) return false;
      if (riskFilter === "critical" && (s.riskScore || 0) < 70) return false;

      // 4. Idle filter (no activity for >= idleFilter minutes)
      if (idleFilter !== null && idleFilter > 0) {
        if (s.status !== "STARTED") return false;
        const lastTime = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : new Date(s.updatedAt).getTime();
        const idleMins = (now - lastTime) / 60000;
        if (idleMins < idleFilter) return false;
      }

      // 5. Duplicate IP filter
      if (dupFilter) {
        const isDup = s.ipAddress && s.ipAddress !== "unknown" && duplicateIpSet.has(s.ipAddress);
        if (!isDup) return false;
      }

      return true;
    });

    // 6. Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "risk") {
        cmp = (b.riskScore || 0) - (a.riskScore || 0);
        if (cmp === 0) cmp = (b.violationCount || 0) - (a.violationCount || 0);
        if (cmp === 0) cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortField === "violations") {
        cmp = (b.violationCount || b.tabSwitches || 0) - (a.violationCount || a.tabSwitches || 0);
        if (cmp === 0) cmp = (b.riskScore || 0) - (a.riskScore || 0);
      } else if (sortField === "lastActivity") {
        const aTime = a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt).getTime() : new Date(a.updatedAt).getTime();
        const bTime = b.lastHeartbeatAt ? new Date(b.lastHeartbeatAt).getTime() : new Date(b.updatedAt).getTime();
        cmp = bTime - aTime;
      } else if (sortField === "name") {
        cmp = a.studentName.localeCompare(b.studentName);
      } else if (sortField === "prn") {
        cmp = a.prn.localeCompare(b.prn);
      }

      return sortDir === "desc" ? cmp : -cmp;
    });

    return list;
  }, [allSessions, q, statusFilter, riskFilter, idleFilter, dupFilter, sortField, sortDir, duplicateIpSet, now]);

  const filterDefs: FilterDef[] = [
    {
      param: "q",
      label: "Search",
      type: "search",
      placeholder: "Search by student name or PRN...",
    },
    {
      param: "status",
      label: "Status",
      type: "facet",
      options: [
        { value: "started", label: "Started", count: activeCount },
        { value: "not_started", label: "Not Started", count: notStartedCount },
        { value: "completed", label: "Completed", count: completedCount },
        { value: "force_submitted", label: "Force Submitted", count: forceSubmittedCount },
      ],
    },
    {
      param: "risk",
      label: "Risk Level",
      type: "facet",
      multi: false,
      options: [
        { value: "all", label: "All Risks" },
        { value: "flagged", label: "Flagged (≥ 40)", count: flaggedStudentsCount },
        { value: "critical", label: "Critical (≥ 70)", count: criticalStudentsCount },
      ],
    },
    {
      param: "idle",
      label: "Inactivity",
      type: "facet",
      multi: false,
      options: [
        { value: "2", label: "Idle ≥ 2m" },
        { value: "5", label: "Idle ≥ 5m" },
        { value: "10", label: "Idle ≥ 10m" },
      ],
    },
    {
      param: "dup",
      label: "IP Collision",
      type: "facet",
      multi: false,
      options: [
        { value: "true", label: "Duplicate IP only", count: duplicateIpSet.size },
      ],
    },
    {
      param: "sort",
      label: "Sort",
      type: "sort",
      sortOptions: [
        { value: "risk", label: "Risk Score" },
        { value: "violations", label: "Violations" },
        { value: "lastActivity", label: "Last Activity" },
        { value: "name", label: "Student Name" },
        { value: "prn", label: "PRN" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">In Progress</div>
            <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mr-4">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Submissions</div>
            <div className="text-2xl font-bold text-slate-900">{completedCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mr-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Violations</div>
            <div className="text-2xl font-bold text-slate-900">{totalViolations}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mr-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Flagged / Risk</div>
            <div className="text-2xl font-bold text-slate-900">{flaggedStudentsCount}</div>
          </div>
        </div>
      </div>

      {/* Surface Summary Line */}
      <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>{flaggedStudentsCount} flagged</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <WifiOff className="w-4 h-4" />
            <span>{disconnectedCount} disconnected</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <Activity className="w-4 h-4" />
            <span>{activeCount} in progress</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <UserX className="w-4 h-4" />
            <span>{notStartedCount} not started</span>
          </span>
        </div>
        <div className="text-slate-400 font-medium">
          Showing {filteredSessions.length} of {allSessions.length} students
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <FilterBar defs={filterDefs} />
      </div>

      {/* Live Alerts Overlay */}
      <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-50 flex flex-col space-y-2 pointer-events-none">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={`pointer-events-auto px-5 py-3 rounded-xl shadow-2xl border flex items-center animate-in slide-in-from-right duration-300 text-xs font-bold ${
              alert.type === 'warning' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            {alert.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 mr-2.5 shrink-0" />
            ) : (
              <Activity className="w-4 h-4 mr-2.5 shrink-0" />
            )}
            <span>{alert.message}</span>
          </div>
        ))}
      </div>

      {/* Responsive Monitor Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <h3 className="font-bold text-slate-900 flex items-center text-sm">
            <Activity className="w-4 h-4 mr-2 text-indigo-600" />
            Invigilator Live Roster
          </h3>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Auto-refreshing via Pusher
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FilterX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No matching students found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try broadening your search query or clearing some of the active facet filters.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/40 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Student</th>
                    <th className="px-6 py-3.5">Liveness</th>
                    <th className="px-6 py-3.5">Risk Score</th>
                    <th className="px-6 py-3.5">IP Address</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Progress</th>
                    <th className="px-6 py-3.5">Violations</th>
                    <th className="px-6 py-3.5">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredSessions.map((s) => {
                    const liveness = getLiveness(s, now);
                    const isDuplicateIP =
                      s.ipAddress &&
                      s.ipAddress !== "unknown" &&
                      duplicateIpSet.has(s.ipAddress);

                    return (
                      <tr key={s.studentId} className="hover:bg-slate-50/60 transition-colors">
                        {/* Student Name & PRN */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mr-3 border border-slate-200 shrink-0">
                              <UserIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{s.studentName}</div>
                              <div className="text-[11px] text-slate-400 font-mono font-bold tracking-wider">{s.prn}</div>
                            </div>
                          </div>
                        </td>

                        {/* Liveness dot & label */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${liveness.badgeClass}`}>
                            <span className={`w-2 h-2 rounded-full ${liveness.dotClass} ${liveness.pulse ? "animate-pulse" : ""}`} />
                            {liveness.label}
                          </span>
                        </td>

                        {/* Risk score */}
                        <td className="px-6 py-4">
                          {s.riskScore >= 70 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              {s.riskScore} (Critical)
                            </span>
                          ) : s.riskScore >= 40 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {s.riskScore} (Flagged)
                            </span>
                          ) : s.riskScore > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                              {s.riskScore}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>

                        {/* IP Address & collision warning */}
                        <td className="px-6 py-4">
                          <div className={`text-[11px] font-mono font-bold ${
                            isDuplicateIP
                              ? "text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 flex items-center w-fit gap-1"
                              : "text-slate-500"
                          }`}>
                            {isDuplicateIP && <AlertTriangle className="w-3.5 h-3.5" />}
                            {s.ipAddress || "unknown"}
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            s.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            s.status === "FORCE_SUBMITTED" ? "bg-rose-100 text-rose-700 font-extrabold border border-rose-200" :
                            s.status === "STARTED" ? "bg-blue-100 text-blue-700 animate-pulse" :
                            "bg-slate-100 text-slate-500"
                          }`}>
                            {s.status.replace("_", " ")}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="px-6 py-4">
                          <div className="w-24">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                              <span>{totalQuestions > 0 ? Math.round((s.answeredCount / totalQuestions) * 100) : 0}%</span>
                              <span>{s.answeredCount}/{totalQuestions}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                                style={{ width: `${totalQuestions > 0 ? (s.answeredCount / totalQuestions) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Violations */}
                        <td className="px-6 py-4">
                          <div className={`flex items-center font-bold ${
                            (s.violationCount || s.tabSwitches) > 0 ? "text-rose-600" : "text-emerald-600"
                          }`}>
                            <AlertTriangle className={`w-3.5 h-3.5 mr-1.5 ${
                              (s.violationCount || s.tabSwitches) > 0 ? "animate-bounce" : "opacity-20"
                            }`} />
                            {s.violationCount || s.tabSwitches} switches
                          </div>
                        </td>

                        {/* Last activity */}
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 opacity-40" />
                            <span>{new Date(s.updatedAt).toLocaleTimeString()}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredSessions.map((s) => {
                const liveness = getLiveness(s, now);
                const isDuplicateIP =
                  s.ipAddress &&
                  s.ipAddress !== "unknown" &&
                  duplicateIpSet.has(s.ipAddress);

                return (
                  <div key={s.studentId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{s.studentName}</div>
                        <div className="text-[11px] font-mono text-slate-400 font-bold">{s.prn}</div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${liveness.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${liveness.dotClass}`} />
                        {liveness.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Status</span>
                        <div className="mt-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            s.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            s.status === "FORCE_SUBMITTED" ? "bg-rose-100 text-rose-700" :
                            s.status === "STARTED" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {s.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Violations</span>
                        <div className={`font-bold mt-0.5 ${
                          (s.violationCount || s.tabSwitches) > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}>
                          {s.violationCount || s.tabSwitches} switches
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Risk Score</span>
                        <div className="font-bold text-slate-800 mt-0.5">
                          {s.riskScore >= 40 ? (
                            <span className="text-rose-600 font-extrabold">{s.riskScore} (High)</span>
                          ) : (
                            <span>{s.riskScore}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400">IP Address</span>
                        <div className={`font-mono text-[11px] mt-0.5 ${isDuplicateIP ? "text-rose-600 font-bold" : "text-slate-600"}`}>
                          {s.ipAddress || "unknown"}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>{s.answeredCount}/{totalQuestions} questions</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${totalQuestions > 0 ? (s.answeredCount / totalQuestions) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Top-level LiveDashboard wrapper with FilterModeProvider set to "history".
 *
 * Trade-off documentation:
 * Filter state is written to window.history.replaceState so that the URL in the browser
 * address bar stays in sync and can be copied/shared, without triggering a Next.js server navigation
 * that would re-fetch the roster on every keystroke or drop the active WebSocket/Pusher connection.
 * Browser back/forward will not step through intermediate filter keystrokes, which is the intended
 * UX for an active real-time monitoring screen.
 */
export default function LiveDashboard(props: LiveDashboardProps) {
  return (
    <FilterModeProvider mode="history">
      <LiveDashboardInner {...props} />
    </FilterModeProvider>
  );
}
