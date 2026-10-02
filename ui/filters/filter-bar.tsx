"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { SearchInput } from "./search-input";
import { FacetSelect } from "./facet-select";
import { DateRangeFilter } from "./date-range-filter";
import { SortMenu } from "./sort-menu";
import { ActiveFilterChips, type FilterDef } from "./active-filter-chips";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export { type FilterDef };

export interface FilterBarProps {
  defs: FilterDef[];
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({ defs, children, className = "" }: FilterBarProps) {
  const { activeCount, isPending } = useFilterParams();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const searchDef = defs.find((d) => d.type === "search");
  const facetDefs = defs.filter((d) => d.type === "facet");
  const dateRangeDef = defs.find((d) => d.type === "date-range");
  const sortDef = defs.find((d) => d.type === "sort");

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Bar: Search + Mobile Toggle + Sort */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          {searchDef && (
            <SearchInput
              param={searchDef.param}
              label={searchDef.label}
              placeholder={searchDef.placeholder ?? `Search by ${searchDef.label.toLowerCase()}...`}
              className="flex-1 max-w-md"
            />
          )}

          {/* Mobile Filter Disclosure Button */}
          <button
            type="button"
            onClick={() => setMobileExpanded(!mobileExpanded)}
            aria-expanded={mobileExpanded}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Filters</span>
            {activeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-md">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-end">
          {sortDef && (
            <SortMenu
              options={sortDef.sortOptions}
              defaultSort={sortDef.sortOptions?.[0]?.value ?? "createdAt"}
            />
          )}
          {children}
        </div>
      </div>

      {/* Filter Options (Desktop always visible, Mobile collapsible) */}
      <div
        className={`${
          mobileExpanded ? "flex" : "hidden"
        } md:flex flex-wrap items-center gap-2.5 pt-1`}
      >
        {facetDefs.map((def) => (
          <FacetSelect
            key={def.param}
            param={def.param}
            label={def.label}
            options={def.options}
            multi={def.multi ?? true}
          />
        ))}

        {dateRangeDef && (
          <DateRangeFilter
            label={dateRangeDef.label}
            fromParam="from"
            toParam="to"
          />
        )}
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips defs={defs} />

      {/* Loading state indicator */}
      {isPending && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-xs font-medium text-indigo-600 animate-pulse pt-1"
        >
          <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
          <span>Updating results...</span>
        </div>
      )}
    </div>
  );
}
