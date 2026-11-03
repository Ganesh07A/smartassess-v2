import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  CheckCircle2,
  XCircle,
  Award,
  ArrowLeft,
  BookOpen,
  AlertCircle,
  HelpCircle,
  Layers,
  Clock,
  FileText,
  User,
  AlertTriangle,
} from "lucide-react";
import StudentResultExporter from "./student-result-exporter";
import AIExplainer from "./ai-explainer";
import CertificateDownloader from "./certificate-downloader";
import { getCertificate } from "@/app/actions/certificate";
import { buildStudentTopicBreakdown } from "@/lib/analytics/topics";
import LocalTime from "@/ui/local-time";

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
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
          question: true,
        },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  const [examSession, certificate] = await Promise.all([
    prisma.studentExamSession.findUnique({
      where: {
        studentId_examId: {
          studentId: session.user.id,
          examId: id,
        },
      },
      include: {
        student: {
          select: { name: true, prn: true },
        },
        submissions: true,
      },
    }),
    getCertificate(id, session.user.id),
  ]);

  if (!examSession || (examSession.status !== "COMPLETED" && examSession.status !== "FORCE_SUBMITTED")) {
    redirect(`/student/exams/${id}`);
  }

  const now = new Date();
  const isResultsReleased = Boolean(exam.resultsReleasedAt && now >= new Date(exam.resultsReleasedAt));
  const isSuspended = examSession.status === "FORCE_SUBMITTED";

  // Denormalized scores
  const computedTotalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
  const totalPoints = examSession.maxScore > 0 ? examSession.maxScore : computedTotalPoints;
  const earnedPoints =
    examSession.maxScore > 0
      ? examSession.totalScore
      : examSession.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0);
  const percentage =
    examSession.maxScore > 0 ? examSession.percentage : totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

  const answeredCount = examSession.submissions.filter(
    (s) => s.mcqAnswer !== null || (s.codeAnswer !== null && s.codeAnswer.trim().length > 0),
  ).length;

  // Answer-key release policy for released results view
  const canRevealAnswers =
    exam.answerReveal === "IMMEDIATELY" ||
    (exam.answerReveal === "AFTER_EXAM_END" && now > new Date(exam.endTime)) ||
    (exam.answerReveal === "AFTER_RELEASE" && isResultsReleased);

  const sanitizedQuestions = exam.questions.map((examQuestion) => ({
    questionId: examQuestion.questionId,
    question: { content: examQuestion.question.content, type: examQuestion.question.type },
  }));
  const sanitizedSubmissions = examSession.submissions.map((submission) => ({
    questionId: submission.questionId,
    isCorrect: submission.isCorrect,
    pointsAwarded: submission.pointsAwarded,
  }));

  // =========================================================================
  // VIEW 1: CET-Style Submission Receipt (When Teacher Has NOT Released Results)
  // =========================================================================
  if (!isResultsReleased) {
    return (
      <div className="min-h-screen bg-slate-50/70 p-6 sm:p-10 pb-24">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Back Navigation */}
          <div>
            <Link
              href="/student"
              className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Dashboard
            </Link>
          </div>

          {/* Submission Receipt Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-100/50 overflow-hidden">
            {/* Header Banner */}
            <div
              className={`p-8 sm:p-10 text-center text-white ${
                isSuspended
                  ? "bg-gradient-to-br from-rose-600 to-rose-700"
                  : "bg-gradient-to-br from-emerald-600 via-teal-600 to-slate-800"
              }`}
            >
              {isSuspended ? (
                <AlertTriangle className="w-14 h-14 mx-auto mb-4 text-rose-200" />
              ) : (
                <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-emerald-200" />
              )}
              <h1 className="text-3xl font-black tracking-tight mb-2">
                {isSuspended ? "Exam Attempt Suspended" : "Exam Submitted Successfully"}
              </h1>
              <p className="text-emerald-100 text-sm font-medium max-w-md mx-auto">
                {exam.title} &bull; {exam.batch.name}
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-white">
                <Clock className="w-3.5 h-3.5" />
                {isSuspended ? "Terminated by Proctor" : "Under Instructor Review"}
              </div>
            </div>

            {/* Receipt Metadata Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <User className="w-3.5 h-3.5 mr-1.5" /> Candidate Name
                  </div>
                  <div className="text-sm font-black text-slate-800">
                    {examSession.student.name || "N/A"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <FileText className="w-3.5 h-3.5 mr-1.5" /> Candidate PRN
                  </div>
                  <div className="text-sm font-black text-slate-800 font-mono">
                    {examSession.student.prn || "N/A"}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <Clock className="w-3.5 h-3.5 mr-1.5" /> Submission Timestamp
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {examSession.submittedAt ? (
                      <LocalTime dateString={examSession.submittedAt} mode="datetime" />
                    ) : (
                      "Recorded"
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">
                    <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Questions Attempted
                  </div>
                  <div className="text-sm font-black text-indigo-600">
                    {answeredCount} of {exam.questions.length} Answered
                  </div>
                </div>
              </div>

              {/* Informational Policy Alert */}
              <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-start gap-3.5">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-black text-blue-950">Result Governance Policy</p>
                  <p className="text-blue-800 leading-relaxed font-medium">
                    Your answers have been securely submitted and archived. To protect the integrity of the examination while other candidates complete their sessions, scores, marks, answer keys, performance analysis, and certificates are confidential until explicitly released by your instructor.
                  </p>
                </div>
              </div>

              {/* Question Attempt Status Summary (Without revealing answers or correctness) */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Response Log ({exam.questions.length} Items)
                </h3>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white">
                  {exam.questions.map((eq, idx) => {
                    const sub = examSession.submissions.find((s) => s.questionId === eq.questionId);
                    const isAnswered = Boolean(
                      sub?.mcqAnswer || (sub?.codeAnswer && sub.codeAnswer.trim().length > 0),
                    );

                    return (
                      <div
                        key={eq.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700 truncate max-w-md">
                            {eq.question.content}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {eq.question.type}
                          </span>
                          {isAnswered ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                              Recorded
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              Unanswered
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 text-center">
                <Link
                  href="/student"
                  className="inline-flex items-center px-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Released Results (Full Analytics, Answers & Certificates)
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-50 p-8 pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            href="/student"
            className="inline-flex items-center text-gray-500 hover:text-gray-800 transition-colors font-medium text-xs font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>

          <div className="flex items-center space-x-4">
            {certificate && (
              <CertificateDownloader
                certificate={certificate}
                student={examSession.student}
                exam={{ title: exam.title }}
              />
            )}
            <StudentResultExporter
              student={examSession.student}
              exam={{ title: exam.title, batch: { name: exam.batch.name } }}
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

            {/* Individual Student Topic Mastery (§7.2) */}
            {(() => {
              const topicBreakdown = buildStudentTopicBreakdown({
                questions: exam.questions.map((eq) => ({
                  questionId: eq.questionId,
                  points: eq.points,
                  topic: eq.question.topic,
                })),
                submissions: examSession.submissions.map((sub) => ({
                  questionId: sub.questionId,
                  pointsAwarded: sub.pointsAwarded,
                })),
              });

              if (topicBreakdown.length === 0) return null;

              return (
                <div className="mb-12 bg-white rounded-2xl border p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-gray-900 text-sm">Topic Mastery Breakdown</h3>
                    </div>
                    <span className="text-[11px] text-gray-400 font-medium">Weakest topics listed first</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {topicBreakdown.map((t) => (
                      <div key={t.topic} className="p-3.5 rounded-xl border bg-gray-50/50 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <span>{t.topic}</span>
                              {t.lowConfidence && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700">
                                  Low confidence (&lt; 3 items)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {t.earnedPoints} / {t.maxPoints} pts ({t.itemCount} question{t.itemCount > 1 ? "s" : ""})
                            </div>
                          </div>
                          <span className="font-bold text-xs text-gray-900">{t.percentage.toFixed(0)}%</span>
                        </div>

                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              t.percentage >= 70 ? "bg-green-500" : t.percentage >= 40 ? "bg-blue-500" : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(100, t.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              Detailed Review
            </h2>

            {!canRevealAnswers && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-800">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-900">Results Under Review</p>
                  <p className="mt-0.5 leading-relaxed text-blue-700">
                    Your answers are saved securely. Your teacher will release detailed scores, answer keys, and explanations once grading is finalized.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {exam.questions.map((eq, idx) => {
                const submission = examSession.submissions.find((s) => s.questionId === eq.questionId);
                const isCorrect = submission?.isCorrect;
                const q = eq.question;

                return (
                  <div key={eq.id} id={`question-${eq.questionId}`} className="rounded-2xl border bg-white overflow-hidden scroll-mt-6">
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
            className="inline-flex items-center px-8 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-colors shadow-lg shadow-gray-200 text-xs uppercase tracking-wider"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
