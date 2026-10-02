"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

const SYSTEM_PARAMS = new Set(["page", "perPage", "sort", "dir", "tab"]);

const FilterModeContext = createContext<"navigate" | "history">("navigate");

/**
 * Optional provider to cascade filter mode ("navigate" vs "history") down to FilterBar,
 * SearchInput, FacetSelect, and other filter controls.
 */
export function FilterModeProvider({
  mode,
  children,
}: {
  mode: "navigate" | "history";
  children: React.ReactNode;
}) {
  return createElement(FilterModeContext.Provider, { value: mode }, children);
}

export interface UseFilterParamsOptions {
  mode?: "navigate" | "history";
}

export interface UseFilterParams {
  params: URLSearchParams;
  get: (name: string) => string | null;
  getAll: (name: string) => string[];
  set: (
    patch: Record<string, string | string[] | number | boolean | undefined | null>,
    opts?: { resetPage?: boolean },
  ) => void;
  clearAll: () => void;
  activeCount: number;
  isPending: boolean;
}

/**
 * Single source of truth client hook for managing filter parameters in the URL.
 *
 * Supports two update modes:
 * - "navigate" (default): Updates URL via router.push() within a React startTransition,
 *   triggering server component re-renders for paginated lists.
 * - "history": Updates address bar via window.history.replaceState without triggering
 *   Next.js server component re-fetches (used by Live Monitor to preserve active WebSocket/Pusher connection).
 */
export function useFilterParams(options: UseFilterParamsOptions = {}): UseFilterParams {
  const contextMode = useContext(FilterModeContext);
  const mode = options.mode ?? contextMode;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // For history mode: track the current window.location.search reactively
  const [historySearch, setHistorySearch] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFilterChange = () => setHistorySearch(window.location.search);
    window.addEventListener("smartassess-filter-change", onFilterChange);
    window.addEventListener("popstate", onFilterChange);
    return () => {
      window.removeEventListener("smartassess-filter-change", onFilterChange);
      window.removeEventListener("popstate", onFilterChange);
    };
  }, []);

  const params = useMemo(() => {
    if (mode === "history" && historySearch !== null) {
      return new URLSearchParams(historySearch);
    }
    return new URLSearchParams(searchParams.toString());
  }, [searchParams, mode, historySearch]);

  const get = useCallback((name: string) => params.get(name), [params]);

  const getAll = useCallback(
    (name: string) => {
      const val = params.get(name);
      if (!val) return [];
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    },
    [params],
  );

  const set = useCallback(
    (
      patch: Record<string, string | string[] | number | boolean | undefined | null>,
      opts: { resetPage?: boolean } = {},
    ) => {
      const nextParams = new URLSearchParams(params.toString());
      const shouldResetPage = opts.resetPage ?? true;

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") {
          nextParams.delete(key);
        } else if (Array.isArray(value)) {
          const filtered = value.map((v) => String(v).trim()).filter(Boolean);
          if (filtered.length === 0) {
            nextParams.delete(key);
          } else {
            nextParams.set(key, filtered.join(","));
          }
        } else if (typeof value === "boolean") {
          if (value) {
            nextParams.set(key, "true");
          } else {
            nextParams.delete(key);
          }
        } else {
          const str = String(value).trim();
          if (str.length === 0) {
            nextParams.delete(key);
          } else {
            nextParams.set(key, str);
          }
        }
      }

      // If user altered a filter (and didn't explicitly modify page), reset to page 1
      if (shouldResetPage && !("page" in patch)) {
        nextParams.delete("page");
      }

      const queryString = nextParams.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

      if (mode === "history") {
        window.history.replaceState(null, "", targetUrl);
        window.dispatchEvent(new Event("smartassess-filter-change"));
      } else {
        startTransition(() => {
          router.push(targetUrl, { scroll: false });
        });
      }
    },
    [params, pathname, router, mode],
  );

  const clearAll = useCallback(() => {
    const nextParams = new URLSearchParams();

    // Preserve system settings (sort, perPage, tab)
    for (const key of ["sort", "dir", "perPage", "tab"]) {
      const val = params.get(key);
      if (val) nextParams.set(key, val);
    }

    const queryString = nextParams.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

    if (mode === "history") {
      window.history.replaceState(null, "", targetUrl);
      window.dispatchEvent(new Event("smartassess-filter-change"));
    } else {
      startTransition(() => {
        router.push(targetUrl, { scroll: false });
      });
    }
  }, [params, pathname, router, mode]);

  const activeCount = useMemo(() => {
    let count = 0;
    params.forEach((_, key) => {
      if (!SYSTEM_PARAMS.has(key)) {
        count += 1;
      }
    });
    return count;
  }, [params]);

  return {
    params,
    get,
    getAll,
    set,
    clearAll,
    activeCount,
    isPending,
  };
}
