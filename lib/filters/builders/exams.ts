import type { Prisma } from "@prisma/client";
import type { ExamFilter, ExamFilterStatus } from "../schemas";

/**
 * Builds the Prisma where-clause for dynamic exam lifecycle status.
 *
 * NOTE on the staleness trap: `Exam.status` is only stamped at create/publish time,
 * so a row published as UPCOMING would claim UPCOMING forever in SQL. We derive lifecycle
 * primarily from timestamps relative to `now`, while respecting explicit ARCHIVED status.
 */
export function buildExamStatusWhere(
  statuses: ExamFilterStatus[],
  now: Date = new Date(),
): Prisma.ExamWhereInput {
  if (statuses.length === 0) return {};

  return {
    OR: statuses.map((status) => {
      switch (status) {
        case "draft":
          return { published: false, status: { not: "ARCHIVED" } };
        case "archived":
          return { status: "ARCHIVED" };
        case "upcoming":
          return {
            published: true,
            status: { not: "ARCHIVED" },
            startTime: { gt: now },
          };
        case "expired":
          return {
            published: true,
            status: { not: "ARCHIVED" },
            endTime: { lt: now },
          };
        case "active":
          return {
            published: true,
            status: { not: "ARCHIVED" },
            startTime: { lte: now },
            endTime: { gte: now },
          };
      }
    }),
  };
}

/**
 * Pure builder creating the Prisma where clause for the Teacher Exams list.
 * Always places authorization scope first inside an `AND` array.
 */
export function buildExamWhere(
  filter: ExamFilter,
  scope: Prisma.ExamWhereInput,
  now: Date = new Date(),
): Prisma.ExamWhereInput {
  const conditions: Prisma.ExamWhereInput[] = [scope];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { batch: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (filter.status && filter.status.length > 0) {
    conditions.push(buildExamStatusWhere(filter.status, now));
  }

  if (filter.batch && filter.batch.length > 0) {
    conditions.push({ batchId: { in: filter.batch } });
  }

  if (filter.subject && filter.subject.length > 0) {
    conditions.push({ subjects: { hasSome: filter.subject } });
  }

  if (filter.from) {
    conditions.push({ startTime: { gte: filter.from } });
  }

  if (filter.to) {
    // End of the day for the 'to' date
    const endOfDay = new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({ startTime: { lte: endOfDay } });
  }

  return { AND: conditions };
}

/**
 * Pure builder creating the Prisma `orderBy` array for Teacher Exams.
 * Always appends a stable tie-breaker (`{ id: "asc" }`) to prevent pagination anomalies.
 */
export function buildExamOrderBy(filter: ExamFilter): Prisma.ExamOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "startTime":
      return [{ startTime: dir }, { id: "asc" }];
    case "endTime":
      return [{ endTime: dir }, { id: "asc" }];
    case "title":
      return [{ title: dir }, { id: "asc" }];
    case "sessions":
      return [{ sessions: { _count: dir } }, { id: "asc" }];
    case "questions":
      return [{ questions: { _count: dir } }, { id: "asc" }];
    case "createdAt":
    default:
      return [{ createdAt: dir }, { id: "asc" }];
  }
}

/**
 * Select projection for exam list items. Includes everything needed to render
 * the card UI, badges, and LocalTime dates without over-fetching.
 */
export const EXAM_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  examCode: true,
  startTime: true,
  endTime: true,
  duration: true,
  published: true,
  status: true,
  subjects: true,
  proctoring: true,
  batch: { select: { id: true, name: true } },
  _count: { select: { questions: true, sessions: true } },
} as const;

export type ExamListRow = Prisma.ExamGetPayload<{ select: typeof EXAM_LIST_SELECT }>;
