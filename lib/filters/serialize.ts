import { toURLSearchParams } from "./parse";

/**
 * Serializes a filter object into a URLSearchParams instance.
 */
export function filterToSearchParams(
  filter: Record<string, string | string[] | number | boolean | Date | undefined | null>,
): URLSearchParams {
  return toURLSearchParams(filter);
}

/**
 * Serializes a filter object into a canonical URL query string (without the leading '?').
 * Sorts keys for deterministic string comparison (e.g. for Suspense boundary keys).
 */
export function filterToQueryString(
  filter: Record<string, string | string[] | number | boolean | Date | undefined | null>,
): string {
  const params = toURLSearchParams(filter);
  params.sort();
  return params.toString();
}
