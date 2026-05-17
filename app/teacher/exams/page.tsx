import { getTeacherExams } from "@/app/actions/exam";
import { getTeacherBatches } from "@/app/actions/batch";
import ExamCreator from "./exam-creator";
import DuplicateButton from "./duplicate-button";
import { BookOpen, Users, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function ExamsPage() {
  const [exams, batches] = await Promise.all([
    getTeacherExams(),
    getTeacherBatches(),
  ]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Exams</h2>
          <p className="text-gray-500">Create and manage your assessments.</p>
        </div>
        <ExamCreator batches={batches.map(b => ({ id: b.id, name: b.name }))} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        {exams.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No exams yet</h3>
            <p className="text-gray-500 mt-1">Configure your first exam to start assessing students.</p>
          </div>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="bg-white p-6 rounded-xl shadow-sm border group hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-800">{exam.title}</h3>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded uppercase">
                    {exam.batch.name}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {exam.duration} mins
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-1" />
                    {exam._count.questions} Questions
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {exam._count.sessions} Submissions
                  </div>
                  <div className="text-gray-400 italic">
                    Starts: {new Date(exam.startTime).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mt-4 md:mt-0 flex items-center space-x-3">
                <DuplicateButton examId={exam.id} />
                <Link 
                  href={`/teacher/exams/${exam.id}`}
                  className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Manage Questions
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
