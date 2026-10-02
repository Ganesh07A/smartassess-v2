import { getExamAnalytics } from "@/app/actions/exam";
import { getExamResultsPaged } from "@/app/actions/exam-filters";
import { prisma } from "@/app/db";
import { requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, Table, BarChart3, ShieldAlert, EyeOff } from "lucide-react";
import ResultExporter from "./result-exporter";
import LocalTime from "@/ui/local-time";
import AnalyticsDashboard from "./analytics-dashboard";
import { ReleaseResultsButton } from "@/ui/exams/release-results-button";
import { readParams } from "@/lib/filters/parse";
import { resultFilterSchema } from "@/lib/filters/schemas";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { DataTable, type Column } from "@/ui/filters/data-table";
import { Pagination } from "@/ui/filters/pagination";
import { EmptyState } from "@/ui/filters/empty-state";
import type { ResultListRow } from "@/lib/filters/builders/results";

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

  const columns: Column<ResultListRow>[] = [
    {
      key: "student",
      header: "Student",
      sortKey: "name",
      render: (row) => (
        <div>
          <div className="font-bold text-slate-800">{row.student.name || "Unknown"}</div>
          <div className="text-xs text-slate-500 font-normal">{row.student.email}</div>
        </div>
      ),
    },
    {
      key: "prn",
      header: "PRN",
      sortKey: "prn",
      render: (row) => <span className="font-mono text-xs font-bold text-slate-700">{row.student.prn || "N/A"}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            row.status === "COMPLETED"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : row.status === "FORCE_SUBMITTED"
                ? "bg-rose-50 text-rose-700 font-extrabold border border-rose-200"
                : row.status === "STARTED"
                  ? "bg-blue-50 text-blue-700 border border-blue-100"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {row.status.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "correct",
      header: "Correct",
      render: (row) => {
        const correctCount = row.submissions.filter((s) => s.isCorrect).length;
        return (
          <div className="flex items-center text-xs font-semibold text-slate-700">
            <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
            {correctCount} / {exam._count.questions}
          </div>
        );
      },
    },
    {
      key: "score",
      header: "Score (%)",
      sortKey: "percentage",
      render: (row) => (
        <div>
          <span className="font-black text-indigo-600">{row.percentage.toFixed(1)}%</span>
          <span className="ml-1 text-xs text-slate-400 font-medium">({row.totalScore.toFixed(1)} pts)</span>
        </div>
      ),
    },
    {
      key: "violations",
      header: "Violations",
      sortKey: "violationCount",
      render: (row) => {
        if (row.violationCount === 0) {
          return <span className="text-xs text-slate-400 font-mono">0</span>;
        }
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
              row.violationCount >= 3
                ? "bg-rose-100 text-rose-700 font-black"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            {row.violationCount}
          </span>
        );
      },
    },
    {
      key: "submittedAt",
      header: "Submitted",
      sortKey: "submittedAt",
      align: "right",
      render: (row) => {
        const timestamp = row.submittedAt || row.updatedAt;
        return (
          <div className="flex items-center justify-end text-xs text-slate-500 font-normal">
            <Clock className="w-3 h-3 mr-1 text-slate-400" />
            <LocalTime dateString={timestamp} mode="datetime" className="text-slate-600" />
          </div>
        );
      },
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

      {tab === "analytics" && analytics ? (
        <AnalyticsDashboard analytics={analytics} examId={id} />
      ) : (
        <div className="space-y-4">
          <FilterBar defs={filterDefs} />

          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            emptyState={
              <EmptyState
                title="No submissions match your filters"
                description="Try clearing your search query or expanding the score band and status selections."
                action={
                  <Link
                    href={`/teacher/exams/${id}/results?tab=table`}
                    className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors inline-block"
                  >
                    Reset table filters
                  </Link>
                }
              />
            }
          />

          <Pagination
            total={total}
            page={page}
            perPage={perPage}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  );
}
