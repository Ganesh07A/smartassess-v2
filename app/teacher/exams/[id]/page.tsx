import { prisma } from "@/app/db";
import { requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { ArrowLeft, BookOpen, Calendar, Clock, Users, BarChart, Radio, Sparkles, Check, ShieldAlert, Award } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BulkUpload from "./bulk-upload";
import ManualQuestionAdder from "./manual-adder";
import AIGenerator from "./ai-generator";
import LocalTime from "@/ui/local-time";
import { publishExam } from "@/app/actions/exam";
import { resolveExamStatus } from "@/lib/exams/status";
import { ReleaseResultsButton } from "@/ui/exams/release-results-button";
import { ExamSettingsDialog } from "@/ui/exams/exam-settings-dialog";
import { getExamQuestionsPaged } from "@/app/actions/exam-filters";
import QuestionBankClient from "./question-bank-client";

export const dynamic = 'force-dynamic';

export default async function ExamDetailsPage({ 
  params,
  searchParams,
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawParams = await searchParams;
  const teacher = await requireTeacher();

  const handlePublish = async () => {
    "use server";
    await publishExam(id);
    redirect(`/teacher/exams/${id}/live`);
  };

  const [exam, pagedQuestions, totalPointsAgg] = await Promise.all([
    prisma.exam.findFirst({
      where: { 
        AND: [
          { id },
          teacherExamScope(teacher)
        ]
      },
      include: {
        batch: true,
        sessions: {
          where: { status: { not: "NOT_STARTED" } },
          select: { id: true },
          take: 1,
        },
        _count: {
          select: { certificates: true, sessions: true, questions: true },
        },
      },
    }),
    getExamQuestionsPaged(id, rawParams),
    prisma.examQuestion.aggregate({
      where: { examId: id },
      _sum: { points: true },
    }),
  ]);

  if (!exam) {
    notFound();
  }

  const totalPoints = totalPointsAgg._sum.points ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Breadcrumb / Back button */}
      <div className="flex items-center">
        <Link
          href="/teacher/exams"
          className="flex items-center text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors py-1.5 px-3 hover:bg-gray-100 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Examinations
        </Link>
      </div>

      {/* Main Hero Header Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight leading-tight">
              {exam.title}
            </h2>
            <p className="text-slate-500 text-xs font-medium max-w-xl">
              {exam.description || "No description provided for this examination."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-100/50">
              <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-500" /> 
              {exam.batch.name}
            </span>
            <span className="flex items-center px-3 py-1.5 bg-blue-50/50 text-blue-700 font-bold rounded-xl border border-blue-100/50">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> 
              {exam.duration} Mins
            </span>
            <span className="flex items-center px-3 py-1.5 bg-slate-50 text-slate-600 font-bold rounded-xl border border-slate-100/50">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" /> 
              Starts: <LocalTime dateString={exam.startTime} mode="date" className="ml-1" />
            </span>
            {(() => {
              const status = resolveExamStatus(exam);
              if (status === "ACTIVE") {
                return (
                  <span className="flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100/50">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1.5" />
                    Live
                  </span>
                );
              }
              if (status === "UPCOMING") {
                return (
                  <span className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-100/50">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                    Upcoming
                  </span>
                );
              }
              if (status === "EXPIRED") {
                return (
                  <span className="flex items-center px-3 py-1.5 bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200">
                    Ended
                  </span>
                );
              }
              return (
                <span className="flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 font-bold rounded-xl border border-amber-100/50">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  Draft
                </span>
              );
            })()}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <ExamSettingsDialog
            exam={exam}
            hasStartedSessions={exam.sessions.length > 0}
          />

          <ReleaseResultsButton
            examId={id}
            resultsReleasedAt={exam.resultsReleasedAt}
          />

          {!exam.published ? (
            <form action={handlePublish}>
              <button
                type="submit"
                className="flex items-center justify-center px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-sm text-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                Publish Exam
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center px-3 py-2 bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-xl text-xs select-none">
              <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Published
            </div>
          )}

          <Link
            href={`/teacher/exams/${id}/live`}
            className="flex items-center justify-center px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold rounded-xl transition-colors text-xs"
          >
            <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse text-rose-600" />
            Live Monitor
          </Link>

          <Link
            href={`/teacher/exams/${id}/results`}
            className="flex items-center justify-center px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold rounded-xl transition-colors text-xs"
          >
            <BarChart className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            Results & Analytics
          </Link>

          <Link
            href={`/teacher/exams/${id}/integrity`}
            className="flex items-center justify-center px-3.5 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold rounded-xl transition-colors text-xs"
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
            Integrity Log
          </Link>

          <Link
            href={`/teacher/certificates?exam=${id}`}
            className="flex items-center justify-center px-3.5 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold rounded-xl transition-colors text-xs"
          >
            <Award className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
            Certificates ({exam._count.certificates})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Management Actions Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BulkUpload examId={id} />
          
          <AIGenerator examId={id} />
          
          {/* Manual Addition Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/40 flex flex-col justify-center items-center text-center relative overflow-hidden group/card hover:border-indigo-100/80 transition-all duration-300">
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover/card:opacity-10 transition-opacity">
              <BookOpen className="w-16 h-16 text-indigo-600" />
            </div>
            
            <BookOpen className="w-10 h-10 text-indigo-600 mb-4" />
            <h3 className="text-lg font-black text-slate-800 mb-2">Manual Addition</h3>
            <p className="text-xs text-slate-400 mb-6 px-4 leading-relaxed">
              Add individual MCQs or Coding problems directly to this examination.
            </p>
            <ManualQuestionAdder examId={id} />
          </div>
        </div>

        {/* Questions List & Bank Filterable Container */}
        <QuestionBankClient
          examId={id}
          data={pagedQuestions}
          totalPoints={totalPoints}
        />

      </div>
    </div>
  );
}
