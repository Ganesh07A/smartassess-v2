import { assertExamAccess, requireTeacher } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { idSchema } from "@/lib/validation/schemas";
import Link from "next/link";
import {
  ArrowLeft,
  Radio,
  ExternalLink,
} from "lucide-react";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { EmptyState } from "@/ui/filters/empty-state";
import { getExamIntegrityPaged } from "@/app/actions/integrity-actions";

export const dynamic = "force-dynamic";

export default async function ExamIntegrityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawParams = await searchParams;
  const teacher = await requireTeacher();
  const validId = parseInput(idSchema, id);

  const exam = await assertExamAccess(validId, teacher, {
    id: true,
    title: true,
    duration: true,
    startTime: true,
  });

  const pagedData = await getExamIntegrityPaged(validId, rawParams);
  const s = pagedData.summary;

  const filterDefs: FilterDef[] = [
    {
      type: "search",
      param: "q",
      label: "Student",
      placeholder: "Search student name, PRN, or email...",
    },
    {
      type: "facet",
      param: "risk",
      label: "Risk Level",
      options: pagedData.facets?.risk ?? [],
      multi: false,
    },
    {
      type: "facet",
      param: "type",
      label: "Event Type",
      options: pagedData.facets?.type ?? [],
    },
    {
      type: "sort",
      param: "sort",
      label: "Sort by",
      sortOptions: [
        { value: "riskScore", label: "Risk Score (Highest)" },
        { value: "violationCount", label: "Violation Count" },
        { value: "submittedAt", label: "Submission Time" },
        { value: "startedAt", label: "Start Time" },
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href={`/teacher/exams/${id}`}
          className="flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors py-1.5 px-3 hover:bg-slate-100 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Exam Details
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/teacher/exams/${id}/live`}
            className="flex items-center px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-colors"
          >
            <Radio className="w-3.5 h-3.5 mr-1.5 animate-pulse text-rose-600" />
            Live Monitor
          </Link>
          <Link
            href={`/teacher/exams/${id}/results`}
            className="flex items-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-colors"
          >
            Results & Analytics
          </Link>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-md">
              Proctoring Audit Trail
            </span>
            <span className="text-xs font-bold text-slate-400">
              {exam.title}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-2">
            Integrity Console
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
            Forensic timeline analysis, tab-switch tracking, clipboard detection, and IP collisions.
          </p>
        </div>
      </div>

      {/* Aggregate Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-800">{s.totalSessions}</p>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Total Sessions
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-black text-amber-600">{s.flaggedCount}</p>
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mt-1">
            Flagged (≥ 40)
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-black text-rose-600">{s.criticalCount}</p>
          <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider mt-1">
            Critical (≥ 70)
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-black text-purple-600">{s.clipboardAttemptCount}</p>
          <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider mt-1">
            Clipboard Copy/Paste
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-black text-blue-600">{s.duplicateIpSessionCount}</p>
          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mt-1">
            Duplicate IP Sessions
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-700">{s.averageRiskScore}/100</p>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Average Risk
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40">
        <FilterBar defs={filterDefs} />
      </div>

      {/* Sessions Integrity Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
        {pagedData.rows.length === 0 ? (
          <EmptyState
            title="No integrity records found"
            description="No student sessions matched your current filter criteria or search query."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 font-black text-slate-600 text-[11px] uppercase tracking-wider">
                  <th className="py-4 px-6">Student Candidate</th>
                  <th className="py-4 px-4">Risk Score</th>
                  <th className="py-4 px-4">Violations</th>
                  <th className="py-4 px-4">Worst Event</th>
                  <th className="py-4 px-4">IP Address</th>
                  <th className="py-4 px-4">Device / UA</th>
                  <th className="py-4 px-4">Answered</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {pagedData.rows.map((row) => {
                  const worstEvent = row.events[0];
                  const riskColor =
                    row.riskScore >= 70
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : row.riskScore >= 40
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200";

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <p className="font-black text-slate-800 text-sm">
                          {row.student.name || "Student Candidate"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-400">
                          {row.student.prn && (
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {row.student.prn}
                            </span>
                          )}
                          <span className="text-[11px]">{row.student.email}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black border ${riskColor}`}
                        >
                          {row.riskScore} / 100
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              row.violationCount > 3
                                ? "bg-rose-500"
                                : row.violationCount > 0
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                          />
                          <span className="font-bold text-slate-700">
                            {row.violationCount}
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {worstEvent ? (
                          <span className="font-bold text-slate-700 text-[11px]">
                            {worstEvent.type.replace(/_/g, " ")}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="font-mono text-[11px] text-slate-600">
                            {row.ipAddress || "Unknown"}
                          </span>
                          {row.isDuplicateIp && (
                            <div>
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200 rounded">
                                Duplicate IP
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-[160px]">
                        <span
                          title={row.userAgent || undefined}
                          className="truncate block text-slate-500 text-[11px]"
                        >
                          {row.userAgent || "Unknown UA"}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-700">
                          {row._count.submissions} items
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/teacher/exams/${id}/integrity/${row.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                        >
                          Timeline
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagedData.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100">
            <Pagination
              total={pagedData.total}
              page={pagedData.page}
              perPage={pagedData.perPage}
              totalPages={pagedData.totalPages}
            />
          </div>
        )}
      </div>
    </div>
  );
}
