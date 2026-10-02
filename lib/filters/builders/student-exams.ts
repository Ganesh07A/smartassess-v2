import type { Prisma } from "@prisma/client";
import type { StudentExamFilter, StudentExamStatus } from "../schemas";

export const STUDENT_EXAM_ROW_SELECT = {
  id: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  duration: true,
  subjects: true,
  published: true,
  resultsReleasedAt: true,
  answerReveal: true,
  batch: {
    select: {
      id: true,
      name: true,
    },
  },
  _count: {
    select: {
      questions: true,
    },
  },
} as const;

export type StudentExamRow = Prisma.ExamGetPayload<{ select: typeof STUDENT_EXAM_ROW_SELECT }> & {
  session?: {
    id: string;
    status: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    submittedAt: Date | null;
  } | null;
  weakestTopic?: string | null;
};

/**
 * Builds where-conditions for student exam status.
 * Handles the 'missed' case where endTime has passed without a completed session.
 */
export function buildStudentExamStatusWhere(
  studentId: string,
  statuses: StudentExamStatus[],
  now: Date = new Date(),
): Prisma.ExamWhereInput {
  if (statuses.length === 0) return {};

  return {
    OR: statuses.map((status) => {
      switch (status) {
        case "upcoming":
          return {
            published: true,
            status: { not: "ARCHIVED" },
            startTime: { gt: now },
          };
        case "active":
          return {
            published: true,
            status: { not: "ARCHIVED" },
            startTime: { lte: now },
            endTime: { gte: now },
            sessions: {
              none: {
                studentId,
                status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
              },
            },
          };
        case "completed":
          return {
            sessions: {
              some: {
                studentId,
                status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
              },
            },
          };
        case "missed":
          return {
            published: true,
            status: { not: "ARCHIVED" },
            endTime: { lt: now },
            sessions: {
              none: {
                studentId,
                status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
              },
            },
          };
      }
    }),
  };
}

/**
 * Builds Prisma where-clause for Student Dashboard exam list.
 */
export function buildStudentExamWhere(
  studentId: string,
  filter: StudentExamFilter,
  now: Date = new Date(),
): Prisma.ExamWhereInput {
  const conditions: Prisma.ExamWhereInput[] = [
    {
      published: true,
      status: { not: "ARCHIVED" },
      batch: {
        students: {
          some: { id: studentId },
        },
      },
    },
  ];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { subjects: { hasSome: [q] } },
      ],
    });
  }

  if (filter.status && filter.status.length > 0) {
    conditions.push(buildStudentExamStatusWhere(studentId, filter.status, now));
  }

  if (filter.subject && filter.subject.length > 0) {
    conditions.push({
      subjects: { hasSome: filter.subject },
    });
  }

  if (filter.from) {
    conditions.push({ startTime: { gte: filter.from } });
  }

  if (filter.to) {
    const endOfDay = new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({ startTime: { lte: endOfDay } });
  }

  return { AND: conditions };
}

/**
 * Builds Prisma orderBy array for student dashboard exams.
 */
export function buildStudentExamOrderBy(
  filter: StudentExamFilter,
): Prisma.ExamOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "endTime":
      return [{ endTime: dir }, { id: "asc" }];
    case "percentage":
      return [{ sessions: { _count: dir } }, { id: "asc" }];
    case "startTime":
    default:
      return [{ startTime: dir }, { id: "asc" }];
  }
}
