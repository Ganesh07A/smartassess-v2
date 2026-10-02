"use client";

import { useState, useEffect, useDeferredValue } from "react";
import { Search, X } from "lucide-react";
import { useFilterParams } from "@/lib/filters/use-filter-params";

export interface SearchInputProps {
  param?: string;
  label?: string;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  param = "q",
  label = "Search",
  placeholder = "Search...",
  debounceMs = 300,
  className = "",
}: SearchInputProps) {
  const { get, set } = useFilterParams();
  const urlValue = get(param) ?? "";
  const [value, setValue] = useState(urlValue);
  const deferredValue = useDeferredValue(value);

  const [prevUrlValue, setPrevUrlValue] = useState(urlValue);
  if (prevUrlValue !== urlValue) {
    setPrevUrlValue(urlValue);
    setValue(urlValue);
  }

  // Debounced URL update
  useEffect(() => {
    if (deferredValue === urlValue) return;

    const timer = setTimeout(() => {
      set({ [param]: deferredValue || undefined });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [deferredValue, urlValue, param, debounceMs, set]);

  return (
    <div role="search" className={`relative flex items-center ${className}`}>
      <label htmlFor={`search-${param}`} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
      />
      <input
        id={`search-${param}`}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            set({ [param]: undefined });
          }}
          aria-label={`Clear ${label}`}
          className="absolute right-3 p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
