import { getStudentExams } from "@/app/actions/exam";
import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  BookOpen, 
  Clock, 
  Calendar, 
  ArrowRight, 
  CheckCircle, 
  Lock,
  Award,
  Activity,
  Trophy,
  AlertCircle
} from "lucide-react";

export default async function StudentDashboard({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { filter } = await searchParams;
  let exams = await getStudentExams();
  
  // Apply filters
  if (filter === "active") {
    exams = exams.filter(e => {
      const now = new Date();
      return now >= new Date(e.startTime) && now <= new Date(e.endTime) && e.sessions[0]?.status !== "COMPLETED";
    });
  } else if (filter === "completed") {
    exams = exams.filter(e => e.sessions[0]?.status === "COMPLETED");
  }
  
  // Calculate student stats
  const completedExams = exams.filter(e => e.sessions[0]?.status === "COMPLETED");
  const upcomingExams = exams.filter(e => new Date(e.startTime) > new Date());
  
  // Get detailed scores for the summary card
  const examSessions = await prisma.studentExamSession.findMany({
    where: { 
      studentId: session.user.id,
      status: "COMPLETED"
    },
    include: {
      submissions: true,
      exam: {
        include: {
          questions: true
        }
      }
    }
  });

  const totalEarned = examSessions.reduce((acc, s) => acc + s.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0), 0);
  const totalPossible = examSessions.reduce((acc, s) => acc + s.exam.questions.reduce((sum, q) => sum + q.points, 0), 0);
  const avgScore = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

  const stats = [
    { label: "Exams Taken", value: examSessions.length, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Average Score", value: `${avgScore.toFixed(1)}%`, icon: Trophy, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Exams", value: exams.filter(e => e.sessions[0]?.status !== "COMPLETED").length, icon: Activity, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Points Earned", value: totalEarned.toFixed(0), icon: Award, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <header>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Welcome back, {session.user.name?.split(' ')[0]}!</h2>
        <p className="text-gray-500 font-medium mt-1">Check your examination schedule and performance below.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Rank: #12</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
            <p className="text-[13px] font-bold text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Main Exam List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">Scheduled Examinations</h3>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <Link 
                href="/student" 
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!filter ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All
              </Link>
              <Link 
                href="/student?filter=active" 
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filter === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Active
              </Link>
              <Link 
                href="/student?filter=completed" 
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${filter === 'completed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Completed
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {exams.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-gray-100 p-16 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-gray-200" />
                </div>
                <h3 className="text-lg font-bold text-gray-800">No Exams Found</h3>
                <p className="text-gray-400 text-sm font-medium mt-1">Your schedule is currently clear. Contact your instructor if this is a mistake.</p>
              </div>
            ) : (
              exams.map((exam) => {
                const session = exam.sessions[0];
                const isCompleted = session?.status === "COMPLETED";
                const isStarted = session?.status === "STARTED";
                const now = new Date();
                const startTime = new Date(exam.startTime);
                const endTime = new Date(exam.endTime);
                const isUpcoming = now < startTime;
                const isExpired = now > endTime;
                const canStart = !isCompleted && !isExpired && !isUpcoming;

                return (
                  <div key={exam.id} className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 transition-all group relative overflow-hidden">
                    {canStart && <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>}
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                            {exam.batch.name}
                          </span>
                          {isCompleted ? (
                            <span className="flex items-center text-green-600 text-[10px] font-black uppercase tracking-wider">
                              <CheckCircle className="w-3 h-3 mr-1" /> Completed
                            </span>
                          ) : isUpcoming ? (
                            <span className="flex items-center text-gray-400 text-[10px] font-black uppercase tracking-wider">
                              <Lock className="w-3 h-3 mr-1" /> Scheduled
                            </span>
                          ) : isExpired ? (
                            <span className="text-red-500 text-[10px] font-black uppercase tracking-wider">Time Expired</span>
                          ) : (
                            <span className="flex items-center text-blue-600 text-[10px] font-black animate-pulse uppercase tracking-wider">
                              <Activity className="w-3 h-3 mr-1" /> Active Now
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">{exam.title}</h3>
                        <div className="flex items-center space-x-6 mt-3">
                          <div className="flex items-center text-xs font-bold text-gray-400">
                            <Clock className="w-3.5 h-3.5 mr-1.5 opacity-50" /> {exam.duration}m
                          </div>
                          <div className="flex items-center text-xs font-bold text-gray-400">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-50" /> {startTime.toLocaleDateString()}
                          </div>
                          <div className="flex items-center text-xs font-bold text-gray-400">
                            <BookOpen className="w-3.5 h-3.5 mr-1.5 opacity-50" /> {exam._count.questions} Questions
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCompleted ? (
                          <Link 
                            href={`/student/exams/${exam.id}/result`}
                            className="inline-flex items-center px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-colors"
                          >
                            Result Analytics
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Link>
                        ) : canStart ? (
                          <Link 
                            href={`/student/exams/${exam.id}`}
                            className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                          >
                            {isStarted ? "Resume Attempt" : "Launch Exam"}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Link>
                        ) : isUpcoming ? (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Starts at</p>
                            <p className="text-sm font-black text-gray-900">{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        ) : (
                          <button disabled className="px-6 py-2.5 bg-gray-50 text-gray-300 text-sm font-bold rounded-xl cursor-not-allowed">
                            Access Locked
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Sidebar - Notifications & Activity */}
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-gray-100 p-8">
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center">
              <Activity className="w-4 h-4 mr-2 text-blue-600" />
              Latest Activity
            </h4>
            <div className="space-y-6">
              {examSessions.slice(0, 3).map(session => (
                <div key={session.id} className="flex items-start space-x-4">
                  <div className="w-2 h-2 mt-1.5 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Completed "{session.exam.title}"</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">{new Date(session.updatedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {upcomingExams.length > 0 && (
                <div className="flex items-start space-x-4">
                  <div className="w-2 h-2 mt-1.5 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Assigned: {upcomingExams[0].title}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5">Prepare for launch</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 text-white relative overflow-hidden group">
            <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 group-hover:scale-110 transition-transform duration-700" />
            <div className="relative z-10">
              <Award className="w-10 h-10 text-blue-400 mb-4" />
              <h4 className="text-xl font-black mb-2">Platform Rank</h4>
              <p className="text-gray-400 text-sm font-medium mb-6">You're in the top 15% of students this semester. Keep it up!</p>
              <button className="w-full py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-colors">
                View Leaderboard
              </button>
            </div>
          </div>

          <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100 flex items-start">
            <AlertCircle className="w-5 h-5 text-orange-600 mr-3 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-black text-orange-900 uppercase tracking-widest mb-1">System Note</p>
              <p className="text-xs font-bold text-orange-700/80 leading-relaxed">
                Ensure you have a stable internet connection before launching any exam. Tab-switching is strictly monitored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

