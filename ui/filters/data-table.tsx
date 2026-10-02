"use client";

import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export interface Column<T> {
  key: string;
  header: string;
  sortKey?: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyState,
  className = "",
}: DataTableProps<T>) {
  const { get, set } = useFilterParams();
  const currentSort = get("sort");
  const currentDir = get("dir") === "asc" ? "asc" : "desc";

  const handleHeaderSort = (sortKey: string) => {
    const isCurrent = currentSort === sortKey;
    const nextDir = isCurrent && currentDir === "desc" ? "asc" : "desc";
    set({ sort: sortKey, dir: nextDir });
  };

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {columns.map((col) => {
                  const isSorted = currentSort === col.sortKey;
                  const ariaSort = !col.sortKey
                    ? undefined
                    : isSorted
                      ? currentDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none";

                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={ariaSort}
                      className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.className ?? ""}`}
                    >
                      {col.sortKey ? (
                        <button
                          type="button"
                          onClick={() => handleHeaderSort(col.sortKey!)}
                          aria-label={`Sort by ${col.header}`}
                          className={`inline-flex items-center gap-1.5 font-bold hover:text-indigo-600 transition-colors focus:outline-none ${
                            isSorted ? "text-indigo-600 font-extrabold" : ""
                          }`}
                        >
                          <span>{col.header}</span>
                          {isSorted ? (
                            currentDir === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-6 py-4 text-sm ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.className ?? ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Stack (< md) — Eliminates unusable horizontal scroll on 375px screens */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5"
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex items-center justify-between text-xs py-0.5 border-b border-slate-50 last:border-0"
              >
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  {col.header}
                </span>
                <div className="text-right text-slate-800">{col.render(row)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
