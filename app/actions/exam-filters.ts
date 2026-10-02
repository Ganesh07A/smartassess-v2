"use server";

import { prisma } from "@/app/db";
import { assertExamAccess, requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { idSchema } from "@/lib/validation/schemas";
import {
  examFilterSchema,
  resultFilterSchema,
  questionFilterSchema,
  type ExamFilter,
  type ResultFilter,
  type QuestionFilter,
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
  buildQuestionWhere,
  buildQuestionOrderBy,
  QUESTION_ROW_SELECT,
  type QuestionRow,
} from "@/lib/filters/builders/questions";
import {
  studentExamFilterSchema,
  type StudentExamFilter,
} from "@/lib/filters/schemas";
import {
  buildStudentExamWhere,
  buildStudentExamOrderBy,
  buildStudentExamStatusWhere,
  STUDENT_EXAM_ROW_SELECT,
  type StudentExamRow,
} from "@/lib/filters/builders/student-exams";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
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

/**
 * Fetches paginated, filtered, and sorted questions for an exam.
 * Computes facets for type, difficulty, and topic in parallel.
 */
export async function getExamQuestionsPaged(
  examId: string,
  input: Partial<QuestionFilter> = {},
): Promise<PagedResult<QuestionRow>> {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  const filter = questionFilterSchema.parse(input);
  const where = buildQuestionWhere(id, filter);
  const orderBy = buildQuestionOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  // Facet queries
  const whereWithoutType = buildQuestionWhere(id, { ...filter, type: undefined });
  const whereWithoutDiff = buildQuestionWhere(id, { ...filter, difficulty: undefined });
  const whereWithoutTopic = buildQuestionWhere(id, { ...filter, topic: undefined });

  const [
    rows,
    total,
    mcqCount,
    codingCount,
    easyCount,
    mediumCount,
    hardCount,
    allTopics,
  ] = await Promise.all([
    prisma.examQuestion.findMany({
      where,
      orderBy,
      skip,
      take,
      select: QUESTION_ROW_SELECT,
    }),
    prisma.examQuestion.count({ where }),
    prisma.examQuestion.count({
      where: { AND: [whereWithoutType, { question: { type: "MCQ" } }] },
    }),
    prisma.examQuestion.count({
      where: { AND: [whereWithoutType, { question: { type: "CODING" } }] },
    }),
    prisma.examQuestion.count({
      where: { AND: [whereWithoutDiff, { question: { difficulty: "EASY" } }] },
    }),
    prisma.examQuestion.count({
      where: { AND: [whereWithoutDiff, { question: { difficulty: "MEDIUM" } }] },
    }),
    prisma.examQuestion.count({
      where: { AND: [whereWithoutDiff, { question: { difficulty: "HARD" } }] },
    }),
    prisma.examQuestion.findMany({
      where: whereWithoutTopic,
      select: { question: { select: { topic: true } } },
    }),
  ]);

  const topicCountMap = new Map<string, number>();
  for (const item of allTopics) {
    const t = item.question.topic || "Untagged";
    topicCountMap.set(t, (topicCountMap.get(t) ?? 0) + 1);
  }
  const topicFacets = Array.from(topicCountMap.entries()).map(([value, count]) => ({
    value,
    label: value,
    count,
  }));

  const typeFacets = [
    { value: "MCQ", label: "MCQ", count: mcqCount },
    { value: "CODING", label: "Coding", count: codingCount },
  ];

  const difficultyFacets = [
    { value: "EASY", label: "Easy", count: easyCount },
    { value: "MEDIUM", label: "Medium", count: mediumCount },
    { value: "HARD", label: "Hard", count: hardCount },
  ];

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      type: typeFacets,
      difficulty: difficultyFacets,
      topic: topicFacets,
    },
  };
}

/**
 * Fetches paginated, filtered, and sorted exams for the authenticated student.
 * Uses denormalized session columns and handles 'missed' status correctly.
 */
export async function getStudentExamsPaged(
  input: Partial<StudentExamFilter> = {},
): Promise<PagedResult<StudentExamRow>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  const studentId = session.user.id;
  const filter = studentExamFilterSchema.parse(input);
  const now = new Date();

  const where = buildStudentExamWhere(studentId, filter, now);
  const orderBy = buildStudentExamOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  const whereWithoutStatus = buildStudentExamWhere(studentId, { ...filter, status: undefined }, now);

  const [
    exams,
    total,
    upcomingCount,
    activeCount,
    completedCount,
    missedCount,
  ] = await Promise.all([
    prisma.exam.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        ...STUDENT_EXAM_ROW_SELECT,
        sessions: {
          where: { studentId },
          select: {
            id: true,
            status: true,
            totalScore: true,
            maxScore: true,
            percentage: true,
            submittedAt: true,
          },
          take: 1,
        },
      },
    }),
    prisma.exam.count({ where }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildStudentExamStatusWhere(studentId, ["upcoming"], now)],
      },
    }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildStudentExamStatusWhere(studentId, ["active"], now)],
      },
    }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildStudentExamStatusWhere(studentId, ["completed"], now)],
      },
    }),
    prisma.exam.count({
      where: {
        AND: [whereWithoutStatus, buildStudentExamStatusWhere(studentId, ["missed"], now)],
      },
    }),
  ]);

  const rows: StudentExamRow[] = exams.map((exam) => {
    const studentSession = exam.sessions[0] ?? null;
    return {
      ...exam,
      session: studentSession,
    };
  });

  const statusFacets = [
    { value: "active", label: "Active Now", count: activeCount },
    { value: "upcoming", label: "Upcoming", count: upcomingCount },
    { value: "completed", label: "Completed", count: completedCount },
    { value: "missed", label: "Missed", count: missedCount },
  ];

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      status: statusFacets,
    },
  };
}
