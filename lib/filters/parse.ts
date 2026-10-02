import { z } from "zod";

export const MAX_TEXT = 120;

/**
 * Creates a Zod parser for comma-separated values constrained to an allowlist of string literals.
 * Automatically trims tokens, removes empties, limits to 20 values, and validates against the enum.
 */
export function csv<T extends string>(values: readonly T[]) {
  return z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 20),
    )
    .pipe(z.array(z.enum(values as unknown as [T, ...T[]])).min(1));
}

/**
 * Creates a Zod parser for integer parameters with min/max clamping and fallback on invalid input.
 */
export function intParam(min: number, max: number, fallback: number) {
  return z.coerce.number().int().min(min).max(max).catch(fallback);
}

/**
 * Creates a Zod parser for ISO YYYY-MM-DD date parameters.
 * Validates the format, produces a UTC Date instance, or undefined if missing/invalid.
 */
export function dateParam() {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((s, ctx) => {
      const date = new Date(`${s}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
        return z.NEVER;
      }
      return date;
    })
    .optional()
    .catch(undefined);
}

/**
 * Normalizes Next.js searchParams by flattening string arrays (taking the last value,
 * which matches standard URL search param behavior), trimming strings, and removing blanks.
 */
export function normalizeRawParams(
  raw: Record<string, string | string[] | undefined> | URLSearchParams,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  if (raw instanceof URLSearchParams) {
    raw.forEach((val, key) => {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        normalized[key] = trimmed;
      }
    });
    return normalized;
  }

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue;
    const str = Array.isArray(value) ? value[value.length - 1] : value;
    if (typeof str === "string") {
      const trimmed = str.trim();
      if (trimmed.length > 0) {
        normalized[key] = trimmed;
      }
    }
  }

  return normalized;
}

/**
 * Parses and validates raw searchParams against a Zod schema.
 * Never throws 500s: invalid or corrupted params fall back gracefully to the schema defaults.
 */
export function readParams<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams = {},
): z.infer<T> {
  const normalized = normalizeRawParams(searchParams);
  const result = schema.safeParse(normalized);

  if (result.success) {
    return result.data;
  }

  // If validation failed, parse an empty object to get full defaults without crashing
  const fallback = schema.safeParse({});
  if (fallback.success) {
    return fallback.data;
  }

  // In the unlikely event schema has no default for a required key, return parsed input as-is or throw
  throw new Error("Filter schema could not resolve default values.");
}

/**
 * Converts a structured filter object to standard URLSearchParams for query string building.
 * Omits undefined, null, empty strings, and empty arrays.
 */
export function toURLSearchParams(
  data: Record<string, string | string[] | number | boolean | Date | undefined | null>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;

    if (Array.isArray(val)) {
      const filtered = val.map((v) => String(v).trim()).filter(Boolean);
      if (filtered.length > 0) {
        params.set(key, filtered.join(","));
      }
    } else if (val instanceof Date) {
      if (!Number.isNaN(val.getTime())) {
        params.set(key, val.toISOString().slice(0, 10));
      }
    } else if (typeof val === "boolean") {
      params.set(key, val ? "true" : "false");
    } else {
      const str = String(val).trim();
      if (str.length > 0) {
        params.set(key, str);
      }
    }
  }

  return params;
}
