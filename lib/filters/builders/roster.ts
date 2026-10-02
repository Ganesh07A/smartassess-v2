import type { Prisma } from "@prisma/client";
import type { RosterFilter } from "../schemas";

export const ROSTER_ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  prn: true,
  department: true,
  year: true,
  division: true,
  createdAt: true,
} as const;

export type RosterRow = Prisma.UserGetPayload<{ select: typeof ROSTER_ROW_SELECT }>;

/**
 * Builds Prisma where-clause for batch roster filtering.
 */
export function buildRosterWhere(
  batchId: string,
  filter: RosterFilter,
): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [
    {
      enrolledBatches: {
        some: { id: batchId },
      },
    },
  ];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { prn: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (filter.year && filter.year.length > 0) {
    conditions.push({
      year: { in: filter.year },
    });
  }

  if (filter.division && filter.division.length > 0) {
    conditions.push({
      division: { in: filter.division },
    });
  }

  return { AND: conditions };
}

/**
 * Builds Prisma orderBy array for batch roster.
 */
export function buildRosterOrderBy(
  filter: RosterFilter,
): Prisma.UserOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "prn":
      return [{ prn: dir }, { id: "asc" }];
    case "addedAt":
      return [{ createdAt: dir }, { id: "asc" }];
    case "name":
    default:
      return [{ name: dir }, { id: "asc" }];
  }
}
