import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { ArrowLeft, BookOpen, Calendar, Clock, Users, BarChart, Radio, Sparkles, HelpCircle, Code, Check } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BulkUpload from "./bulk-upload";
import ManualQuestionAdder from "./manual-adder";
import DeleteQuestionButton from "./delete-button";
import EditQuestionModal from "./edit-modal";
import AIGenerator from "./ai-generator";
import { publishExam } from "@/app/actions/exam";

export const dynamic = 'force-dynamic';

export default async function ExamDetailsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const handlePublish = async () => {
    "use server";
    await publishExam(id);
    redirect(`/teacher/exams/${id}/live`);
  };

  const exam = await prisma.exam.findUnique({
    where: { 
      id,
      batch: { teacherId: session?.user.id }
    },
    include: {
      batch: true,
      questions: {
        include: {
          question: true
        },
        orderBy: {
          order: 'asc'
        }
      }
    }
  });

  if (!exam) {
    notFound();
  }

  const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      
      {/* Breadcrumb / Back button */}
      <div className="flex items-center">
        <Link
          href="/teacher/exams"
          className="flex items-center text-xs font-semibold text-gray-500 hover:text-indigo-650 transition-colors py-1.5 px-3 hover:bg-gray-100 rounded-xl"
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
              Starts: {new Date(exam.startTime).toLocaleDateString()}
            </span>
            {exam.published ? (
              <span className="flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100/50">
                <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                Published
              </span>
            ) : (
              <span className="flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 font-bold rounded-xl border border-amber-100/50">
                <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                Draft
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {!exam.published ? (
            <form action={handlePublish}>
              <button
                type="submit"
                className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all text-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-2 animate-pulse" />
                Publish Exam
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-center px-6 py-3 bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-xl text-xs select-none">
              <Check className="w-4 h-4 mr-2 text-emerald-600" />
              Published
            </div>
          )}

          <Link
            href={`/teacher/exams/${id}/live`}
            className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/10 hover:shadow-red-500/20 active:scale-[0.98] transition-all text-xs"
          >
            <Radio className="w-4 h-4 mr-2 animate-pulse" />
            Monitor Live
          </Link>
          <Link
            href={`/teacher/exams/${id}/results`}
            className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/10 hover:shadow-green-500/20 active:scale-[0.98] transition-all text-xs"
          >
            <BarChart className="w-4 h-4 mr-2" />
            View Results
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

        {/* Questions List Container */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
          
          {/* Questions Header */}
          <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-slate-800 text-sm flex items-center">
              <BookOpen className="w-4.5 h-4.5 mr-2 text-indigo-500" />
              Questions ({exam.questions.length})
            </h3>
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-3.5 py-1.5 rounded-xl">
              Total Score: {totalPoints} Points
            </span>
          </div>

          {/* Questions List Items */}
          <div className="divide-y divide-slate-50">
            {exam.questions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 max-w-sm mx-auto space-y-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
                  <HelpCircle className="w-6 h-6 text-slate-350" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-700 text-sm">No questions added yet</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Build your exam items using AI generation, CSV imports, or the manual creation cards above.
                  </p>
                </div>
              </div>
            ) : (
              exam.questions.map((eq, index) => {
                const isMCQ = eq.question.type === "MCQ";
                return (
                  <div 
                    key={eq.id} 
                    className={`p-6 hover:bg-slate-50/30 transition-all duration-200 flex justify-between items-start group border-l-4 ${
                      isMCQ ? 'border-l-indigo-500' : 'border-l-teal-500'
                    }`}
                  >
                    <div className="flex-1 mr-6 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Question {index + 1}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold ${
                          isMCQ 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/30' 
                            : 'bg-teal-50 text-teal-700 border border-teal-100/30'
                        }`}>
                          {isMCQ ? <BookOpen className="w-2.5 h-2.5 mr-1" /> : <Code className="w-2.5 h-2.5 mr-1" />}
                          {eq.question.type}
                        </span>
                      </div>
                      
                      <p className="text-slate-800 font-bold text-sm leading-relaxed max-w-3xl whitespace-pre-wrap">
                        {eq.question.content}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="text-xs font-black text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-lg">
                        {eq.points} pts
                      </span>
                      
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex items-center space-x-1.5">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <EditQuestionModal examId={id} question={eq.question as any} />
                        <DeleteQuestionButton examId={id} questionId={eq.questionId} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
