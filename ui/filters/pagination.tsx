"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";
import { PER_PAGE_OPTIONS } from "@/lib/filters/pagination";

export interface PaginationProps {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  className?: string;
}

export function Pagination({
  total,
  page,
  perPage,
  totalPages,
  className = "",
}: PaginationProps) {
  const { set } = useFilterParams();

  if (total <= 0) return null;

  const startRow = Math.min(total, (page - 1) * perPage + 1);
  const endRow = Math.min(total, page * perPage);

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    set({ page: p }, { resetPage: false });
  };

  const changePerPage = (size: number) => {
    set({ perPage: size, page: 1 }, { resetPage: false });
  };

  // Generate page numbers with ellipses
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 text-xs text-slate-500 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span aria-live="polite" className="font-medium text-slate-600">
          Showing <strong className="font-bold text-slate-800">{startRow}</strong> to{" "}
          <strong className="font-bold text-slate-800">{endRow}</strong> of{" "}
          <strong className="font-bold text-slate-800">{total}</strong> results
        </span>

        <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
          <label htmlFor="per-page-select" className="sr-only">
            Results per page
          </label>
          <span className="text-slate-400">Rows:</span>
          <select
            id="per-page-select"
            value={perPage}
            onChange={(e) => changePerPage(Number(e.target.value))}
            className="px-2 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {PER_PAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          aria-label="Go to previous page"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-400 select-none">
                  …
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <button
                key={`page-${p}`}
                type="button"
                onClick={() => goToPage(p)}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`min-w-[32px] h-8 px-2 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-bold"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="Go to next page"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
