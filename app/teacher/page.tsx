import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { 
  Users, 
  BookOpen, 
  FileCheck, 
  AlertCircle,
  Calendar,
  Clock,
  ArrowRight,
  Activity
} from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions);
  
  // Fetch some basic stats
  const [batchesCount, examsCount, totalSubmissions, cheatAlertsAgg] = await Promise.all([
    prisma.batch.count({ where: { teacherId: session?.user.id } }),
    prisma.exam.count({ where: { batch: { teacherId: session?.user.id } } }),
    prisma.submission.count({ 
      where: { session: { exam: { batch: { teacherId: session?.user.id } } } } 
    }),
    prisma.studentExamSession.aggregate({
      where: { exam: { batch: { teacherId: session?.user.id } } },
      _sum: { tabSwitches: true }
    })
  ]);

  const cheatAlerts = cheatAlertsAgg._sum.tabSwitches || 0;

  const stats = [
    { label: "Active Batches", value: batchesCount, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Total Exams", value: examsCount, icon: BookOpen, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Submissions", value: totalSubmissions, icon: FileCheck, color: "text-green-600", bg: "bg-green-100" },
    { label: "Cheat Alerts", value: cheatAlerts, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
  ];

  const now = new Date();

  // Fetch Recent/Active Exams
  const recentExams = await prisma.exam.findMany({
    where: { 
      batch: { teacherId: session?.user.id },
      startTime: { lte: now }
    },
    orderBy: { startTime: 'desc' },
    take: 4,
    include: { 
      batch: true,
      _count: { select: { sessions: true, questions: true } }
    }
  });

  // Fetch Upcoming Exams
  const upcomingExams = await prisma.exam.findMany({
    where: { 
      batch: { teacherId: session?.user.id },
      startTime: { gt: now }
    },
    orderBy: { startTime: 'asc' },
    take: 4,
    include: { batch: true }
  });

  return (
    <div>
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Welcome back, {session?.user.name}</h2>
          <p className="text-gray-500 mt-1">Here&apos;s an overview of your active exams and batches.</p>
        </div>
        <Link 
          href="/teacher/exams" 
          className="hidden sm:flex items-center px-5 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
        >
          Manage Exams
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl shadow-sm border flex items-center hover:shadow-md transition-shadow">
            <div className={`p-4 rounded-xl ${stat.bg} mr-5`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center text-gray-800">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Recent & Active Exams
            </h3>
            <Link href="/teacher/exams" className="text-sm font-bold text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          
          <div className="flex-1">
            {recentExams.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-400">
                <BookOpen className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium text-gray-500">No active or recent exams.</p>
                <Link href="/teacher/exams" className="mt-4 text-blue-600 font-bold hover:underline">Create your first exam</Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentExams.map(exam => {
                  const isActive = exam.startTime <= now && exam.endTime >= now;
                  return (
                    <Link 
                      key={exam.id} 
                      href={`/teacher/exams/${exam.id}`}
                      className="block p-5 rounded-2xl border bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1">{exam.title}</div>
                        {isActive ? (
                          <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center shrink-0">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1.5"></span>
                            Live
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-wider rounded-full shrink-0">Ended</span>
                        )}
                      </div>
                      <div className="flex items-center text-xs font-semibold text-gray-500 space-x-4">
                        <span className="flex items-center"><Users className="w-3.5 h-3.5 mr-1" /> {exam.batch.name}</span>
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {exam.duration}m</span>
                        <span className="flex items-center"><AlertCircle className="w-3.5 h-3.5 mr-1" /> {exam._count.questions} Qs</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-sm border flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center text-gray-800">
              <Calendar className="w-5 h-5 mr-2 text-purple-600" />
              Upcoming Schedule
            </h3>
          </div>

          <div className="flex-1">
            {upcomingExams.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-400">
                <Calendar className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium text-gray-500">Your schedule is clear for now.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingExams.map(exam => (
                  <div key={exam.id} className="flex items-center p-5 rounded-2xl border border-dashed border-gray-200">
                    <div className="bg-purple-50 text-purple-700 rounded-xl p-3 text-center min-w-[70px] mr-5">
                      <div className="text-xs font-black uppercase">{exam.startTime.toLocaleString('default', { month: 'short' })}</div>
                      <div className="text-2xl font-black">{exam.startTime.getDate()}</div>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 mb-1">{exam.title}</div>
                      <div className="text-xs font-semibold text-gray-500 flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1" />
                        {exam.batch.name}
                        <span className="mx-2">•</span>
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {exam.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <Link 
                      href={`/teacher/exams/${exam.id}`}
                      className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
