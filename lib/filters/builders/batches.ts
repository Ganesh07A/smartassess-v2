import type { Prisma } from "@prisma/client";
import type { BatchFilter } from "../schemas";

export const BATCH_LIST_SELECT = {
  id: true,
  name: true,
  department: true,
  createdAt: true,
  updatedAt: true,
  teacherId: true,
  _count: {
    select: {
      students: true,
      exams: true,
    },
  },
} as const;

export type BatchListRow = Prisma.BatchGetPayload<{ select: typeof BATCH_LIST_SELECT }>;

/**
 * Builds Prisma where-clause for Batches list.
 */
export function buildBatchWhere(
  filter: BatchFilter,
  scope: Prisma.BatchWhereInput,
): Prisma.BatchWhereInput {
  const conditions: Prisma.BatchWhereInput[] = [scope];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (filter.department && filter.department.length > 0) {
    conditions.push({
      department: { in: filter.department },
    });
  }

  if (filter.year && filter.year.length > 0) {
    // Year codes derived from prefix (e.g., FY, SY, TY, BE)
    conditions.push({
      OR: filter.year.flatMap((y) => [
        { name: { startsWith: `${y} `, mode: "insensitive" } },
        { name: { startsWith: `${y}-`, mode: "insensitive" } },
        { name: { startsWith: y, mode: "insensitive" } },
      ]),
    });
  }

  if (filter.from) {
    conditions.push({ createdAt: { gte: filter.from } });
  }

  if (filter.to) {
    const endOfDay = new Date(filter.to.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({ createdAt: { lte: endOfDay } });
  }

  return { AND: conditions };
}

/**
 * Builds Prisma orderBy array for Batches.
 */
export function buildBatchOrderBy(
  filter: BatchFilter,
): Prisma.BatchOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "name":
      return [{ name: dir }, { id: "asc" }];
    case "students":
      return [{ students: { _count: dir } }, { id: "asc" }];
    case "exams":
      return [{ exams: { _count: dir } }, { id: "asc" }];
    case "createdAt":
    default:
      return [{ createdAt: dir }, { id: "asc" }];
  }
}
