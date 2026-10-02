import { prisma } from "@/app/db";
import { assertExamAccess, requireTeacher } from "@/lib/auth/scope";
import LiveDashboard from "./live-dashboard";
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function LiveMonitorPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const teacher = await requireTeacher();

  const exam = await assertExamAccess(id, teacher, {
    id: true,
    title: true,
    batchId: true,
    batch: { select: { id: true, name: true } },
    _count: {
      select: { questions: true }
    }
  });

  const ROSTER_CAP = 1000;

  // Fetch initial student sessions and the batch roster in parallel (bounded)
  const [sessions, roster] = await Promise.all([
    prisma.studentExamSession.findMany({
      where: { examId: id },
      take: ROSTER_CAP,
      select: {
        id: true,
        studentId: true,
        status: true,
        violationCount: true,
        tabSwitches: true,
        riskScore: true,
        lastHeartbeatAt: true,
        startTime: true,
        createdAt: true,
        updatedAt: true,
        ipAddress: true,
        student: {
          select: { id: true, name: true, prn: true, email: true }
        },
        _count: {
          select: { submissions: true }
        }
      }
    }),
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        enrolledBatches: { some: { id: exam.batchId } }
      },
      select: { id: true, name: true, prn: true },
      take: ROSTER_CAP
    })
  ]);

  // Index active/past sessions by studentId
  const sessionByStudentId = new Map(sessions.map((s) => [s.studentId, s]));

  // Merge batch roster: every enrolled student appears, even if they have not started
  const mergedSessions = roster.map((student) => {
    const s = sessionByStudentId.get(student.id);
    if (s) {
      sessionByStudentId.delete(student.id); // Mark handled
      return {
        studentId: student.id,
        studentName: s.student.name || student.name || "Unknown",
        prn: s.student.prn || student.prn || "N/A",
        status: s.status,
        answeredCount: s._count.submissions,
        tabSwitches: s.tabSwitches,
        violationCount: s.violationCount || s.tabSwitches,
        riskScore: s.riskScore || 0,
        lastHeartbeatAt: s.lastHeartbeatAt ? s.lastHeartbeatAt.toISOString() : null,
        startTime: (s.startTime || s.createdAt).toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        ipAddress: s.ipAddress || "unknown"
      };
    }
    return {
      studentId: student.id,
      studentName: student.name || "Unknown",
      prn: student.prn || "N/A",
      status: "NOT_STARTED",
      answeredCount: 0,
      tabSwitches: 0,
      violationCount: 0,
      riskScore: 0,
      lastHeartbeatAt: null,
      startTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ipAddress: "unknown"
    };
  });

  // Append any sessions belonging to students not in the roster query
  for (const s of sessionByStudentId.values()) {
    mergedSessions.push({
      studentId: s.studentId,
      studentName: s.student.name || "Unknown",
      prn: s.student.prn || "N/A",
      status: s.status,
      answeredCount: s._count.submissions,
      tabSwitches: s.tabSwitches,
      violationCount: s.violationCount || s.tabSwitches,
      riskScore: s.riskScore || 0,
      lastHeartbeatAt: s.lastHeartbeatAt ? s.lastHeartbeatAt.toISOString() : null,
      startTime: (s.startTime || s.createdAt).toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      ipAddress: s.ipAddress || "unknown"
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href={`/teacher/exams/${id}`}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors mr-4"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h2 className="text-3xl font-bold text-gray-800">Live Monitor</h2>
              <span className="flex items-center px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                <Radio className="w-3 h-3 mr-2" />
                Live
              </span>
            </div>
            <p className="text-gray-500 font-medium">
              Monitoring <span className="text-blue-600">{exam.title}</span> • {exam.batch.name}
            </p>
          </div>
        </div>
      </div>

      <LiveDashboard 
        examId={id} 
        initialSessions={mergedSessions} 
        totalQuestions={exam._count.questions} 
      />
    </div>
  );
}
