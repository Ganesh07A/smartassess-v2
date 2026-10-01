"use server";

import { prisma } from "@/app/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import type { Prisma, ProctorEventType } from "@prisma/client";
import { isPusherConfigured, pusherServer } from "@/app/lib/pusher-server";
import { examChannel } from "@/app/lib/pusher-channels";
import {
  assertBatchAccess,
  assertExamAccess,
  assertStudentExamAccess,
  NotFoundOrUnauthorizedError,
  requireStudent,
  requireTeacher,
  teacherExamScope,
} from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import {
  createExamSchema,
  duplicateExamSchema,
  examQuestionRefSchema,
  idSchema,
  proctorEventSchema,
  saveSubmissionSchema,
  sessionIdSchema,
  updateBlurStateSchema,
  uploadQuestionsSchema,
  updateQuestionSchema,
} from "@/lib/validation/schemas";
import { rateLimits } from "@/lib/rate-limit";
import { computeRiskScore, readProctoringSettings, resolveExamStatus } from "@/lib/exams/status";

const MAX_PAGE_SIZE = 200;

/* ------------------------------------------------------------------ exams */

export async function createExam(data: {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  batchId: string;
  allowRunCode?: boolean;
  shuffleOptions?: boolean;
  negativeMarking?: number;
  subjects?: string[];
  proctoring?: Prisma.InputJsonValue;
}) {
  const teacher = await requireTeacher();
  const input = parseInput(createExamSchema, data);
  await assertBatchAccess(input.batchId, teacher);

  const exam = await prisma.exam.create({
    data: {
      title: input.title,
      description: input.description,
      startTime: input.startTime,
      endTime: input.endTime,
      duration: input.duration,
      batchId: input.batchId,
      allowRunCode: input.allowRunCode ?? true,
      shuffleOptions: input.shuffleOptions ?? true,
      negativeMarking: input.negativeMarking ?? 0,
      subjects: input.subjects ?? [],
      proctoring: (input.proctoring ?? {}) as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });

  revalidatePath("/teacher/exams");
  return exam;
}

/**
 * Teacher-scoped exam list, ordered newest first.
 * Capped at MAX_PAGE_SIZE so the page can never load an unbounded result set (the paged,
 * filterable variant arrives with the filtering system).
 */
export async function getTeacherExams() {
  const teacher = await requireTeacher();

  return await prisma.exam.findMany({
    where: teacherExamScope(teacher),
    include: {
      batch: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          questions: true,
          sessions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_PAGE_SIZE,
  });
}

interface QuestionInput {
  type: "MCQ" | "CODING";
  content: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  testCases?: { input: string; output: string }[];
  points?: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  topic?: string;
  tags?: string[];
  bloomLevel?: string;
  explanation?: string;
}

export async function uploadQuestions(examId: string, questions: QuestionInput[]) {
  const teacher = await requireTeacher();
  const input = parseInput(uploadQuestionsSchema, { examId, questions });
  await assertExamAccess(input.examId, teacher);

  const last = await prisma.examQuestion.findFirst({
    where: { examId: input.examId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let nextOrder = (last?.order ?? -1) + 1;

  // Pre-generate IDs so we can use createMany for high performance (averting transaction timeouts)
  const questionsWithIds = input.questions.map((question) => ({
    id: randomUUID(),
    type: question.type,
    content: question.content,
    options: (question.options ?? {}) as Prisma.InputJsonValue,
    correctAnswer: question.correctAnswer,
    testCases: (question.testCases ?? []) as Prisma.InputJsonValue,
    points: question.points ?? 1.0,
    difficulty: question.difficulty ?? ("MEDIUM" as const),
    topic: question.topic,
    tags: question.tags ?? [],
    bloomLevel: question.bloomLevel,
    explanation: question.explanation,
  }));

  const examQuestions = questionsWithIds.map((question) => ({
    id: randomUUID(),
    examId: input.examId,
    questionId: question.id,
    points: question.points,
    order: nextOrder++,
  }));

  // Transaction with explicit timeout to ensure bulk insert reliability
  await prisma.$transaction(
    async (tx) => {
      await tx.question.createMany({
        data: questionsWithIds,
      });

      await tx.examQuestion.createMany({
        data: examQuestions,
      });
    },
    {
      timeout: 15000,
    },
  );

  revalidatePath(`/teacher/exams/${examId}`);
}

export async function removeQuestionFromExam(examId: string, questionId: string) {
  const teacher = await requireTeacher();
  const input = parseInput(examQuestionRefSchema, { examId, questionId });
  await assertExamAccess(input.examId, teacher);

  // Remove the mapping.
  // Note: We might want to delete the Question record too if it's not used elsewhere,
  // but for now, just removing the link is safer and matches the UI.
  await prisma.examQuestion.delete({
    where: {
      examId_questionId: {
        examId: input.examId,
        questionId: input.questionId,
      },
    },
  });

  revalidatePath(`/teacher/exams/${examId}`);
}

/**
 * Updates an existing question and its associated points in an exam.
 * @param examId The ID of the exam
 * @param questionId The ID of the question to update
 * @param data The updated question data
 */
export async function updateQuestion(examId: string, questionId: string, data: QuestionInput) {
  const teacher = await requireTeacher();
  const input = parseInput(updateQuestionSchema, { examId, questionId, data });
  await assertExamAccess(input.examId, teacher);

  // Ensure the question actually belongs to this exam before mutating it.
  const mapping = await prisma.examQuestion.findUnique({
    where: { examId_questionId: { examId: input.examId, questionId: input.questionId } },
    select: { id: true },
  });

  if (!mapping) {
    throw new NotFoundOrUnauthorizedError("That question is not part of this exam.");
  }

  await prisma.$transaction([
    prisma.question.update({
      where: { id: input.questionId },
      data: {
        type: input.data.type,
        content: input.data.content,
        options: (input.data.options ?? {}) as Prisma.InputJsonValue,
        correctAnswer: input.data.correctAnswer,
        testCases: (input.data.testCases ?? []) as Prisma.InputJsonValue,
        points: input.data.points ?? 1.0,
        difficulty: input.data.difficulty ?? "MEDIUM",
        topic: input.data.topic,
        tags: input.data.tags ?? [],
        bloomLevel: input.data.bloomLevel,
        explanation: input.data.explanation,
      },
    }),
    prisma.examQuestion.update({
      where: {
        examId_questionId: {
          examId: input.examId,
          questionId: input.questionId,
        },
      },
      data: {
        points: input.data.points ?? 1.0,
      },
    }),
  ]);

  revalidatePath(`/teacher/exams/${examId}`);
}

/**
 * Fetches all student exam sessions and their totals for a specific exam.
 * Totals now come from the denormalized columns written at submit time.
 */
export async function getExamResults(examId: string) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  const results = await prisma.studentExamSession.findMany({
    where: { examId: id },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          prn: true,
        },
      },
      submissions: {
        select: {
          pointsAwarded: true,
          isCorrect: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: MAX_PAGE_SIZE,
  });

  return results.map((session) => ({
    ...session,
    totalScore: session.totalScore,
    correctAnswers: session.submissions.filter((sub) => sub.isCorrect).length,
  }));
}

/**
 * Fetches exams available for the currently logged-in student.
 */
export async function getStudentExams() {
  const student = await requireStudent();

  return await prisma.exam.findMany({
    where: {
      published: true,
      status: { not: "ARCHIVED" },
      batch: {
        students: {
          some: { id: student.id },
        },
      },
    },
    include: {
      batch: {
        select: { name: true },
      },
      sessions: {
        where: { studentId: student.id },
        select: { status: true },
      },
      _count: {
        select: { questions: true },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_PAGE_SIZE,
  });
}

/* ------------------------------------------------------------- exam taking */

/**
 * Initializes or resumes an exam session for a student.
 *
 * Authorization is enforced here (not only in the page): the exam must be published, assigned to
 * one of the student's batches, and inside its scheduled window. Server actions are callable
 * directly, so page-level checks are not a security boundary.
 */
export async function startExamSession(examId: string) {
  const student = await requireStudent();
  const id = parseInput(idSchema, examId);

  const existing = await prisma.studentExamSession.findUnique({
    where: { studentId_examId: { studentId: student.id, examId: id } },
    include: {
      student: { select: { name: true, prn: true } },
      exam: { select: { shuffleOptions: true } },
    },
  });

  if (existing && (existing.status === "COMPLETED" || existing.status === "FORCE_SUBMITTED")) {
    return existing;
  }

  const exam = await assertStudentExamAccess(id, student.id).catch(async (error) => {
    // A session that was already running when the window closed must be finalised (not lost),
    // otherwise the student would be stuck with a session that can never be submitted.
    if (existing && existing.status === "STARTED" && new Date() > (await getExamEndTime(id))) {
      return null;
    }
    throw error;
  });

  if (!exam && existing) {
    return await finalizeSession(existing.id, "FORCE_SUBMITTED");
  }
  if (!exam) {
    throw new NotFoundOrUnauthorizedError("Exam not found.");
  }

  if (existing && existing.status !== "NOT_STARTED") {
    return existing;
  }

  const examQuestions = await prisma.examQuestion.findMany({
    where: { examId: id },
    include: { question: { select: { id: true, type: true, options: true } } },
  });

  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  if (examQuestions.length === 0) {
    throw new Error("This exam has no questions yet. Please contact your teacher.");
  }

  // Fisher-Yates shuffle — unlike sort(() => Math.random() - 0.5) it is unbiased.
  const shuffledIds = shuffleArray(examQuestions.map((question) => question.questionId));

  const optionsMapping: Record<string, string[]> = {};
  if (exam.shuffleOptions) {
    examQuestions.forEach((examQuestion) => {
      if (examQuestion.question.type === "MCQ" && examQuestion.question.options) {
        const keys = Object.keys(examQuestion.question.options as Record<string, string>);
        optionsMapping[examQuestion.questionId] = shuffleArray(keys);
      }
    });
  }

  const sessionData = {
    status: "STARTED" as const,
    startTime: new Date(),
    questionsOrder: shuffledIds,
    optionsMapping: optionsMapping as Prisma.InputJsonValue,
    ipAddress,
    userAgent,
    lastHeartbeatAt: new Date(),
  };

  const examSession = existing
    ? await prisma.studentExamSession.update({
        where: { id: existing.id },
        data: sessionData,
        include: {
          student: { select: { name: true, prn: true } },
          exam: { select: { shuffleOptions: true } },
        },
      })
    : await prisma.studentExamSession.create({
        data: { studentId: student.id, examId: id, ...sessionData },
        include: {
          student: { select: { name: true, prn: true } },
          exam: { select: { shuffleOptions: true } },
        },
      });

  await prisma.proctorEvent.create({
    data: {
      sessionId: examSession.id,
      type: "EXAM_STARTED",
      severity: 0,
      metadata: { ipAddress, userAgent },
    },
  });

  await safePusherTrigger(examChannel(id), "student-joined", {
    studentId: student.id,
    studentName: examSession.student.name,
    prn: examSession.student.prn,
    startTime: examSession.startTime,
    ipAddress,
  });

  return examSession;
}

/**
 * Saves a student's answer for a specific question.
 * Validates that the question belongs to the exam, that the payload matches the question type,
 * and that the exam is still open before writing.
 */
export async function saveSubmission(
  sessionId: string,
  questionId: string,
  answer: {
    mcqAnswer?: string;
    codeAnswer?: string;
    language?: string;
  },
) {
  const student = await requireStudent();
  const input = parseInput(saveSubmissionSchema, { sessionId, questionId, answer });
  await rateLimits.submission(input.sessionId);

  const examSession = await prisma.studentExamSession.findFirst({
    where: { id: input.sessionId, studentId: student.id, status: "STARTED" },
    include: {
      exam: {
        select: {
          id: true,
          duration: true,
          endTime: true,
          questions: {
            where: { questionId: input.questionId },
            select: {
              question: { select: { id: true, type: true, options: true } },
            },
          },
        },
      },
    },
  });

  if (!examSession) {
    throw new NotFoundOrUnauthorizedError("Active session not found.");
  }

  const examQuestion = examSession.exam.questions[0];
  if (!examQuestion) {
    throw new NotFoundOrUnauthorizedError("That question is not part of this exam.");
  }

  const question = examQuestion.question;

  if (question.type === "MCQ") {
    const optionKeys = Object.keys((question.options ?? {}) as Record<string, string>);
    if (input.answer.mcqAnswer !== undefined && !optionKeys.includes(input.answer.mcqAnswer)) {
      throw new NotFoundOrUnauthorizedError("That option does not belong to this question.");
    }
    if (input.answer.codeAnswer !== undefined) {
      throw new NotFoundOrUnauthorizedError("This question does not accept code answers.");
    }
  } else if (input.answer.mcqAnswer !== undefined) {
    throw new NotFoundOrUnauthorizedError("This question does not accept multiple-choice answers.");
  }

  const now = new Date();
  if (now > examSession.exam.endTime) {
    throw new Error("Exam has ended");
  }

  // Check if session duration has expired (with 1-minute grace period)
  if (examSession.startTime) {
    const elapsedMinutes = (now.getTime() - new Date(examSession.startTime).getTime()) / (60 * 1000);
    const gracePeriodMinutes = 1.0;
    if (elapsedMinutes > examSession.exam.duration + gracePeriodMinutes) {
      await finalizeSession(input.sessionId, "FORCE_SUBMITTED");
      throw new Error("Exam duration has expired. Your answers have been submitted.");
    }
  }

  const [submission] = await prisma.$transaction([
    prisma.submission.upsert({
      where: {
        sessionId_questionId: {
          sessionId: input.sessionId,
          questionId: input.questionId,
        },
      },
      update: {
        mcqAnswer: input.answer.mcqAnswer,
        codeAnswer: input.answer.codeAnswer,
        language: input.answer.language,
        submittedAt: new Date(),
      },
      create: {
        sessionId: input.sessionId,
        questionId: input.questionId,
        mcqAnswer: input.answer.mcqAnswer,
        codeAnswer: input.answer.codeAnswer,
        language: input.answer.language,
      },
    }),
    // Autosaves double as a liveness signal for the invigilator.
    prisma.studentExamSession.update({
      where: { id: input.sessionId },
      data: { lastHeartbeatAt: new Date() },
    }),
  ]);

  const answeredCount = await prisma.submission.count({
    where: { sessionId: input.sessionId },
  });

  await safePusherTrigger(examChannel(examSession.exam.id), "answer-saved", {
    studentId: student.id,
    answeredCount,
  });

  return submission;
}

/** Lightweight liveness beacon so the live monitor can tell "idle" from "disconnected". */
export async function heartbeat(sessionId: string) {
  const student = await requireStudent();
  const input = parseInput(sessionIdSchema, { sessionId });
  await rateLimits.heartbeat(input.sessionId);

  const updated = await prisma.studentExamSession.updateMany({
    where: { id: input.sessionId, studentId: student.id, status: "STARTED" },
    data: { lastHeartbeatAt: new Date() },
  });

  if (updated.count === 0) {
    throw new NotFoundOrUnauthorizedError("Active session not found.");
  }

  return { ok: true, serverTime: new Date().toISOString() };
}

/** Student-initiated submission. */
export async function submitExam(sessionId: string) {
  const student = await requireStudent();
  const input = parseInput(sessionIdSchema, { sessionId });

  const session = await prisma.studentExamSession.findFirst({
    where: { id: input.sessionId, studentId: student.id },
    select: { id: true },
  });

  if (!session) {
    throw new NotFoundOrUnauthorizedError("Session not found.");
  }

  return finalizeSession(session.id, "COMPLETED");
}

/* --------------------------------------------------------------- analytics */

/**
 * Fetches advanced analytics for a specific exam.
 */
export async function getExamAnalytics(examId: string) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      questions: {
        include: {
          question: true,
        },
        orderBy: { order: "asc" },
      },
      sessions: {
        where: {
          status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
        },
        include: {
          submissions: true,
        },
        take: MAX_PAGE_SIZE,
      },
    },
  });

  if (!exam) throw new NotFoundOrUnauthorizedError("Exam not found.");

  const totalCompleted = exam.sessions.length;

  // Question-level metrics
  const questionMetrics = exam.questions.map((examQuestion) => {
    const submissions = exam.sessions.flatMap((session) =>
      session.submissions.filter((sub) => sub.questionId === examQuestion.questionId),
    );

    const correctCount = submissions.filter((sub) => sub.isCorrect).length;
    const avgScore =
      submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0) / (totalCompleted || 1);
    const successRate = (correctCount / (totalCompleted || 1)) * 100;

    let difficulty = "Medium";
    if (successRate > 80) difficulty = "Easy";
    else if (successRate < 40) difficulty = "Hard";

    return {
      questionId: examQuestion.questionId,
      content: examQuestion.question.content,
      type: examQuestion.question.type,
      topic: examQuestion.question.topic,
      declaredDifficulty: examQuestion.question.difficulty,
      successRate,
      avgScore,
      difficulty,
      totalPoints: examQuestion.points,
    };
  });

  // Score distribution (denormalized totalScore written at submit time)
  const scores = exam.sessions.map((session) => session.totalScore);

  return {
    totalCompleted,
    questionMetrics,
    scores,
    maxPossibleScore: exam.questions.reduce((sum, question) => sum + question.points, 0),
  };
}

/* -------------------------------------------------------------- proctoring */

/**
 * Logs a proctoring violation, appends it to the immutable audit trail, and force-submits the
 * exam once the threshold configured on the exam is reached.
 */
export async function logTabSwitch(sessionId: string) {
  return await logProctorEvent({ sessionId, type: "TAB_BLUR" });
}

/**
 * Generic proctoring event logger (tab blur, fullscreen exit, clipboard attempt, duplicate tab…).
 * Every event is persisted in `ProctorEvent` so an invigilator can reconstruct a timeline instead
 * of staring at a single counter.
 */
export async function logProctorEvent(event: {
  sessionId: string;
  type:
    | "TAB_BLUR"
    | "FULLSCREEN_EXIT"
    | "CLIPBOARD_ATTEMPT"
    | "DEVTOOLS_ATTEMPT"
    | "DUPLICATE_TAB"
    | "IP_COLLISION";
  metadata?: Record<string, unknown>;
}) {
  const student = await requireStudent();
  const input = parseInput(proctorEventSchema, event);
  await rateLimits.proctorEvent(input.sessionId);

  const session = await prisma.studentExamSession.findFirst({
    where: { id: input.sessionId, studentId: student.id, status: "STARTED" },
    include: {
      student: { select: { name: true, prn: true } },
      exam: { select: { id: true, proctoring: true } },
    },
  });

  if (!session) {
    throw new NotFoundOrUnauthorizedError("Active session not found.");
  }

  const settings = readProctoringSettings(session.exam.proctoring);
  const countsTabSwitch = input.type === "TAB_BLUR" || input.type === "FULLSCREEN_EXIT";

  const [updated] = await prisma.$transaction([
    prisma.studentExamSession.update({
      where: { id: session.id },
      data: {
        tabSwitches: countsTabSwitch ? { increment: 1 } : undefined,
        violationCount: countsTabSwitch ? { increment: 1 } : undefined,
        isBlurred: countsTabSwitch ? true : undefined,
        lastHeartbeatAt: new Date(),
      },
      include: {
        student: { select: { name: true, prn: true } },
        exam: { select: { id: true } },
      },
    }),
    prisma.proctorEvent.create({
      data: {
        sessionId: session.id,
        type: input.type as ProctorEventType,
        severity: countsTabSwitch ? 2 : 1,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    }),
  ]);

  // Recompute the 0–100 risk score from the event trail (cheap aggregate, one row per type).
  const grouped = await prisma.proctorEvent.groupBy({
    by: ["type"],
    where: { sessionId: session.id },
    _count: { _all: true },
  });
  const riskScore = computeRiskScore(
    Object.fromEntries(grouped.map((row) => [row.type, row._count._all])),
  );
  await prisma.studentExamSession.update({ where: { id: session.id }, data: { riskScore } });

  await safePusherTrigger(examChannel(session.exam.id), "tab-switch", {
    studentId: student.id,
    studentName: updated.student.name,
    prn: updated.student.prn,
    totalSwitches: updated.tabSwitches,
    eventType: input.type,
    riskScore,
  });

  if (countsTabSwitch && updated.tabSwitches >= settings.maxTabSwitches) {
    const finalSession = await finalizeSession(session.id, "FORCE_SUBMITTED");
    if (finalSession) {
      return { ...updated, status: finalSession.status };
    }
  }

  return updated;
}

/**
 * Resets or sets the blur state on a student session.
 */
export async function updateBlurState(sessionId: string, isBlurred: boolean) {
  const student = await requireStudent();
  const input = parseInput(updateBlurStateSchema, { sessionId, isBlurred });

  await prisma.studentExamSession.updateMany({
    where: { id: input.sessionId, studentId: student.id },
    data: { isBlurred: input.isBlurred },
  });
}

/* ------------------------------------------------------------- exam admin */

/**
 * Duplicates an existing exam along with all its questions. The copy always starts as an
 * unpublished draft so a duplicate can never silently go live.
 */
export async function duplicateExam(examId: string, targetBatchId?: string) {
  const teacher = await requireTeacher();
  const input = parseInput(duplicateExamSchema, { examId, targetBatchId });

  const sourceExam = await assertExamAccess(input.examId, teacher, {
    id: true,
    title: true,
    description: true,
    startTime: true,
    endTime: true,
    duration: true,
    batchId: true,
    allowRunCode: true,
    shuffleOptions: true,
    negativeMarking: true,
    subjects: true,
    proctoring: true,
    questions: { select: { questionId: true, points: true, order: true } },
  });

  if (input.targetBatchId) {
    await assertBatchAccess(input.targetBatchId, teacher);
  }

  const newExam = await prisma.exam.create({
    data: {
      title: `${sourceExam.title} (Copy)`,
      description: sourceExam.description,
      startTime: sourceExam.startTime,
      endTime: sourceExam.endTime,
      duration: sourceExam.duration,
      batchId: input.targetBatchId || sourceExam.batchId,
      allowRunCode: sourceExam.allowRunCode,
      shuffleOptions: sourceExam.shuffleOptions,
      negativeMarking: sourceExam.negativeMarking,
      subjects: sourceExam.subjects,
      proctoring: (sourceExam.proctoring ?? {}) as Prisma.InputJsonValue,
      published: false,
      status: "DRAFT",
      questions: {
        create: sourceExam.questions.map((question) => ({
          questionId: question.questionId,
          points: question.points,
          order: question.order,
        })),
      },
    },
  });

  revalidatePath("/teacher/exams");
  return newExam;
}

/**
 * Publishes an exam so that it becomes visible and accessible to students.
 * @param examId The ID of the exam to publish
 */
export async function publishExam(examId: string) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);

  const exam = await assertExamAccess(id, teacher, {
    id: true,
    published: true,
    startTime: true,
    endTime: true,
    examCode: true,
  });

  const updatedExam = await prisma.exam.update({
    where: { id },
    data: {
      published: true,
      status: resolveExamStatus({
        published: true,
        startTime: exam.startTime,
        endTime: exam.endTime,
      }),
      examCode: exam.examCode ?? `SA-${randomUUID().slice(0, 8).toUpperCase()}`,
    },
  });

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath("/teacher/exams");
  revalidatePath("/student");

  return updatedExam;
}

