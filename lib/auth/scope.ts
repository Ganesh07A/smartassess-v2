import "server-only";

import { cache } from "react";
import { getServerSession } from "next-auth";
import type { Prisma, Role } from "@prisma/client";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/db";

/**
 * Single source of truth for authorization scoping.
 *
 * Before this module existed, the "which exams may this teacher see" block was copy-pasted
 * into ~10 server actions and ~6 pages. Any divergence between those copies was a data-leak
 * waiting to happen, and it made every query builder impossible to reuse.
 */

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundOrUnauthorizedError extends Error {
  constructor(message = "Resource not found or unauthorized") {
    super(message);
    this.name = "NotFoundOrUnauthorizedError";
  }
}

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
  prn?: string | null;
  department?: string | null;
  year?: string | null;
  division?: string | null;
}

export interface TeacherScope extends SessionUser {
  role: "TEACHER";
  department: string | null;
}

/** Memoized per request: N call sites share one session read. */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new UnauthorizedError("You must be signed in to perform this action.");
  }
  return session.user as SessionUser;
});

export const requireRole = cache(async (role: Role): Promise<SessionUser> => {
  const user = await requireUser();
  if (user.role !== role) {
    throw new UnauthorizedError(`This action requires the ${role.toLowerCase()} role.`);
  }
  return user;
});

export const requireStudent = cache(async (): Promise<SessionUser> => requireRole("STUDENT"));

/**
 * Resolves the teacher together with their department, which is required to compute scope.
 * The department is re-read from the database on every call so a transferred teacher never
 * keeps stale access from an old JWT.
 */
export const requireTeacher = cache(async (): Promise<TeacherScope> => {
  const user = await requireUser();
  if (user.role !== "TEACHER") {
    throw new UnauthorizedError("This action requires the teacher role.");
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { department: true },
  });

  return { ...user, role: "TEACHER", department: record?.department ?? null };
});

/** The one and only definition of "which batches may this teacher touch". */
export function teacherBatchScope(teacher: Pick<TeacherScope, "id" | "department">): Prisma.BatchWhereInput {
  return {
    OR: [
      { teacherId: teacher.id },
      ...(teacher.department ? [{ department: teacher.department, teacherId: null }] : []),
    ],
  };
}

/** The one and only definition of "which exams may this teacher touch". */
export function teacherExamScope(teacher: Pick<TeacherScope, "id" | "department">): Prisma.ExamWhereInput {
  return { batch: teacherBatchScope(teacher) };
}

/** Throws unless the teacher owns (or department-shares) the exam. */
export async function assertExamAccess(
  examId: string,
  teacher: Pick<TeacherScope, "id" | "department">,
  select: Prisma.ExamSelect = { id: true, title: true, batchId: true, published: true },
) {
  const exam = await prisma.exam.findFirst({
    where: { AND: [{ id: examId }, teacherExamScope(teacher)] },
    select,
  });

  if (!exam) {
    throw new NotFoundOrUnauthorizedError("Exam not found or you do not have access to it.");
  }

  return exam;
}

/** Throws unless the batch belongs (or is department-shared) to the teacher. */
export async function assertBatchAccess(
  batchId: string,
  teacher: Pick<TeacherScope, "id" | "department">,
  select: Prisma.BatchSelect = { id: true, name: true },
) {
  const batch = await prisma.batch.findFirst({
    where: { AND: [{ id: batchId }, teacherBatchScope(teacher)] },
    select,
  });

  if (!batch) {
    throw new NotFoundOrUnauthorizedError("Batch not found or you do not have access to it.");
  }

  return batch;
}

/**
 * Exam access for a student: the exam must be published, assigned to one of their batches,
 * and (unless `options.ignoreWindow`) inside its scheduled window.
 *
 * Page-level checks are not enough: server actions are callable directly from the browser,
 * so the membership/window/published checks must live here and be reused by every action.
 */
export async function assertStudentExamAccess(
  examId: string,
  studentId: string,
  options: { ignoreWindow?: boolean } = {},
) {
  const now = new Date();

  const exam = await prisma.exam.findFirst({
    where: {
      id: examId,
      published: true,
      batch: { students: { some: { id: studentId } } },
    },
    select: {
      id: true,
      title: true,
      duration: true,
      batchId: true,
      published: true,
      allowRunCode: true,
      shuffleOptions: true,
      startTime: true,
      endTime: true,
      negativeMarking: true,
      proctoring: true,
      answerReveal: true,
      resultsReleasedAt: true,
      batch: { select: { id: true, name: true } },
      _count: { select: { questions: true } },
    },
  });

  if (!exam) {
    throw new NotFoundOrUnauthorizedError("Exam not found, not published, or not assigned to your batch.");
  }

  if (!options.ignoreWindow) {
    if (now < exam.startTime) {
      throw new UnauthorizedError("This exam has not started yet.");
    }
    if (now > exam.endTime) {
      throw new UnauthorizedError("This exam window has ended.");
    }
  }

  return exam;
}

/** Alias kept for readability at call sites that only need the boolean-ish semantics. */
export const assertStudentExamMembership = assertStudentExamAccess;
