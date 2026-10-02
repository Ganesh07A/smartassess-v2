import { getBatchDetails, getBatchRosterPaged } from "@/app/actions/batch";
import StudentManager from "./student-manager";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BatchDetailsPage({ 
  params,
  searchParams,
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawParams = await searchParams;

  const [batch, pagedRoster] = await Promise.all([
    getBatchDetails(id),
    getBatchRosterPaged(id, rawParams),
  ]);

  if (!batch) {
    notFound();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center">
        <Link
          href="/teacher/batches"
          className="flex items-center text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors py-1.5 px-3 hover:bg-gray-100 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Batches
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-2.5 py-1 rounded-md">
            {batch.department || "Cohort"}
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-2">
            {batch.name}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Enrolled Student Roster & Onboarding Management
          </p>
        </div>
      </div>

      <StudentManager
        batchId={id}
        batchName={batch.name}
        data={pagedRoster}
      />
    </div>
  );
}
