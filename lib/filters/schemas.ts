import { z } from "zod";
import { csv, dateParam, intParam, MAX_TEXT } from "./parse";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "./pagination";

/* ------------------------------------------------------------- sort helpers */

export type SortDirection = "asc" | "desc";

/**
 * Normalizes sort field and direction from URL parameters.
 * Supports both `-field` (Unix/REST convention) and `sort=field&dir=desc`.
 * Leading `-` takes precedence for direction.
 */
export function parseSortParam<T extends string>(
  rawSort: string | undefined,
  rawDir: string | undefined,
  allowlist: readonly T[],
  defaultField: T,
  defaultDir: SortDirection = "desc",
): { field: T; dir: SortDirection } {
  if (!rawSort) {
    const dir = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir;
    return { field: defaultField, dir };
  }

  let fieldStr = rawSort.trim();
  let dir: SortDirection = rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir;

  if (fieldStr.startsWith("-")) {
    dir = "desc";
    fieldStr = fieldStr.slice(1);
  } else if (fieldStr.startsWith("+")) {
    dir = "asc";
    fieldStr = fieldStr.slice(1);
  }

  const matched = allowlist.find((allowed) => allowed.toLowerCase() === fieldStr.toLowerCase());
  return {
    field: matched ?? defaultField,
    dir,
  };
}

/* -------------------------------------------------------------- exams filter */

export const EXAM_SORT_FIELDS = [
  "createdAt",
  "startTime",
  "endTime",
  "title",
  "sessions",
  "questions",
] as const;
export type ExamSortField = (typeof EXAM_SORT_FIELDS)[number];

export const EXAM_STATUS_OPTIONS = ["draft", "upcoming", "active", "expired", "archived"] as const;
export type ExamFilterStatus = (typeof EXAM_STATUS_OPTIONS)[number];

export const examFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    status: csv(EXAM_STATUS_OPTIONS).optional().catch(undefined),
    batch: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    subject: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    from: dateParam(),
    to: dateParam(),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      EXAM_SORT_FIELDS,
      "createdAt",
      "desc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type ExamFilter = z.infer<typeof examFilterSchema>;

/* ------------------------------------------------------------ results filter */

export const RESULT_SORT_FIELDS = [
  "percentage",
  "totalScore",
  "submittedAt",
  "violationCount",
  "name",
  "prn",
] as const;
export type ResultSortField = (typeof RESULT_SORT_FIELDS)[number];

export const RESULT_STATUS_OPTIONS = [
  "COMPLETED",
  "FORCE_SUBMITTED",
  "STARTED",
  "NOT_STARTED",
  "PAUSED",
] as const;
export type ResultFilterStatus = (typeof RESULT_STATUS_OPTIONS)[number];

export const SCORE_BAND_OPTIONS = ["0-40", "40-60", "60-75", "75-100"] as const;
export type ScoreBand = (typeof SCORE_BAND_OPTIONS)[number];

export const resultFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    status: csv(RESULT_STATUS_OPTIONS).optional().catch(undefined),
    band: csv(SCORE_BAND_OPTIONS).optional().catch(undefined),
    flagged: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === "1" || v === "true")
      .optional()
      .catch(undefined),
    from: dateParam(),
    to: dateParam(),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
    tab: z.string().optional().catch(undefined),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      RESULT_SORT_FIELDS,
      "percentage",
      "desc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type ResultFilter = z.infer<typeof resultFilterSchema>;

/* ------------------------------------------------------- live monitor filter */

export const LIVE_SORT_FIELDS = ["risk", "violations", "lastActivity", "name", "prn"] as const;
export type LiveSortField = (typeof LIVE_SORT_FIELDS)[number];

export const LIVE_STATUS_OPTIONS = [
  "all",
  "started",
  "completed",
  "force_submitted",
  "not_started",
] as const;
export type LiveFilterStatus = (typeof LIVE_STATUS_OPTIONS)[number];

export const LIVE_RISK_OPTIONS = ["all", "flagged", "critical"] as const;
export type LiveRiskLevel = (typeof LIVE_RISK_OPTIONS)[number];

export const liveFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    status: csv(LIVE_STATUS_OPTIONS).optional().catch(undefined),
    risk: z.enum(LIVE_RISK_OPTIONS).default("all").catch("all"),
    idle: z.coerce.number().int().min(1).max(120).optional().catch(undefined),
    dup: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === "1" || v === "true")
      .optional()
      .catch(undefined),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(data.sort, data.dir, LIVE_SORT_FIELDS, "risk", "desc");
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type LiveFilter = z.infer<typeof liveFilterSchema>;

/* ----------------------------------------------------------- questions filter */

export const QUESTION_SORT_FIELDS = ["order", "points", "difficulty", "topic"] as const;
export type QuestionSortField = (typeof QUESTION_SORT_FIELDS)[number];
export const QUESTION_TYPE_OPTIONS = ["MCQ", "CODING"] as const;
export const QUESTION_DIFFICULTY_OPTIONS = ["EASY", "MEDIUM", "HARD"] as const;

