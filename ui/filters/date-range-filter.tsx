"use client";

import { Calendar, X } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export interface DateRangeFilterProps {
  label?: string;
  fromParam?: string;
  toParam?: string;
  className?: string;
}

export function DateRangeFilter({
  label = "Date Range",
  fromParam = "from",
  toParam = "to",
  className = "",
}: DateRangeFilterProps) {
  const { get, set } = useFilterParams();
  const fromValue = get(fromParam) ?? "";
  const toValue = get(toParam) ?? "";
  const hasValue = Boolean(fromValue || toValue);

  return (
    <div
      className={`flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 shadow-sm ${
        hasValue ? "border-indigo-200 bg-indigo-50/40 ring-1 ring-indigo-500/20" : ""
      } ${className}`}
    >
      <div className="flex items-center pl-2 pr-1 text-slate-400">
        <Calendar aria-hidden="true" className="w-3.5 h-3.5 mr-1" />
        <span className="font-medium text-slate-500">{label}:</span>
      </div>

      <label htmlFor={`filter-${fromParam}`} className="sr-only">
        From Date
      </label>
      <input
        id={`filter-${fromParam}`}
        type="date"
        value={fromValue}
        onChange={(e) => set({ [fromParam]: e.target.value || undefined })}
        className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      <span className="text-slate-400 font-semibold" aria-hidden="true">
        to
      </span>

      <label htmlFor={`filter-${toParam}`} className="sr-only">
        To Date
      </label>
      <input
        id={`filter-${toParam}`}
        type="date"
        value={toValue}
        onChange={(e) => set({ [toParam]: e.target.value || undefined })}
        className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {hasValue && (
        <button
          type="button"
          onClick={() => set({ [fromParam]: undefined, [toParam]: undefined })}
          aria-label="Clear date range"
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
