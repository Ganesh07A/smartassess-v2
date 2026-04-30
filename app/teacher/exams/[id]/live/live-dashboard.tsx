"use client";

import { useState, useEffect } from "react";
import { pusherClient } from "@/app/lib/pusher-client";
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  User as UserIcon
} from "lucide-react";

interface StudentSession {
  studentId: string;
  studentName: string;
  prn: string;
  status: string;
  answeredCount: number;
  tabSwitches: number;
  startTime: string | Date;
  updatedAt: string | Date;
}

interface LiveDashboardProps {
  examId: string;
  initialSessions: StudentSession[];
  totalQuestions: number;
}

export default function LiveDashboard({ 
  examId, 
  initialSessions, 
  totalQuestions 
}: LiveDashboardProps) {
  const [sessions, setSessions] = useState<Record<string, StudentSession>>(() => {
    const map: Record<string, StudentSession> = {};
    initialSessions.forEach(s => {
      map[s.studentId] = s;
    });
    return map;
  });

  const [alerts, setAlerts] = useState<{ id: string; message: string; type: 'warning' | 'info' }[]>([]);

  useEffect(() => {
    if (!pusherClient) return;

    const channel = pusherClient.subscribe(`exam-${examId}`);

    channel.bind("student-joined", (data: any) => {
      setSessions(prev => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          studentId: data.studentId,
          studentName: data.studentName,
          prn: data.prn,
          status: "STARTED",
          startTime: data.startTime,
          updatedAt: new Date().toISOString(),
          answeredCount: prev[data.studentId]?.answeredCount || 0,
          tabSwitches: prev[data.studentId]?.tabSwitches || 0,
        }
      }));
      addAlert(`${data.studentName} joined the exam`, 'info');
    });

    channel.bind("tab-switch", (data: any) => {
      setSessions(prev => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          tabSwitches: data.totalSwitches,
          updatedAt: new Date().toISOString(),
        }
      }));
      addAlert(`${data.studentName} switched tabs! (Total: ${data.totalSwitches})`, 'warning');
    });

    channel.bind("answer-saved", (data: any) => {
      setSessions(prev => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          answeredCount: data.answeredCount,
          updatedAt: new Date().toISOString(),
        }
      }));
    });

    channel.bind("student-submitted", (data: any) => {
      setSessions(prev => ({
        ...prev,
        [data.studentId]: {
          ...prev[data.studentId],
          status: "COMPLETED",
          updatedAt: new Date().toISOString(),
        }
      }));
      const name = sessions[data.studentId]?.studentName || "A student";
      addAlert(`${name} submitted the exam`, 'info');
    });

    return () => {
      pusherClient.unsubscribe(`exam-${examId}`);
    };
  }, [examId, sessions]);

  const addAlert = (message: string, type: 'warning' | 'info') => {
    const id = Math.random().toString(36).substring(7);
    setAlerts(prev => [{ id, message, type }, ...prev].slice(0, 5));
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== id));
    }, 5000);
  };

  const sessionList = Object.values(sessions).sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const activeCount = sessionList.filter(s => s.status === "STARTED").length;
  const completedCount = sessionList.filter(s => s.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mr-4">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Active Students</div>
            <div className="text-2xl font-bold text-gray-800">{activeCount}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mr-4">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Submissions</div>
            <div className="text-2xl font-bold text-gray-800">{completedCount}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center mr-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm text-gray-500 font-medium">Recent Warnings</div>
            <div className="text-2xl font-bold text-gray-800">
              {sessionList.reduce((acc, s) => acc + s.tabSwitches, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Live Alerts Overlay */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col space-y-2">
        {alerts.map(alert => (
          <div 
            key={alert.id}
            className={`px-6 py-3 rounded-xl shadow-2xl border flex items-center animate-in slide-in-from-right duration-300 ${
              alert.type === 'warning' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}
          >
            {alert.type === 'warning' ? <AlertTriangle className="w-5 h-5 mr-3" /> : <Activity className="w-5 h-5 mr-3" />}
            <span className="font-bold">{alert.message}</span>
          </div>
        ))}
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Live Student Monitor
          </h3>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Auto-refreshing via Pusher
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Progress</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Anti-Cheat</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessionList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Waiting for students to join...
                  </td>
                </tr>
              ) : (
                sessionList.map((s) => (
                  <tr key={s.studentId} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mr-3 border">
                          <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{s.studentName}</div>
                          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">{s.prn}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                        s.status === 'STARTED' ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-[100px]">
                        <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
                          <span>{Math.round((s.answeredCount / totalQuestions) * 100)}%</span>
                          <span>{s.answeredCount}/{totalQuestions}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 transition-all duration-500"
                            style={{ width: `${(s.answeredCount / totalQuestions) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center font-bold ${s.tabSwitches > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        <AlertTriangle className={`w-4 h-4 mr-2 ${s.tabSwitches > 0 ? 'animate-bounce' : 'opacity-20'}`} />
                        {s.tabSwitches} Switches
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">
                      <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                        {new Date(s.updatedAt).toLocaleTimeString()}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