export const questionFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    type: csv(QUESTION_TYPE_OPTIONS).optional().catch(undefined),
    difficulty: csv(QUESTION_DIFFICULTY_OPTIONS).optional().catch(undefined),
    topic: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    tags: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    pointsMin: z.coerce.number().optional().catch(undefined),
    pointsMax: z.coerce.number().optional().catch(undefined),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      QUESTION_SORT_FIELDS,
      "order",
      "asc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type QuestionFilter = z.infer<typeof questionFilterSchema>;

/* ------------------------------------------------------------- batches filter */

export const BATCH_SORT_FIELDS = ["createdAt", "name", "students", "exams"] as const;
export type BatchSortField = (typeof BATCH_SORT_FIELDS)[number];

export const batchFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    department: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    year: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    from: dateParam(),
    to: dateParam(),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      BATCH_SORT_FIELDS,
      "createdAt",
      "desc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type BatchFilter = z.infer<typeof batchFilterSchema>;

/* -------------------------------------------------------------- roster filter */

export const ROSTER_SORT_FIELDS = ["name", "prn", "addedAt"] as const;
export type RosterSortField = (typeof ROSTER_SORT_FIELDS)[number];

export const rosterFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    year: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    division: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      ROSTER_SORT_FIELDS,
      "name",
      "asc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type RosterFilter = z.infer<typeof rosterFilterSchema>;

/* -------------------------------------------------------- student exam filter */

export const STUDENT_EXAM_STATUS_OPTIONS = ["upcoming", "active", "completed", "missed"] as const;
export type StudentExamStatus = (typeof STUDENT_EXAM_STATUS_OPTIONS)[number];

export const STUDENT_EXAM_SORT_FIELDS = ["startTime", "endTime", "percentage"] as const;
export type StudentExamSortField = (typeof STUDENT_EXAM_SORT_FIELDS)[number];

export const studentExamFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    status: csv(STUDENT_EXAM_STATUS_OPTIONS).optional().catch(undefined),
    subject: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    from: dateParam(),
    to: dateParam(),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      STUDENT_EXAM_SORT_FIELDS,
      "startTime",
      "asc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type StudentExamFilter = z.infer<typeof studentExamFilterSchema>;

/* ----------------------------------------------------------- integrity filter */

export const INTEGRITY_SORT_FIELDS = [
  "riskScore",
  "violationCount",
  "submittedAt",
  "startedAt",
] as const;
export type IntegritySortField = (typeof INTEGRITY_SORT_FIELDS)[number];

export const INTEGRITY_RISK_OPTIONS = ["all", "flagged", "critical"] as const;
export type IntegrityRiskOption = (typeof INTEGRITY_RISK_OPTIONS)[number];

export const integrityFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    status: csv(RESULT_STATUS_OPTIONS).optional().catch(undefined),
    risk: z.enum(INTEGRITY_RISK_OPTIONS).default("all").catch("all"),
    type: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    severityMin: z.coerce.number().int().min(0).max(3).optional().catch(undefined),
    ip: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === "1" || v === "true" || v === "duplicate")
      .optional()
      .catch(undefined),
    from: dateParam(),
    to: dateParam(),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      INTEGRITY_SORT_FIELDS,
      "riskScore",
      "desc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type IntegrityFilter = z.infer<typeof integrityFilterSchema>;

/* -------------------------------------------------------- certificates filter */

export const CERTIFICATE_SORT_FIELDS = ["issueDate", "score", "grade", "name"] as const;
export type CertificateSortField = (typeof CERTIFICATE_SORT_FIELDS)[number];

export const certificateFilterSchema = z
  .object({
    q: z.string().trim().max(MAX_TEXT).optional().catch(undefined),
    exam: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    grade: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      )
      .optional()
      .catch(undefined),
    band: csv(SCORE_BAND_OPTIONS).optional().catch(undefined),
    revoked: z.enum(["all", "yes", "no"]).default("all").catch("all"),
    from: dateParam(),
    to: dateParam(),
    sort: z.string().optional().catch(undefined),
    dir: z.enum(["asc", "desc"]).optional().catch(undefined),
    page: intParam(1, 10000, 1),
    perPage: z
      .coerce
      .number()
      .int()
      .refine((v) => (PER_PAGE_OPTIONS as readonly number[]).includes(v))
      .catch(DEFAULT_PER_PAGE),
  })
  .transform((data) => {
    const { field, dir } = parseSortParam(
      data.sort,
      data.dir,
      CERTIFICATE_SORT_FIELDS,
      "issueDate",
      "desc",
    );
    return {
      ...data,
      sort: field,
      dir,
    };
  });

export type CertificateFilter = z.infer<typeof certificateFilterSchema>;
