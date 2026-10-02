"use client";

import { X } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export interface FilterDef {
  param: string;
  label: string;
  type: "search" | "facet" | "date-range" | "sort";
  options?: { value: string; label: string; count?: number }[];
  sortOptions?: { value: string; label: string }[];
  placeholder?: string;
  multi?: boolean;
}

export interface ActiveFilterChipsProps {
  defs: FilterDef[];
  className?: string;
}

export function ActiveFilterChips({ defs, className = "" }: ActiveFilterChipsProps) {
  const { params, getAll, set, clearAll, activeCount } = useFilterParams();

  if (activeCount === 0) return null;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  for (const def of defs) {
    if (def.type === "search") {
      const q = params.get(def.param);
      if (q) {
        chips.push({
          key: `${def.param}-${q}`,
          label: `${def.label}: "${q}"`,
          onRemove: () => set({ [def.param]: undefined }),
        });
      }
    } else if (def.type === "facet") {
      const selected = getAll(def.param);
      for (const val of selected) {
        const optionLabel = def.options?.find((opt) => opt.value === val)?.label ?? val;
        chips.push({
          key: `${def.param}-${val}`,
          label: `${def.label}: ${optionLabel}`,
          onRemove: () => {
            const next = selected.filter((v) => v !== val);
            set({ [def.param]: next.length > 0 ? next : undefined });
          },
        });
      }
    } else if (def.type === "date-range") {
      const fromParam = "from";
      const toParam = "to";
      const from = params.get(fromParam);
      const to = params.get(toParam);

      if (from && to) {
        chips.push({
          key: "date-range-both",
          label: `${def.label}: ${from} to ${to}`,
          onRemove: () => set({ [fromParam]: undefined, [toParam]: undefined }),
        });
      } else if (from) {
        chips.push({
          key: "date-range-from",
          label: `${def.label}: from ${from}`,
          onRemove: () => set({ [fromParam]: undefined }),
        });
      } else if (to) {
        chips.push({
          key: "date-range-to",
          label: `${def.label}: until ${to}`,
          onRemove: () => set({ [toParam]: undefined }),
        });
      }
    }
  }

  // Also check for flagged or other boolean query parameters
  const flagged = params.get("flagged");
  if (flagged === "true" || flagged === "1") {
    chips.push({
      key: "filter-flagged",
      label: "Flagged (Violations ≥ 3)",
      onRemove: () => set({ flagged: undefined }),
    });
  }

  const idle = params.get("idle");
  if (idle) {
    chips.push({
      key: `filter-idle-${idle}`,
      label: `Idle ≥ ${idle}m`,
      onRemove: () => set({ idle: undefined }),
    });
  }

  const dup = params.get("dup");
  if (dup === "true" || dup === "1") {
    chips.push({
      key: "filter-dup",
      label: "Duplicate IP Only",
      onRemove: () => set({ dup: undefined }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 pt-2 ${className}`}>
      <span className="text-xs font-semibold text-slate-400">Active filters:</span>

      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter: ${chip.label}`}
            className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={clearAll}
        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline px-2 py-1 transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
