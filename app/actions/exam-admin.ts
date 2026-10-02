"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/db";
import { assertExamAccess, requireTeacher } from "@/lib/auth/scope";
import {
  updateExamSettingsSchema,
  type UpdateExamSettingsInput,
} from "@/lib/validation/schemas";
import { Difficulty, Prisma } from "@prisma/client";

/**
 * Release exam results to students.
 *
 * Guarantees results are not silently released while students are still writing
 * unless the teacher explicitly confirms with { force: true }.
 */
export async function releaseExamResults(
  examId: string,
  options: { force?: boolean } = {},
) {
  const teacher = await requireTeacher();
  const exam = await assertExamAccess(examId, teacher, {
    id: true,
    endTime: true,
    resultsReleasedAt: true,
  });

  const now = new Date();
  const isWindowOpen = exam.endTime.getTime() > now.getTime();

  // Count active students currently writing
  const activeSessionsCount = await prisma.studentExamSession.count({
    where: {
      examId,
      status: "STARTED",
    },
  });

  if ((activeSessionsCount > 0 || isWindowOpen) && !options.force) {
    return {
      success: false,
      requiresConfirmation: true,
      activeStudentsCount: activeSessionsCount,
      isWindowOpen,
      message:
        activeSessionsCount > 0
          ? `${activeSessionsCount} student(s) are actively writing this exam. Release results anyway?`
          : "The exam window is still open. Release results to finished students now?",
    };
  }

  const releasedAt = new Date();
  await prisma.exam.update({
    where: { id: examId },
    data: { resultsReleasedAt: releasedAt },
  });

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath(`/teacher/exams/${examId}/results`);
  revalidatePath(`/student/exams/${examId}/result`);
  revalidatePath("/student");

  return {
    success: true,
    requiresConfirmation: false,
    releasedAt: releasedAt.toISOString(),
  };
}

/**
 * Unrelease exam results (hides results from students again).
 */
export async function unreleaseExamResults(examId: string) {
  const teacher = await requireTeacher();
  await assertExamAccess(examId, teacher);

  console.info(`[Audit] Teacher ${teacher.id} unreleased results for exam ${examId}`);

  await prisma.exam.update({
    where: { id: examId },
    data: { resultsReleasedAt: null },
  });

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath(`/teacher/exams/${examId}/results`);
  revalidatePath(`/student/exams/${examId}/result`);
  revalidatePath("/student");

  return { success: true };
}

/**
 * Update exam settings with immutability guarantees once students have started.
 */
