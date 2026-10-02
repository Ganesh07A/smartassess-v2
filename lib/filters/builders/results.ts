import type { Prisma } from "@prisma/client";
import type { ResultFilter, ScoreBand } from "../schemas";

/**
 * Builds Prisma condition for score percentage bands.
 * Supports multiple bands combined with OR.
 */
export function buildScoreBandWhere(bands: ScoreBand[]): Prisma.StudentExamSessionWhereInput {
  if (bands.length === 0) return {};

  const conditions: Prisma.StudentExamSessionWhereInput[] = bands.map((band) => {
    switch (band) {
      case "0-40":
        return { percentage: { gte: 0, lt: 40 } };
      case "40-60":
        return { percentage: { gte: 40, lt: 60 } };
      case "60-75":
        return { percentage: { gte: 60, lt: 75 } };
      case "75-100":
        return { percentage: { gte: 75, lte: 100 } };
    }
  });

  return conditions.length === 1 ? conditions[0] : { OR: conditions };
}

/**
 * Pure builder creating the Prisma where clause for exam results submissions.
 */
export function buildResultWhere(
  examId: string,
  filter: ResultFilter,
  options: { excludeFacet?: "status" | "band" } = {},
): Prisma.StudentExamSessionWhereInput {
  const conditions: Prisma.StudentExamSessionWhereInput[] = [{ examId }];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      student: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { prn: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }

  // Include status unless excluded for status facet counting
  if (options.excludeFacet !== "status" && filter.status && filter.status.length > 0) {
    conditions.push({ status: { in: filter.status } });
  }

  // Include score band unless excluded for band facet counting
  if (options.excludeFacet !== "band" && filter.band && filter.band.length > 0) {
    conditions.push(buildScoreBandWhere(filter.band));
  }

  if (filter.flagged) {
    conditions.push({ violationCount: { gte: 3 } });
  }

  if (filter.from) {
    conditions.push({ submittedAt: { gte: filter.from } });
  }

  if (filter.to) {
    const endOfDay = new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({ submittedAt: { lte: endOfDay } });
  }

  return { AND: conditions };
}

/**
 * Pure builder creating the Prisma `orderBy` array for exam results.
 * Always appends a stable tie-breaker (`{ id: "asc" }`).
 */
export function buildResultOrderBy(
  filter: ResultFilter,
): Prisma.StudentExamSessionOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "totalScore":
      return [{ totalScore: dir }, { id: "asc" }];
    case "submittedAt":
      return [{ submittedAt: dir }, { id: "asc" }];
    case "violationCount":
      return [{ violationCount: dir }, { id: "asc" }];
    case "name":
      return [{ student: { name: dir } }, { id: "asc" }];
    case "prn":
      return [{ student: { prn: dir } }, { id: "asc" }];
    case "percentage":
    default:
      return [{ percentage: dir }, { id: "asc" }];
  }
}

/**
 * Lightweight, bounded projection for the Results Table.
 * Avoids overfetching all submissions by only reading what's needed for the 25 rows on page.
 */
export const RESULT_LIST_SELECT = {
  id: true,
  status: true,
  percentage: true,
  totalScore: true,
  maxScore: true,
  violationCount: true,
  riskScore: true,
  submittedAt: true,
  updatedAt: true,
  ipAddress: true,
  student: {
    select: {
      id: true,
      name: true,
      email: true,
      prn: true,
    },
  },
  submissions: {
    select: {
      isCorrect: true,
      pointsAwarded: true,
      questionId: true,
    },
  },
} as const;

export type ResultListRow = Prisma.StudentExamSessionGetPayload<{
  select: typeof RESULT_LIST_SELECT;
}>;
