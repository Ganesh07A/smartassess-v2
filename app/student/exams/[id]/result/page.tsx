import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Award, ArrowLeft, BookOpen } from "lucide-react";

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

  const examSession = await prisma.studentExamSession.findUnique({
    where: { 
      studentId_examId: { 
        studentId: session.user.id, 
        examId: id 
      } 
    },
    include: {
      submissions: true
    }
  });

  if (!examSession || examSession.status !== "COMPLETED") {
    redirect(`/student/exams/${id}`);
  }

  const totalPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = examSession.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0);
  const percentage = (earnedPoints / totalPoints) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/student" 
          className="inline-flex items-center text-gray-500 hover:text-gray-800 mb-8 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border overflow-hidden mb-8">
          <div className="bg-blue-600 p-12 text-center text-white">
            <Award className="w-16 h-16 mx-auto mb-6 opacity-80" />
            <h1 className="text-4xl font-bold mb-2">Exam Results</h1>
            <p className="text-blue-100 text-lg">{exam.title}</p>
          </div>
          
          <div className="p-12">
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
                  Pass
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
              Question Breakdown
            </h2>

            <div className="space-y-4">
              {exam.questions.map((eq, idx) => {
                const submission = examSession.submissions.find(s => s.questionId === eq.questionId);
                const isCorrect = submission?.isCorrect;
                
                return (
                  <div key={eq.id} className="flex items-center p-6 rounded-2xl border bg-white hover:shadow-sm transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-500 mr-6">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-800 font-medium mb-1 line-clamp-1">{eq.question.content}</div>
                      <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                        {eq.question.type} • {eq.points} Points
                      </div>
                    </div>
                    <div className="flex items-center ml-6">
                      {isCorrect ? (
                        <div className="flex items-center text-green-600 font-bold text-sm bg-green-50 px-4 py-2 rounded-full border border-green-100">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Correct
                        </div>
                      ) : submission?.pointsAwarded && submission.pointsAwarded > 0 ? (
                        <div className="flex items-center text-yellow-600 font-bold text-sm bg-yellow-50 px-4 py-2 rounded-full border border-yellow-100">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Partial ({submission.pointsAwarded.toFixed(1)})
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600 font-bold text-sm bg-red-50 px-4 py-2 rounded-full border border-red-100">
                          <XCircle className="w-4 h-4 mr-2" />
                          Incorrect
                        </div>
                      )}
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
