import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Award, ArrowLeft, BookOpen, AlertCircle, HelpCircle } from "lucide-react";
import StudentResultExporter from "./student-result-exporter";
import AIExplainer from "./ai-explainer";
import CertificateDownloader from "./certificate-downloader";
import { getCertificate } from "@/app/actions/certificate";

export default async function ExamResultPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    redirect("/login");
  }

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      batch: true,
      questions: {
        include: {
          question: true
        }
      }
    }
  });

  if (!exam) {
    notFound();
  }

  const [examSession, certificate] = await Promise.all([
    prisma.studentExamSession.findUnique({
      where: { 
        studentId_examId: { 
          studentId: session.user.id, 
          examId: id 
        } 
      },
      include: {
        student: {
          select: { name: true, prn: true }
        },
        submissions: true
      }
    }),
    getCertificate(id, session.user.id)
  ]);

  if (!examSession || (examSession.status !== "COMPLETED" && examSession.status !== "FORCE_SUBMITTED")) {
    redirect(`/student/exams/${id}`);
  }

  // Prefer the denormalized totals written at submit time; fall back for legacy rows.
  const computedTotalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
  const totalPoints = examSession.maxScore > 0 ? examSession.maxScore : computedTotalPoints;
  const earnedPoints =
    examSession.maxScore > 0
      ? examSession.totalScore
      : examSession.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0);
  const percentage =
    examSession.maxScore > 0 ? examSession.percentage : totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

  // Answer-key release policy: never show the correct option while other students may still be
  // taking the exam (or before the teacher explicitly releases results).
  const now = new Date();
  const canRevealAnswers =
    exam.answerReveal === "IMMEDIATELY" ||
    (exam.answerReveal === "AFTER_EXAM_END" && now > new Date(exam.endTime)) ||
    (exam.answerReveal === "AFTER_RELEASE" &&
      exam.resultsReleasedAt !== null &&
      now >= new Date(exam.resultsReleasedAt));

  const sanitizedQuestions = exam.questions.map((examQuestion) => ({
    questionId: examQuestion.questionId,
    question: { content: examQuestion.question.content, type: examQuestion.question.type },
  }));
  const sanitizedSubmissions = examSession.submissions.map((submission) => ({
    questionId: submission.questionId,
    isCorrect: submission.isCorrect,
    pointsAwarded: submission.pointsAwarded,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link 
            href="/student" 
            className="inline-flex items-center text-gray-500 hover:text-gray-800 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center space-x-4">
            {certificate && (
              <CertificateDownloader 
                certificate={certificate}
                student={examSession.student}
                exam={exam}
              />
            )}
            <StudentResultExporter 
              student={examSession.student}
              exam={exam}
              score={earnedPoints}
              totalPoints={totalPoints}
              percentage={percentage}
              questions={sanitizedQuestions}
              submissions={sanitizedSubmissions}
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden mb-8">
          <div className="bg-blue-600 p-12 text-center text-white">
            <Award className="w-16 h-16 mx-auto mb-6 opacity-80" />
            <h1 className="text-4xl font-bold mb-2">Exam Results</h1>
            <p className="text-blue-100 text-lg">{exam.title}</p>
          </div>
          
          <div className="p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-gray-50 rounded-2xl p-6 text-center border">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Score</div>
                <div className="text-3xl font-bold text-gray-800">
                  {earnedPoints.toFixed(1)} <span className="text-gray-400 text-lg">/ {totalPoints.toFixed(1)}</span>
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6 text-center border">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Percentage</div>
                <div className="text-3xl font-bold text-blue-600">
                  {percentage.toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-6 text-center border">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Status</div>
                <div className="text-3xl font-bold text-green-600 uppercase">
                  {percentage >= 40 ? "Pass" : "Fail"}
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              Detailed Review
            </h2>

            <div className="space-y-6">
              {exam.questions.map((eq, idx) => {
                const submission = examSession.submissions.find(s => s.questionId === eq.questionId);
                const isCorrect = submission?.isCorrect;
                const q = eq.question;
                
                return (
                  <div key={eq.id} className="rounded-2xl border bg-white overflow-hidden">
                    <div className="p-6 flex items-start">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-500 mr-4 flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-gray-800 font-semibold mb-2">{q.content}</div>
                        <div className="flex items-center space-x-3 mb-4">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border">
                            {q.type}
                          </span>
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded border">
                            {eq.points} Points
                          </span>
                        </div>

                        {/* MCQ Specific Comparison */}
                        {q.type === "MCQ" && canRevealAnswers && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                              <div className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-60">Your Answer</div>
                              <div className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                {submission?.mcqAnswer ? (
                                  `${submission.mcqAnswer}: ${(q.options as Record<string, string>)?.[submission.mcqAnswer as string] || "N/A"}`
                                ) : "Not Answered"}
                              </div>
                            </div>
                            <div className="p-4 rounded-xl border bg-blue-50 border-blue-100">
                              <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-blue-400">Correct Answer</div>
                              <div className="font-bold text-blue-700">
                                {q.correctAnswer}: {(q.options as Record<string, string>)?.[q.correctAnswer as string] || "N/A"}
                              </div>
                            </div>
                          </div>
                        )}

                        {q.type === "MCQ" && !canRevealAnswers && (
                          <p className="mt-4 text-xs font-semibold text-gray-400">
                            Your answer is recorded. The correct option will be shown once the exam window closes.
                          </p>
                        )}

                        {/* Coding Specific Status */}
                        {q.type === "CODING" && (
                          <div className="mt-4 p-4 rounded-xl border bg-gray-50">
                            <div className="text-[10px] font-black uppercase tracking-widest mb-2 text-gray-400">Submission Details</div>
                            <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-3 font-mono">
                              {submission?.codeAnswer || "// No code submitted"}
                            </pre>
                            <div className="flex items-center text-sm font-medium">
                              <AlertCircle className="w-4 h-4 mr-2 text-blue-500" />
                              <span className="text-gray-600">Points Awarded: {submission?.pointsAwarded?.toFixed(1) || "0.0"} / {eq.points}</span>
                            </div>

                            {submission?.codeAnswer && (
                              <AIExplainer 
                                questionContent={q.content}
                                code={submission.codeAnswer}
                                pointsAwarded={submission.pointsAwarded || 0}
                                totalPoints={eq.points}
                              />
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 flex-shrink-0">
                        {isCorrect ? (
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        ) : submission?.pointsAwarded && submission.pointsAwarded > 0 ? (
                          <HelpCircle className="w-8 h-8 text-yellow-500" />
                        ) : (
                          <XCircle className="w-8 h-8 text-red-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/student"
            className="inline-flex items-center px-8 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-gray-200"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
