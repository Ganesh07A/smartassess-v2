import type { Prisma } from "@prisma/client";
import type { CertificateFilter } from "../schemas";

export const CERTIFICATE_ROW_SELECT = {
  id: true,
  certificateId: true,
  studentId: true,
  examId: true,
  grade: true,
  score: true,
  issueDate: true,
  revokedAt: true,
  revokedReason: true,
  revokedById: true,
  verificationCode: true,
  student: {
    select: {
      id: true,
      name: true,
      prn: true,
      email: true,
    },
  },
  exam: {
    select: {
      id: true,
      title: true,
      duration: true,
    },
  },
} as const;

export type CertificateRow = Prisma.CertificateGetPayload<{
  select: typeof CERTIFICATE_ROW_SELECT;
}>;

/**
 * Builds Prisma where-clause for Teacher Certificate management.
 */
export function buildCertificateWhere(
  teacherExamIds: string[],
  filter: CertificateFilter,
): Prisma.CertificateWhereInput {
  const conditions: Prisma.CertificateWhereInput[] = [
    { examId: { in: teacherExamIds } },
  ];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      OR: [
        { certificateId: { contains: q, mode: "insensitive" } },
        { student: { name: { contains: q, mode: "insensitive" } } },
        { student: { prn: { contains: q, mode: "insensitive" } } },
        { student: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (filter.exam && filter.exam.length > 0) {
    conditions.push({
      examId: { in: filter.exam },
    });
  }

  if (filter.grade && filter.grade.length > 0) {
    conditions.push({
      grade: { in: filter.grade },
    });
  }

  if (filter.revoked === "yes") {
    conditions.push({ revokedAt: { not: null } });
  } else if (filter.revoked === "no") {
    conditions.push({ revokedAt: null });
  }

  if (filter.band && filter.band.length > 0) {
    conditions.push({
      OR: filter.band.map((band) => {
        switch (band) {
          case "0-40":
            return { score: { gte: 0, lte: 40 } };
          case "40-60":
            return { score: { gt: 40, lte: 60 } };
          case "60-75":
            return { score: { gt: 60, lte: 75 } };
          case "75-100":
            return { score: { gt: 75, lte: 100 } };
        }
      }),
    });
  }

  if (filter.from) {
    conditions.push({ issueDate: { gte: filter.from } });
  }

  if (filter.to) {
    const endOfDay = new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({ issueDate: { lte: endOfDay } });
  }

  return { AND: conditions };
}

/**
 * Builds Prisma orderBy array for certificates.
 */
export function buildCertificateOrderBy(
  filter: CertificateFilter,
): Prisma.CertificateOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "score":
      return [{ score: dir }, { id: "asc" }];
    case "grade":
      return [{ grade: dir }, { id: "asc" }];
    case "name":
      return [{ student: { name: dir } }, { id: "asc" }];
    case "issueDate":
    default:
      return [{ issueDate: dir }, { id: "asc" }];
  }
}
