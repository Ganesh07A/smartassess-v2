import { getTeacherBatches } from "@/app/actions/batch";
import NewExamForm from "./new-exam-form";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewExamPage() {
  const batches = await getTeacherBatches();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb / Back Button */}
      <div className="flex items-center space-x-2">
        <Link
          href="/teacher/exams"
          className="flex items-center text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors py-1 px-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Exams
        </Link>
      </div>

      {batches.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center max-w-xl mx-auto mt-12 shadow-sm">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">No active batches found</h3>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            You need to create at least one batch and enroll students before you can configure and schedule an examination.
          </p>
          <Link
            href="/teacher/batches"
            className="inline-flex items-center mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all font-bold text-sm"
          >
            Create Your First Batch
          </Link>
        </div>
      ) : (
        <NewExamForm batches={batches.map((b) => ({ id: b.id, name: b.name }))} />
      )}
    </div>
  );
}
