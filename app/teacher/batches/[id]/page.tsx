import { getBatchDetails } from "@/app/actions/batch";
import StudentManager from "./student-manager";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export default async function BatchDetailsPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const batch = await getBatchDetails(id);

  if (!batch) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/teacher/batches"
            className="p-2 hover:bg-gray-200 rounded-full transition-colors mr-4"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-800">{batch.name}</h2>
            <p className="text-gray-500">Manage students in this batch.</p>
          </div>
        </div>
      </div>

      <StudentManager batchId={id} initialStudents={batch.students} />
    </div>
  );
}
