"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export interface SortOption {
  value: string;
  label: string;
}

export interface SortMenuProps {
  options?: SortOption[];
  defaultSort?: string;
  className?: string;
}

export function SortMenu({
  options = [],
  defaultSort = "createdAt",
  className = "",
}: SortMenuProps) {
  const { get, set } = useFilterParams();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawSort = get("sort") ?? defaultSort;
  const currentDir = get("dir") === "asc" ? "asc" : "desc";

  // Strip leading - or + if present in sort string
  const currentField = rawSort.startsWith("-") || rawSort.startsWith("+")
    ? rawSort.slice(1)
    : rawSort;

  const activeOption = options.find((opt) => opt.value === currentField) ?? options[0];

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

  const toggleDirection = () => {
    const nextDir = currentDir === "desc" ? "asc" : "desc";
    set({ dir: nextDir }, { resetPage: false });
  };

  const selectField = (value: string) => {
    set({ sort: value }, { resetPage: false });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden p-0.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Sort by: ${activeOption?.label || currentField}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span>Sort: {activeOption?.label || currentField}</span>
          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        <div className="w-[1px] h-4 bg-slate-200" aria-hidden="true" />

        <button
          type="button"
          onClick={toggleDirection}
          aria-label={`Sort direction: currently ${currentDir === "desc" ? "descending" : "ascending"}. Click to toggle.`}
          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
          title={currentDir === "desc" ? "Descending (Z-A / High-Low)" : "Ascending (A-Z / Low-High)"}
        >
          {currentDir === "desc" ? (
            <ArrowDown className="w-3.5 h-3.5" />
          ) : (
            <ArrowUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Sort options"
          className="absolute right-0 top-full z-30 mt-1.5 min-w-[180px] bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 p-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          {options.map((option) => {
            const isSelected = option.value === currentField;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectField(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors text-left ${
                  isSelected
                    ? "bg-indigo-50 text-indigo-900 font-bold"
                    : "text-slate-700 hover:bg-slate-50 font-medium"
                }`}
              >
                <span>{option.label}</span>
                {isSelected && (
                  <span className="text-[10px] font-mono uppercase text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded">
                    {currentDir}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