export async function updateExamSettings(
  examId: string,
  rawInput: UpdateExamSettingsInput,
) {
  const teacher = await requireTeacher();
  const currentExam = await assertExamAccess(examId, teacher, {
    id: true,
    startTime: true,
    endTime: true,
    duration: true,
    shuffleOptions: true,
    negativeMarking: true,
    answerReveal: true,
    proctoring: true,
  });

  const parsed = updateExamSettingsSchema.parse(rawInput);

  // Check if any student has started or completed this exam
  const startedSession = await prisma.studentExamSession.findFirst({
    where: {
      examId,
      status: { not: "NOT_STARTED" },
    },
    select: { id: true },
  });

  if (startedSession) {
    const lockedKeys: (keyof UpdateExamSettingsInput)[] = [
      "startTime",
      "endTime",
      "duration",
      "shuffleOptions",
      "negativeMarking",
      "answerReveal",
    ];

    const attemptsLockedChange = lockedKeys.some(
      (k) => parsed[k] !== undefined && parsed[k] !== currentExam[k as keyof typeof currentExam],
    );

    if (attemptsLockedChange) {
      return {
        success: false,
        locked: true,
        error: "Students have already started this exam — the exam window and scoring rules are locked.",
      };
    }
  }

  // Validate duration against window
  const effectiveStart = parsed.startTime ?? currentExam.startTime;
  const effectiveEnd = parsed.endTime ?? currentExam.endTime;
  const effectiveDuration = parsed.duration ?? currentExam.duration;

  if (effectiveDuration * 60_000 > effectiveEnd.getTime() - effectiveStart.getTime()) {
    return {
      success: false,
      locked: false,
      error: "The duration cannot be longer than the exam window.",
    };
  }

  // Merge proctoring config
  let mergedProctoring = currentExam.proctoring as Record<string, unknown>;
  if (parsed.proctoring) {
    mergedProctoring = { ...mergedProctoring, ...parsed.proctoring };
  }

  const updated = await prisma.exam.update({
    where: { id: examId },
    data: {
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.startTime ? { startTime: parsed.startTime } : {}),
      ...(parsed.endTime ? { endTime: parsed.endTime } : {}),
      ...(parsed.duration ? { duration: parsed.duration } : {}),
      ...(parsed.allowRunCode !== undefined ? { allowRunCode: parsed.allowRunCode } : {}),
      ...(parsed.shuffleOptions !== undefined ? { shuffleOptions: parsed.shuffleOptions } : {}),
      ...(parsed.negativeMarking !== undefined ? { negativeMarking: parsed.negativeMarking } : {}),
      ...(parsed.subjects ? { subjects: parsed.subjects } : {}),
      ...(parsed.answerReveal ? { answerReveal: parsed.answerReveal } : {}),
      ...(parsed.resultsReleasedAt !== undefined ? { resultsReleasedAt: parsed.resultsReleasedAt } : {}),
      proctoring: mergedProctoring as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath(`/teacher/exams/${examId}/results`);
  revalidatePath(`/student/exams/${examId}`);
  revalidatePath(`/student/exams/${examId}/result`);
  revalidatePath("/teacher/exams");

  return {
    success: true,
    locked: false,
    exam: updated,
  };
}

/**
 * Reorder exam questions in a single atomic transaction.
 */
export async function reorderExamQuestions(
  examId: string,
  orderedQuestionIds: string[],
) {
  const teacher = await requireTeacher();
  await assertExamAccess(examId, teacher);

  const currentQuestions = await prisma.examQuestion.findMany({
    where: { examId },
    select: { questionId: true },
  });

  const currentSet = new Set(currentQuestions.map((q) => q.questionId));
  const newSet = new Set(orderedQuestionIds);

  if (
    orderedQuestionIds.length !== currentQuestions.length ||
    newSet.size !== orderedQuestionIds.length ||
    ![...newSet].every((id) => currentSet.has(id))
  ) {
    throw new Error("Invalid question order payload: must be a strict permutation of existing question IDs.");
  }

  // Atomically update order indices
  await prisma.$transaction(
    orderedQuestionIds.map((questionId, index) =>
      prisma.examQuestion.update({
        where: {
          examId_questionId: {
            examId,
            questionId,
          },
        },
        data: { order: index + 1 },
      }),
    ),
  );

  revalidatePath(`/teacher/exams/${examId}`);
  return { success: true };
}

/**
 * Bulk delete questions from an exam.
 */
export async function bulkDeleteExamQuestions(
  examId: string,
  questionIds: string[],
) {
  const teacher = await requireTeacher();
  await assertExamAccess(examId, teacher);

  if (questionIds.length === 0) return { success: true, count: 0 };

  const result = await prisma.examQuestion.deleteMany({
    where: {
      examId,
      questionId: { in: questionIds },
    },
  });

  revalidatePath(`/teacher/exams/${examId}`);
  return { success: true, count: result.count };
}

/**
 * Bulk update topic and/or difficulty for questions in an exam.
 */
export async function bulkUpdateQuestionsTopicDifficulty(
  examId: string,
  questionIds: string[],
  patch: { topic?: string; difficulty?: Difficulty },
) {
  const teacher = await requireTeacher();
  await assertExamAccess(examId, teacher);

  if (questionIds.length === 0) return { success: true, count: 0 };

  const data: Prisma.QuestionUpdateInput = {};
  if (patch.topic !== undefined) data.topic = patch.topic.trim() || null;
  if (patch.difficulty) data.difficulty = patch.difficulty;

  const result = await prisma.question.updateMany({
    where: { id: { in: questionIds } },
    data,
  });

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath(`/teacher/exams/${examId}/results`);
  return { success: true, count: result.count };
}

/**
 * Bulk duplicate questions within an exam.
 */
export async function bulkDuplicateExamQuestions(
  examId: string,
  questionIds: string[],
) {
  const teacher = await requireTeacher();
  await assertExamAccess(examId, teacher);

  if (questionIds.length === 0) return { success: true, count: 0 };

  const sourceQuestions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  });

  const lastOrder = await prisma.examQuestion.aggregate({
    where: { examId },
    _max: { order: true },
  });
  let nextOrder = (lastOrder._max.order ?? 0) + 1;

  for (const q of sourceQuestions) {
    const duplicated = await prisma.question.create({
      data: {
        type: q.type,
        content: `${q.content} (Copy)`,
        options: q.options as Prisma.InputJsonValue,
        correctAnswer: q.correctAnswer,
        testCases: q.testCases as Prisma.InputJsonValue,
        points: q.points,
        difficulty: q.difficulty,
        topic: q.topic,
        tags: q.tags,
        bloomLevel: q.bloomLevel,
        explanation: q.explanation,
      },
    });

    await prisma.examQuestion.create({
      data: {
        examId,
        questionId: duplicated.id,
        order: nextOrder++,
        points: q.points,
      },
    });
  }

  revalidatePath(`/teacher/exams/${examId}`);
  return { success: true, count: sourceQuestions.length };
}