/* ----------------------------------------------------------------- internal */

/** Not exported: every export of a "use server" module is a publicly callable endpoint. */
async function finalizeSession(sessionId: string, status: "COMPLETED" | "FORCE_SUBMITTED") {
  const examSession = await prisma.studentExamSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: {
        include: {
          questions: {
            include: {
              question: true,
            },
          },
        },
      },
      submissions: true,
    },
  });

  if (!examSession) {
    throw new NotFoundOrUnauthorizedError("Session not found.");
  }

  if (examSession.status === "COMPLETED" || examSession.status === "FORCE_SUBMITTED") {
    return examSession;
  }

  const { evaluateCode } = await import("@/lib/judge0/evaluate");

  type GradeableEntry = {
    submission: (typeof examSession.submissions)[number];
    examQuestion: (typeof examSession.exam.questions)[number];
  };

  const gradeable: GradeableEntry[] = examSession.submissions
    .map((submission) => {
      const examQuestion = examSession.exam.questions.find(
        (question) => question.questionId === submission.questionId,
      );
      return examQuestion ? { submission, examQuestion } : null;
    })
    .filter((entry): entry is GradeableEntry => entry !== null);

  // Coding submissions are graded with a small concurrency pool; sequential grading of a large
  // exam can exceed the serverless function timeout and leave sessions half-graded.
  const updates = await mapWithConcurrency(gradeable, 3, async ({ submission, examQuestion }) => {
    const question = examQuestion.question;
    let isCorrect = false;
    let pointsAwarded = 0;

    if (question.type === "MCQ") {
      isCorrect = submission.mcqAnswer === question.correctAnswer;
      pointsAwarded = isCorrect ? examQuestion.points : 0;
    } else if (question.type === "CODING") {
      const testCases = question.testCases as { input: string; output: string }[] | null;
      if (testCases && testCases.length > 0 && submission.codeAnswer) {
        try {
          const evalResult = await evaluateCode(
            submission.codeAnswer,
            submission.language || "python",
            testCases,
          );
          isCorrect = evalResult.isCorrect;
          pointsAwarded = (evalResult.passed / (evalResult.total || 1)) * examQuestion.points;
        } catch (evalErr) {
          console.error(`Failed to evaluate code for submission ${submission.id}:`, evalErr);
          isCorrect = false;
          pointsAwarded = 0;
        }
      }
    }

    // Negative marking applies to attempted-but-wrong answers only.
    const attempted = Boolean(submission.codeAnswer || submission.mcqAnswer);
    if (!isCorrect && attempted && examSession.exam.negativeMarking > 0) {
      pointsAwarded = -Math.abs(examSession.exam.negativeMarking);
    }

    return {
      submissionId: submission.id,
      isCorrect,
      pointsAwarded,
    };
  });

  // Persist grades in batches to avoid connection-pool exhaustion.
  const batchSize = 10;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    await Promise.all(
      batch.map((update) =>
        prisma.submission.update({
          where: { id: update.submissionId },
          data: {
            isCorrect: update.isCorrect,
            pointsAwarded: update.pointsAwarded,
          },
        }),
      ),
    );
  }

  const maxScore = examSession.exam.questions.reduce((sum, question) => sum + question.points, 0);
  const rawScore = updates.reduce((sum, update) => sum + update.pointsAwarded, 0);
  const totalScore = Math.max(0, rawScore);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;

  const grouped = await prisma.proctorEvent.groupBy({
    by: ["type"],
    where: { sessionId },
    _count: { _all: true },
  });
  const riskScore = computeRiskScore(
    Object.fromEntries(grouped.map((row) => [row.type, row._count._all])),
  );

  const now = new Date();
  await prisma.studentExamSession.update({
    where: { id: sessionId },
    data: {
      status,
      endTime: now,
      submittedAt: now,
      totalScore,
      maxScore,
      percentage,
      violationCount: examSession.tabSwitches,
      riskScore,
    },
  });

  await prisma.proctorEvent.create({
    data: {
      sessionId,
      type: status === "FORCE_SUBMITTED" ? "FORCE_SUBMITTED" : "EXAM_SUBMITTED",
      severity: status === "FORCE_SUBMITTED" ? 3 : 0,
    },
  });

  await safePusherTrigger(examChannel(examSession.examId), "student-submitted", {
    studentId: examSession.studentId,
    status,
    totalScore,
    percentage,
  });

  revalidatePath("/student");
  revalidatePath(`/student/exams/${examSession.examId}`);
  revalidatePath(`/student/exams/${examSession.examId}/result`);
  revalidatePath(`/teacher/exams/${examSession.examId}/results`);
  revalidatePath(`/teacher/exams/${examSession.examId}/live`);

  // Automatically attempt to issue a certificate if they passed.
  try {
    const { issueCertificateInternal } = await import("@/lib/certificates/issue");
    await issueCertificateInternal(examSession.examId, examSession.studentId);
  } catch (err) {
    // Silently fail if they didn't pass or other issues,
    // as certificates can be generated later manually too.
    console.log("Auto-certificate issuance skipped or failed:", (err as Error).message);
  }

  return await prisma.studentExamSession.findUnique({ where: { id: sessionId } });
}

async function getExamEndTime(examId: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { endTime: true } });
  return exam?.endTime ?? new Date(0);
}

async function safePusherTrigger(channel: string, event: string, payload: Record<string, unknown>) {
  if (!isPusherConfigured) return;
  try {
    await pusherServer.trigger(channel, event, payload);
  } catch (err) {
    console.error(`Pusher "${event}" event failed:`, err);
  }
}

/** Unbiased Fisher-Yates shuffle. */
function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
