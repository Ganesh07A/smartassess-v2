import Link from "next/link";
import { BookOpen, Users, Clock, ArrowRight, Plus } from "lucide-react";
import { getTeacherExamsPaged } from "@/app/actions/exam-filters";
import { readParams } from "@/lib/filters/parse";
import { examFilterSchema } from "@/lib/filters/schemas";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { EmptyState } from "@/ui/filters/empty-state";
import LocalTime from "@/ui/local-time";
import { resolveExamStatus } from "@/lib/exams/status";
import DuplicateButton from "./duplicate-button";

export const dynamic = "force-dynamic";

const EXAM_SORT_OPTIONS = [
  { value: "createdAt", label: "Date Created" },
  { value: "startTime", label: "Start Time" },
  { value: "endTime", label: "End Time" },
  { value: "title", label: "Exam Title" },
  { value: "sessions", label: "Submissions" },
  { value: "questions", label: "Questions" },
];

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filter = readParams(examFilterSchema, rawParams);

  const { rows, total, page, perPage, totalPages, facets } =
    await getTeacherExamsPaged(filter);

  const filterDefs: FilterDef[] = [
    {
      param: "q",
      label: "Search Exams",
      placeholder: "Search by title, description or batch...",
      type: "search",
    },
    {
      param: "status",
      label: "Status",
      type: "facet",
      options: facets.status,
      multi: true,
    },
    ...(facets.batch && facets.batch.length > 0
      ? [
          {
            param: "batch",
            label: "Batch",
            type: "facet" as const,
            options: facets.batch,
            multi: true,
          },
        ]
      : []),
    {
      param: "dateRange",
      label: "Start Window",
      type: "date-range",
    },
    {
      param: "sort",
      label: "Sort",
      type: "sort",
      sortOptions: EXAM_SORT_OPTIONS,
    },
  ];

  const now = new Date();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Exams</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Create, filter, and manage your examination assessments.
          </p>
        </div>
        <Link
          href="/teacher/exams/new"
          className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all font-bold text-sm shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Exam
        </Link>
      </div>

      {/* Filter Bar with Search, Facets, Date Range & Sort */}
      <FilterBar defs={filterDefs} />

      {/* Results List */}
      <div className="space-y-4">
        {rows.length === 0 ? (
          <EmptyState
            title="No exams found"
            description="No examinations matched your active search query or filter selection."
            action={
              <Link
                href="/teacher/exams"
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors inline-block"
              >
                Clear all filters
              </Link>
            }
          />
        ) : (
          rows.map((exam) => {
            const status = resolveExamStatus(exam, now);
            const isDraft = status === "DRAFT";
            const isUpcoming = status === "UPCOMING";
            const isExpired = status === "EXPIRED";

            return (
              <div
                key={exam.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 group hover:shadow-md hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 space-y-2.5">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {exam.title}
                    </h3>
                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-lg uppercase">
                      {exam.batch.name}
                    </span>

                    {isDraft ? (
                      <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded border border-amber-100">
                        Draft
                      </span>
                    ) : isUpcoming ? (
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded border border-indigo-100">
                        Upcoming
                      </span>
                    ) : isExpired ? (
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded border border-slate-200">
                        Ended
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded border border-emerald-100 flex items-center">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1.5" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
                    <div className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {exam.duration} mins
                    </div>
                    <div className="flex items-center">
                      <BookOpen className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {exam._count.questions} Questions
                    </div>
                    <div className="flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {exam._count.sessions} Submissions
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Start:{" "}
                        <LocalTime
                          dateString={exam.startTime}
                          mode="datetime"
                          className="text-slate-700 normal-case font-semibold"
                        />
                      </span>
                      <span>
                        End:{" "}
                        <LocalTime
                          dateString={exam.endTime}
                          mode="datetime"
                          className="text-slate-700 normal-case font-semibold"
                        />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 md:mt-0 flex items-center gap-2.5 shrink-0">
                  <DuplicateButton examId={exam.id} />
                  <Link
                    href={`/teacher/exams/${exam.id}`}
                    className="flex items-center px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                  >
                    Manage Exam
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      <Pagination
        total={total}
        page={page}
        perPage={perPage}
        totalPages={totalPages}
      />
    </div>
  );
}
