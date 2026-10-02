"use server";

import { prisma } from "@/app/db";
import { assertExamAccess, requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { idSchema } from "@/lib/validation/schemas";
import {
  examFilterSchema,
  resultFilterSchema,
  type ExamFilter,
  type ResultFilter,
} from "@/lib/filters/schemas";
import {
  buildExamWhere,
  buildExamOrderBy,
  buildExamStatusWhere,
  EXAM_LIST_SELECT,
  type ExamListRow,
} from "@/lib/filters/builders/exams";
import {
  buildResultWhere,
  buildResultOrderBy,
  buildScoreBandWhere,
  RESULT_LIST_SELECT,
  type ResultListRow,
} from "@/lib/filters/builders/results";
import {
  pageCount,
  paginationArgs,
  EXPORT_ROW_CAP,
  type PagedResult,
} from "@/lib/filters/pagination";

/**
 * Fetches paginated, filtered, and sorted exams for the authenticated teacher.
 * Computes status and batch facets independently inside a single Promise.all.
 */
export async function getTeacherExamsPaged(
  input: Partial<ExamFilter> = {},
): Promise<PagedResult<ExamListRow>> {
  const teacher = await requireTeacher();
  const filter = examFilterSchema.parse(input);
  const scope = teacherExamScope(teacher);
  const now = new Date();

  const where = buildExamWhere(filter, scope, now);
  const orderBy = buildExamOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  // For facet counts: exclude status/batch filters so selecting a facet does not zero the others
  const whereWithoutStatus = buildExamWhere({ ...filter, status: undefined }, scope, now);
  const whereWithoutBatch = buildExamWhere({ ...filter, batch: undefined }, scope, now);

  const [
    rows,
    total,
    activeCount,
    upcomingCount,
    draftCount,
    expiredCount,
    batchGroups,
  ] = await Promise.all([
    prisma.exam.findMany({
      where,
      orderBy,
      skip,
      take,
      select: EXAM_LIST_SELECT,
    }),
    prisma.exam.count({ where }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildExamStatusWhere(["active"], now)],
      },
    }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildExamStatusWhere(["upcoming"], now)],
      },
    }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildExamStatusWhere(["draft"], now)],
      },
    }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildExamStatusWhere(["expired"], now)],
      },
    }),
    prisma.exam.groupBy({
      by: ["batchId"],
      where: whereWithoutBatch,
      _count: { _all: true },
      orderBy: { _count: { batchId: "desc" } },
      take: 20,
    }),
  ]);

  // Lookup human-readable names for top batches
  const batchIds = batchGroups.map((g) => g.batchId);
  const batches =
    batchIds.length > 0
      ? await prisma.batch.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, name: true },
        })
      : [];

  const batchNameMap = new Map(batches.map((b) => [b.id, b.name]));

  const statusFacets = [
    { value: "active", label: "Active / Live", count: activeCount },
    { value: "upcoming", label: "Upcoming", count: upcomingCount },
    { value: "draft", label: "Draft", count: draftCount },
    { value: "expired", label: "Ended / Expired", count: expiredCount },
  ];

  const batchFacets = batchGroups.map((g) => ({
    value: g.batchId,
    label: batchNameMap.get(g.batchId) ?? "Unknown Batch",
    count: g._count._all,
  }));

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      status: statusFacets,
      batch: batchFacets,
    },
  };
}

/**
 * Fetches paginated, filtered, and sorted submissions for an exam.
 * Keeps payloads bounded to current page rows and computes status/band facets in parallel.
 */
export async function getExamResultsPaged(
  examId: string,
  input: Partial<ResultFilter> = {},
): Promise<PagedResult<ResultListRow>> {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  const filter = resultFilterSchema.parse(input);
  const where = buildResultWhere(id, filter);
  const orderBy = buildResultOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  // Facet queries: compute counts without their respective facet clauses
  const whereWithoutStatus = buildResultWhere(id, filter, { excludeFacet: "status" });
  const whereWithoutBand = buildResultWhere(id, filter, { excludeFacet: "band" });

  const [
    rows,
    total,
    statusGroups,
    band0to40,
    band40to60,
    band60to75,
    band75to100,
  ] = await Promise.all([
    prisma.studentExamSession.findMany({
      where,
      orderBy,
      skip,
      take,
      select: RESULT_LIST_SELECT,
    }),
    prisma.studentExamSession.count({ where }),
    prisma.studentExamSession.groupBy({
      by: ["status"],
      where: whereWithoutStatus,
      _count: { _all: true },
    }),
    prisma.studentExamSession.count({
      where: {
        AND: [whereWithoutBand, buildScoreBandWhere(["0-40"])],
      },
    }),
    prisma.studentExamSession.count({
      where: {
        AND: [whereWithoutBand, buildScoreBandWhere(["40-60"])],
      },
    }),
    prisma.studentExamSession.count({
      where: {
        AND: [whereWithoutBand, buildScoreBandWhere(["60-75"])],
      },
    }),
    prisma.studentExamSession.count({
      where: {
        AND: [whereWithoutBand, buildScoreBandWhere(["75-100"])],
      },
    }),
  ]);

  const statusFacets = statusGroups.map((g) => ({
    value: g.status,
    label: g.status.replace("_", " "),
    count: g._count._all,
  }));

  const bandFacets = [
    { value: "0-40", label: "0% – 40% (Fail)", count: band0to40 },
    { value: "40-60", label: "40% – 60% (Pass)", count: band40to60 },
    { value: "60-75", label: "60% – 75% (Merit)", count: band60to75 },
    { value: "75-100", label: "75% – 100% (Distinction)", count: band75to100 },
  ];

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      status: statusFacets,
      band: bandFacets,
    },
  };
}

/**
 * Fetches the entire filtered result set (up to EXPORT_ROW_CAP) for client-side export.
 * Reuses the EXACT same query builder as the Results page table to ensure 100% fidelity.
 */
export async function exportExamResults(
  examId: string,
  input: Partial<ResultFilter> = {},
) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  const filter = resultFilterSchema.parse(input);
  const where = buildResultWhere(id, filter);
  const orderBy = buildResultOrderBy(filter);

  const rows = await prisma.studentExamSession.findMany({
    where,
    orderBy,
    take: EXPORT_ROW_CAP,
    select: RESULT_LIST_SELECT,
  });

  return {
    rows,
    total: rows.length,
    truncated: rows.length === EXPORT_ROW_CAP,
    cap: EXPORT_ROW_CAP,
  };
}
