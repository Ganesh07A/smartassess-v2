import type { Prisma, ProctorEventType } from "@prisma/client";
import type { IntegrityFilter } from "../schemas";

export const INTEGRITY_SESSION_SELECT = {
  id: true,
  studentId: true,
  examId: true,
  status: true,
  riskScore: true,
  violationCount: true,
  ipAddress: true,
  userAgent: true,
  startTime: true,
  submittedAt: true,
  totalScore: true,
  maxScore: true,
  percentage: true,
  student: {
    select: {
      id: true,
      name: true,
      email: true,
      prn: true,
    },
  },
  _count: {
    select: {
      submissions: true,
      events: true,
    },
  },
  events: {
    orderBy: {
      severity: "desc",
    },
    take: 1,
    select: {
      type: true,
      severity: true,
    },
  },
} as const;

export type IntegritySessionRow = Prisma.StudentExamSessionGetPayload<{
  select: typeof INTEGRITY_SESSION_SELECT;
}> & {
  isDuplicateIp?: boolean;
};

/**
 * Builds Prisma where-clause for Integrity Console sessions.
 */
export function buildIntegrityWhere(
  examId: string,
  filter: IntegrityFilter,
  duplicateIps: string[] = [],
): Prisma.StudentExamSessionWhereInput {
  const conditions: Prisma.StudentExamSessionWhereInput[] = [
    { examId, status: { not: "NOT_STARTED" } },
  ];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      student: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { prn: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }

  if (filter.status && filter.status.length > 0) {
    conditions.push({
      status: { in: filter.status },
    });
  }

  if (filter.risk === "flagged") {
    conditions.push({ riskScore: { gte: 40 } });
  } else if (filter.risk === "critical") {
    conditions.push({ riskScore: { gte: 70 } });
  }

  if (filter.severityMin !== undefined) {
    conditions.push({
      events: {
        some: {
          severity: { gte: filter.severityMin },
        },
      },
    });
  }

  if (filter.type && filter.type.length > 0) {
    conditions.push({
      events: {
        some: {
          type: { in: filter.type as ProctorEventType[] },
        },
      },
    });
  }

  if (filter.ip && duplicateIps.length > 0) {
    conditions.push({
      ipAddress: { in: duplicateIps },
    });
  }

  if (filter.from) {
    conditions.push({
      OR: [
        { submittedAt: { gte: filter.from } },
        { startTime: { gte: filter.from } },
      ],
    });
  }

  if (filter.to) {
    const endOfDay = new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({
      OR: [
        { submittedAt: { lte: endOfDay } },
        { startTime: { lte: endOfDay } },
      ],
    });
  }

  return { AND: conditions };
}

/**
 * Builds Prisma orderBy array for Integrity Console sessions.
 */
export function buildIntegrityOrderBy(
  filter: IntegrityFilter,
): Prisma.StudentExamSessionOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "violationCount":
      return [{ violationCount: dir }, { id: "asc" }];
    case "submittedAt":
      return [{ submittedAt: dir }, { id: "asc" }];
    case "startedAt":
      return [{ startTime: dir }, { id: "asc" }];
    case "riskScore":
    default:
      return [{ riskScore: dir }, { id: "asc" }];
  }
}
