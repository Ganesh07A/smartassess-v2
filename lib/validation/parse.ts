import type { ZodType, z } from "zod";

/**
 * Wraps `schema.parse` so callers get a single, user-safe error type instead of a raw
 * ZodError (which leaks internal shape information and is awkward to render).
 */
export class ValidationError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(issues: { path: string; message: string }[]) {
    super(issues[0]?.message ? `Invalid input: ${issues[0].message}` : "Invalid input");
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export function parseInput<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }
  return result.data;
}
