import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Layers } from "lucide-react";
import QuestionBuilderForm from "./question-builder-form";

export const dynamic = 'force-dynamic';

export default async function AddQuestionPage({
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
        }
      }
    }
  });

  if (!exam) {
    notFound();
  }

  const currentPoints = exam.questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/teacher/exams/${id}`}
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-1.5 px-3 hover:bg-gray-100 rounded-xl mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to {exam.title}
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 rounded-2xl border border-indigo-100/50">
              <Layers className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Question Builder</h2>
              <p className="text-xs text-slate-500 font-medium">Add new MCQ or Coding question to your exam.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-center">
          <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-3.5 py-2 rounded-xl flex items-center">
            <BookOpen className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
            {exam.questions.length} Questions
          </span>
          <span className="text-xs font-black text-slate-700 bg-slate-100/80 px-3.5 py-2 rounded-xl">
            Total Score: {currentPoints} pts
          </span>
        </div>
      </div>

      {/* Builder Form */}
      <QuestionBuilderForm examId={id} />
    </div>
  );
}
