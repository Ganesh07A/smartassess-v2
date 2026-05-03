import { getExamResults, getExamAnalytics } from "@/app/actions/exam";
import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Table, BarChart3 } from "lucide-react";
import ResultExporter from "./result-exporter";
import AnalyticsDashboard from "./analytics-dashboard";

export const dynamic = 'force-dynamic';

export default async function ExamResultsPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params;
  const { tab = "table" } = await searchParams;
  const session = await getServerSession(authOptions);
  
  const exam = await prisma.exam.findUnique({
    where: { 
      id,
      batch: { teacherId: session?.user.id }
    },
    include: {
      batch: true,
      _count: {
        select: { questions: true }
      }
    }
  });

  if (!exam) {
    notFound();
  }

  const results = await getExamResults(id);
  const analytics = await getExamAnalytics(id);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href={`/teacher/exams/${id}`}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-4"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Results: {exam.title}</h2>
            <p className="text-gray-500 font-medium">{exam.batch.name} • {exam._count.questions} Questions</p>
          </div>
        </div>
        <ResultExporter exam={exam} results={results} />
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
        <Link
          href={`/teacher/exams/${id}/results?tab=table`}
          className={`flex items-center px-6 py-2 rounded-lg font-bold transition-all ${
            tab === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Table className="w-4 h-4 mr-2" />
          Submissions
        </Link>
        <Link
          href={`/teacher/exams/${id}/results?tab=analytics`}
          className={`flex items-center px-6 py-2 rounded-lg font-bold transition-all ${
            tab === 'analytics' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Advanced Analytics
        </Link>
      </div>

      {tab === 'analytics' ? (
        <AnalyticsDashboard analytics={analytics} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">PRN</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Correct</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total Score</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Last Update</th>
                </tr>
              </thead>
              <tbody className="divide-y text-black font-semibold">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-normal">
                      No submissions found for this exam yet.
                    </td>
                  </tr>
                ) : (
                  results.map((res) => (
                    <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-bold text-black">{res.student.name}</div>
                          <div className="text-xs text-gray-500 font-normal">{res.student.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-bold">{res.student.prn}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                          res.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                          res.status === 'STARTED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                          {res.correctAnswers} / {exam._count.questions}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-lg font-bold text-blue-600">
                        {res.totalScore.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 text-sm font-normal">
                        <div className="flex items-center justify-end">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(res.updatedAt).toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
