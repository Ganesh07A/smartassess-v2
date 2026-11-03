"use client";

import React from "react";
import Link from "next/link";
import { CheckCircle, ShieldAlert } from "lucide-react";
import { DataTable, type Column } from "@/ui/filters/data-table";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { EmptyState } from "@/ui/filters/empty-state";
import type { ResultListRow } from "@/lib/filters/builders/results";

interface ResultsTableProps {
  rows: ResultListRow[];
  totalQuestions: number;
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  filterDefs: FilterDef[];
  examId: string;
}

export function ResultsTable({
  rows,
  totalQuestions,
  total,
  page,
  perPage,
  totalPages,
  filterDefs,
  examId,
}: ResultsTableProps) {
  // Columns strictly matching: Student, PRN, Status, Score%, Total, Correct, Violations
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
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-700">{row.student.prn || "N/A"}</span>
      ),
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
      key: "score",
      header: "Score%",
      sortKey: "percentage",
      render: (row) => (
        <span className="font-black text-indigo-600">{row.percentage.toFixed(1)}%</span>
      ),
    },
    {
      key: "totalScore",
      header: "Total",
      sortKey: "totalScore",
      render: (row) => (
        <span className="font-bold text-slate-700">{row.totalScore.toFixed(1)}</span>
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
            {correctCount} / {totalQuestions}
          </div>
        );
      },
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
  ];

  return (
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
                href={`/teacher/exams/${examId}/results?tab=table`}
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
  );
}
