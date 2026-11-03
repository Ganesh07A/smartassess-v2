import { getExamAnalytics } from "@/app/actions/exam";
import { getExamResultsPaged } from "@/app/actions/exam-filters";
import { prisma } from "@/app/db";
import { requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Table, BarChart3, EyeOff } from "lucide-react";
import ResultExporter from "./result-exporter";
import LocalTime from "@/ui/local-time";
import AnalyticsDashboard from "./analytics-dashboard";
import { ReleaseResultsButton } from "@/ui/exams/release-results-button";
import { readParams } from "@/lib/filters/parse";
import { resultFilterSchema } from "@/lib/filters/schemas";
import type { FilterDef } from "@/ui/filters/filter-bar";
import { ResultsTable } from "./results-table";

export const dynamic = "force-dynamic";

const RESULT_SORT_OPTIONS = [
  { value: "percentage", label: "Score (%)" },
  { value: "totalScore", label: "Total Points" },
  { value: "submittedAt", label: "Submitted At" },
  { value: "violationCount", label: "Violations" },
  { value: "name", label: "Student Name" },
  { value: "prn", label: "PRN" },
];

export default async function ExamResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawParams = await searchParams;
  const filter = readParams(resultFilterSchema, rawParams);
  const tab = filter.tab || "table";

  const teacher = await requireTeacher();

  const exam = await prisma.exam.findFirst({
    where: {
      AND: [{ id }, teacherExamScope(teacher)],
    },
    include: {
      batch: true,
      _count: {
        select: { questions: true },
      },
    },
  });

  if (!exam) {
    notFound();
  }

  // Only run paginated queries for table tab; analytics tab runs its own pipeline
  const { rows, total, page, perPage, totalPages, facets } =
    tab === "table"
      ? await getExamResultsPaged(id, filter)
      : {
          rows: [],
          total: 0,
          page: 1,
          perPage: 25,
          totalPages: 1,
          facets: { status: [], band: [] },
        };

  const analytics = tab === "analytics" ? await getExamAnalytics(id) : null;

  const filterDefs: FilterDef[] = [
    {
      param: "q",
      label: "Search Students",
      placeholder: "Search name, PRN or email...",
      type: "search",
    },
    {
      param: "status",
      label: "Status",
      type: "facet",
      options: facets.status,
      multi: true,
    },
    {
      param: "band",
      label: "Score Band",
      type: "facet",
      options: facets.band,
      multi: true,
    },
    {
      param: "dateRange",
      label: "Submitted Window",
      type: "date-range",
    },
    {
      param: "sort",
      label: "Sort",
      type: "sort",
      sortOptions: RESULT_SORT_OPTIONS,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <Link
            href={`/teacher/exams/${id}`}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors mr-3"
            aria-label="Back to exam details"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              Results: {exam.title}
            </h2>
            <p className="text-slate-500 text-xs font-medium">
              {exam.batch.name} • {exam._count.questions} Questions
            </p>
          </div>
        </div>

        {tab === "table" && (
          <ResultExporter
            examId={id}
            examTitle={exam.title}
            batchName={exam.batch.name}
            questionsCount={exam._count.questions}
            totalFiltered={total}
            filter={filter}
          />
        )}
      </div>

      {/* Results Release Status Banner */}
      {exam.resultsReleasedAt ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-xs text-emerald-800">
          <div className="flex items-center gap-2.5 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Results are currently <strong>public</strong> to students (Released on <LocalTime dateString={exam.resultsReleasedAt} mode="datetime" />). Students can view their marks and explanations.
            </span>
          </div>
          <ReleaseResultsButton examId={id} resultsReleasedAt={exam.resultsReleasedAt} />
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs text-amber-800">
          <div className="flex items-center gap-2.5 font-medium">
            <EyeOff className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Results are currently <strong>hidden</strong> from students. Scores and question keys will remain private until you release them.
            </span>
          </div>
          <ReleaseResultsButton examId={id} resultsReleasedAt={null} />
        </div>
      )}

      {/* View Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        <Link
          href={`/teacher/exams/${id}/results?tab=table`}
          className={`flex items-center px-5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === "table"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Table className="w-4 h-4 mr-2" />
          Submissions
        </Link>
        <Link
          href={`/teacher/exams/${id}/results?tab=analytics`}
          className={`flex items-center px-5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === "analytics"
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Advanced Analytics
        </Link>
      </div>

      {tab === "analytics" ? (
        analytics ? (
          <AnalyticsDashboard analytics={analytics} examId={id} />
        ) : (
          <div className="bg-slate-50 p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
              <BarChart3 className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Analytics Unavailable</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              No analytics data could be computed for this examination.
            </p>
          </div>
        )
      ) : (
        <ResultsTable
          rows={rows}
          totalQuestions={exam._count.questions}
          total={total}
          page={page}
          perPage={perPage}
          totalPages={totalPages}
          filterDefs={filterDefs}
          examId={id}
        />
      )}
    </div>
  );
}
