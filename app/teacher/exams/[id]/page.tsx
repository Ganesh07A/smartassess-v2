import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ArrowLeft, BookOpen, Calendar, Clock, Users, BarChart, Radio } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BulkUpload from "./bulk-upload";
import ManualQuestionAdder from "./manual-adder";
import DeleteQuestionButton from "./delete-button";
import EditQuestionModal from "./edit-modal";
import AIGenerator from "./ai-generator";

export default async function ExamDetailsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center">
          <Link
            href="/teacher/exams"
            className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-4"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{exam.title}</h2>
            <div className="flex items-center text-xs font-bold text-gray-500 mt-1 space-x-4 uppercase tracking-wider">
              <span className="flex items-center"><Users className="w-3.5 h-3.5 mr-1.5" /> {exam.batch.name}</span>
              <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1.5" /> {exam.duration} mins</span>
              <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" /> {new Date(exam.startTime).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <Link
            href={`/teacher/exams/${id}/live`}
            className="flex items-center px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all text-sm"
          >
            <Radio className="w-4 h-4 mr-2 animate-pulse" />
            Monitor Live
          </Link>
          <Link
            href={`/teacher/exams/${id}/results`}
            className="flex items-center px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all text-sm"
          >
            <BarChart className="w-4 h-4 mr-2" />
            View Results
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Management Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BulkUpload examId={id} />
          <AIGenerator examId={id} />
          <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-center items-center text-center">
            <BookOpen className="w-10 h-10 text-blue-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-gray-800">Manual Addition</h3>
            <p className="text-sm text-gray-500 mb-6 px-4">Add individual MCQs or Coding problems directly to this exam.</p>
            <ManualQuestionAdder examId={id} />
          </div>
        </div>

        {/* Questions List */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Questions ({exam.questions.length})</h3>
            <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Total Points: {exam.questions.reduce((sum, q) => sum + q.points, 0)}
            </span>
          </div>
          <div className="divide-y">
            {exam.questions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No questions added yet. Use the actions above to add questions.</p>
              </div>
            ) : (
              exam.questions.map((eq, index) => (
                <div key={eq.id} className="p-6 hover:bg-gray-50 transition-colors flex justify-between items-start group">
                  <div className="flex-1 mr-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Question {index + 1} • {eq.question.type}
                      </span>
                      <span className="text-sm font-bold text-black">{eq.points} pts</span>
                    </div>
                    <p className="text-black font-semibold line-clamp-2">{eq.question.content}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <EditQuestionModal examId={id} question={eq.question as any} />
                    <DeleteQuestionButton examId={id} questionId={eq.questionId} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
