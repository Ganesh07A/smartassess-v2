import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
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
  XCircle,
} from "lucide-react";
import LocalTime from "@/ui/local-time";
import { getStudentExamsPaged } from "@/app/actions/exam-filters";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { EmptyState } from "@/ui/filters/empty-state";

export const dynamic = "force-dynamic";

export default async function StudentDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const rawParams = await searchParams;

  // Run student exam list query and overall stats aggregation in parallel
  const [pagedData, statsAgg, totalAssignedCount] = await Promise.all([
    getStudentExamsPaged(rawParams),
    prisma.studentExamSession.aggregate({
      where: {
        studentId: session.user.id,
        status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
      },
      _count: { id: true },
      _sum: { totalScore: true, maxScore: true },
      _avg: { percentage: true },
    }),
    prisma.exam.count({
      where: {
        published: true,
        status: { not: "ARCHIVED" },
        batch: { students: { some: { id: session.user.id } } },
      },
    }),
  ]);

  const examsCompleted = statsAgg._count.id;
  const avgPercentage = statsAgg._avg.percentage ?? 0;
  const pendingCount = Math.max(0, totalAssignedCount - examsCompleted);
  const totalEarned = statsAgg._sum.totalScore ?? 0;

  const stats = [
    {
      label: "Exams Taken",
      value: examsCompleted,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Average Score",
      value: `${avgPercentage.toFixed(1)}%`,
      icon: Trophy,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Pending Exams",
      value: pendingCount,
      icon: Activity,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Points Earned",
      value: totalEarned.toFixed(0),
      icon: Award,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const filterDefs: FilterDef[] = [
    {
      type: "search",
      param: "q",
      label: "Exam",
      placeholder: "Search exam title or subject...",
    },
    {
      type: "facet",
      param: "status",
      label: "Status",
      options: pagedData.facets?.status ?? [],
    },
    {
      type: "date-range",
      param: "date",
      label: "Exam Date",
    },
    {
      type: "sort",
      param: "sort",
      label: "Sort by",
      sortOptions: [
        { value: "startTime", label: "Start Time" },
        { value: "endTime", label: "End Time" },
        { value: "percentage", label: "Performance" },
      ],
    },
  ];

  const now = new Date();

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-12">
      {/* Welcome Header */}
      <header>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">
          Welcome back, {session.user.name?.split(" ")[0]}!
        </h2>
        <p className="text-gray-500 font-medium text-xs mt-1">
          Review your examination schedule, active tests, and verified performance.
        </p>
      </header>

      {/* Verified Stats Grid (Real SQL Aggregations, No Fabricated Rankings) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`p-3 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}
              >
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800">{stat.value}</p>
            <p className="text-xs font-bold text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* Filter Bar */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40">
          <FilterBar defs={filterDefs} />
        </div>

        {/* Examinations List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">
              Assigned Examinations ({pagedData.total})
            </h3>
          </div>

          {pagedData.rows.length === 0 ? (
            <EmptyState
              title="No exams found"
              description="No assigned examinations match your current filter criteria."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pagedData.rows.map((exam) => {
                const s = exam.session;
                const isCompleted =
                  s?.status === "COMPLETED" || s?.status === "FORCE_SUBMITTED";
                const isStarted = s?.status === "STARTED";
                const startTime = new Date(exam.startTime);
                const endTime = new Date(exam.endTime);
                const isUpcoming = now < startTime;
                const isExpired = now > endTime;
                const isMissed = isExpired && !isCompleted;
                const canStart = !isCompleted && !isExpired && !isUpcoming;

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xl shadow-slate-100/30 hover:border-indigo-100 hover:shadow-2xl hover:shadow-slate-200/40 transition-all group relative overflow-hidden"
                  >
                    {canStart && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                            {exam.batch.name}
                          </span>

                          {isCompleted ? (
                            <span className="flex items-center text-emerald-700 bg-emerald-50 border border-emerald-100/60 px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" /> Completed
                            </span>
                          ) : isMissed ? (
                            <span className="flex items-center text-rose-700 bg-rose-50 border border-rose-100/60 px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                              <XCircle className="w-3 h-3 mr-1 text-rose-600" /> Missed
                            </span>
                          ) : isUpcoming ? (
                            <span className="flex items-center text-blue-700 bg-blue-50 border border-blue-100/60 px-2.5 py-0.5 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                              <Lock className="w-3 h-3 mr-1 text-blue-500" /> Scheduled
                            </span>
                          ) : (
                            <span className="flex items-center text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-2.5 py-0.5 text-[10px] font-bold animate-pulse rounded-lg uppercase tracking-wider">
                              <Activity className="w-3 h-3 mr-1 text-indigo-600" /> Active Now
                            </span>
                          )}

                          {isCompleted && s?.percentage !== undefined && (
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/60 text-[10px] font-black rounded-lg">
                              Score: {s.percentage.toFixed(0)}%
                            </span>
                          )}
                        </div>

                        <h4 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {exam.title}
                        </h4>

                        {exam.description && (
                          <p className="text-xs text-slate-400 font-medium line-clamp-1">
                            {exam.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-6 pt-1 text-xs font-bold text-slate-400">
                          <div className="flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1.5 opacity-60" /> {exam.duration} mins
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-60" /> Starts:{" "}
                            <LocalTime dateString={exam.startTime} mode="date" className="ml-1" />
                          </div>
                          <div className="flex items-center">
                            <BookOpen className="w-3.5 h-3.5 mr-1.5 opacity-60" /> {exam._count.questions} Items
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        {isCompleted ? (
                          <Link
                            href={`/student/exams/${exam.id}/result`}
                            className="inline-flex items-center px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                          >
                            Result Analytics
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Link>
                        ) : canStart ? (
                          <Link
                            href={`/student/exams/${exam.id}`}
                            className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all hover:scale-105 active:scale-95"
                          >
                            {isStarted ? "Resume Attempt" : "Launch Exam"}
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Link>
                        ) : isUpcoming ? (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                              Starts at
                            </p>
                            <p className="text-xs font-black text-slate-800">
                              <LocalTime dateString={exam.startTime} />
                            </p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="px-4 py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl inline-block">
                              Closed
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {pagedData.totalPages > 1 && (
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <Pagination
                total={pagedData.total}
                page={pagedData.page}
                perPage={pagedData.perPage}
                totalPages={pagedData.totalPages}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
