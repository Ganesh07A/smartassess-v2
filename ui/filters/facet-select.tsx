"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export interface FacetOption {
  value: string;
  label: string;
  count?: number;
}

export interface FacetSelectProps {
  param: string;
  label: string;
  options?: FacetOption[];
  showCounts?: boolean;
  multi?: boolean;
  className?: string;
}

export function FacetSelect({
  param,
  label,
  options = [],
  showCounts = true,
  multi = true,
  className = "",
}: FacetSelectProps) {
  const { getAll, get, set } = useFilterParams();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = multi ? getAll(param) : [get(param)].filter(Boolean) as string[];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Handle escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const toggleOption = (val: string) => {
    if (!multi) {
      set({ [param]: selectedValues.includes(val) ? undefined : val });
      setIsOpen(false);
      return;
    }

    const next = selectedValues.includes(val)
      ? selectedValues.filter((v) => v !== val)
      : [...selectedValues, val];

    set({ [param]: next.length > 0 ? next : undefined });
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={`relative inline-block text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex items-center justify-between gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all shadow-sm ${
          selectedValues.length > 0
            ? "bg-indigo-50/70 border-indigo-200 text-indigo-700 font-semibold"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span>
          {label}
          {selectedValues.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded-md">
              {selectedValues.length}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-indigo-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1.5 min-w-[200px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <div className="py-2.5 px-3 text-xs text-slate-400 text-center">
              No options available
            </div>
          ) : (
            options.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(option.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors text-left ${
                    isSelected
                      ? "bg-indigo-50/80 text-indigo-900 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{option.label}</span>
                  </div>
                  {showCounts && option.count !== undefined && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-indigo-200/60 text-indigo-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {option.count}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
