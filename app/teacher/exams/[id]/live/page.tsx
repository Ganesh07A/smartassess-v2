import { prisma } from "@/app/db";
import { requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { notFound } from "next/navigation";
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

  const exam = await prisma.exam.findFirst({
    where: { 
      AND: [
        { id },
        teacherExamScope(teacher)
      ]
    },
    include: {
      batch: true,
      _count: {
        select: { questions: true }
      }
    }
  });

  if (!exam) {
    notFound();
  }

  // Fetch initial student sessions (bounded)
  const studentSessions = await prisma.studentExamSession.findMany({
    where: { examId: id },
    take: 200,
    include: {
      student: {
        select: { name: true, prn: true }
      },
      _count: {
        select: { submissions: true }
      }
    }
  });

  const formattedSessions = studentSessions.map(s => ({
    studentId: s.studentId,
    studentName: s.student.name || "Unknown",
    prn: s.student.prn || "N/A",
    status: s.status,
    answeredCount: s._count.submissions,
    tabSwitches: s.tabSwitches,
    startTime: s.startTime || s.createdAt,
    updatedAt: s.updatedAt,
    ipAddress: s.ipAddress || "unknown",
  }));

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
        initialSessions={formattedSessions} 
        totalQuestions={exam._count.questions} 
      />
    </div>
  );
}
