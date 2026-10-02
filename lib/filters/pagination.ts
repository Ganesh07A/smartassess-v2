/**
 * Pagination constants and arithmetic for filtered list queries.
 *
 * NOTE on cursor pagination: Sprint 2 uses offset/limit (`skip`/`take`) pagination
 * because user-facing page numbers and jump-to-page navigation are required on all three
 * surfaces. Keyset/cursor pagination is deferred to Sprint 4 for high-throughput append-only feeds.
 */

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
export type PerPageOption = (typeof PER_PAGE_OPTIONS)[number];

export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;
export const EXPORT_ROW_CAP = 5000;

/**
 * Calculates total pages given total rows and per-page size. Minimum 1 page.
 */
export function pageCount(total: number, perPage: number): number {
  if (total <= 0) return 1;
  const safePerPage = Math.max(1, perPage);
  return Math.max(1, Math.ceil(total / safePerPage));
}

/**
 * Clamps a page number between 1 and totalPages.
 */
export function clampPage(page: number, totalPages: number): number {
  if (Number.isNaN(page) || page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

/**
 * Produces Prisma `skip` and `take` arguments for a 1-indexed page.
 */
export function paginationArgs(page: number, perPage: number): { skip: number; take: number } {
  const safePage = Math.max(1, page);
  const safeTake = Math.min(MAX_PER_PAGE, Math.max(1, perPage));
  const skip = (safePage - 1) * safeTake;
  return { skip, take: safeTake };
}

/**
 * Standard server response shape for all paginated filter endpoints.
 */
export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: Record<string, { value: string; label: string; count: number }[]>;
}
