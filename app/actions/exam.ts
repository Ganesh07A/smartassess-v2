"use server";

import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { revalidatePath } from "next/cache";

export async function createExam(data: {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  batchId: string;
  allowRunCode?: boolean;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const exam = await prisma.exam.create({
    data: {
      ...data,
      allowRunCode: data.allowRunCode ?? true,
    },
  });

  revalidatePath("/teacher/exams");
  return exam;
}

export async function getTeacherExams() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  return await prisma.exam.findMany({
    where: {
      batch: {
        teacherId: session.user.id,
      },
    },
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
      startTime: "desc",
    },
  });
}

interface QuestionInput {
  type: "MCQ" | "CODING";
  content: string;
  options?: Record<string, string>;
  correctAnswer?: string;
  testCases?: { input: string; output: string }[];
  points?: number;
}

export async function uploadQuestions(examId: string, questions: QuestionInput[]) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Transaction to ensure all questions and mappings are created together
  return await prisma.$transaction(async (tx) => {
    for (const q of questions) {
      const question = await tx.question.create({
        data: {
          type: q.type, // MCQ or CODING
          content: q.content,
          options: q.options || {},
          correctAnswer: q.correctAnswer,
          testCases: q.testCases || [],
          points: q.points || 1.0,
        },
      });

      await tx.examQuestion.create({
        data: {
          examId,
          questionId: question.id,
          points: q.points || 1.0,
          order: 0, // Default order, can be updated later
        },
      });
    }
  });

  revalidatePath(`/teacher/exams/${examId}`);
}

export async function removeQuestionFromExam(examId: string, questionId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Ensure the teacher owns the exam this question belongs to
  const exam = await prisma.exam.findUnique({
    where: { 
      id: examId,
      batch: { teacherId: session.user.id }
    },
  });

  if (!exam) {
    throw new Error("Exam not found or unauthorized");
  }

  // Remove the mapping. 
  // Note: We might want to delete the Question record too if it's not used elsewhere,
  // but for now, just removing the link is safer and matches the UI.
  await prisma.examQuestion.delete({
    where: {
      examId_questionId: {
        examId,
        questionId,
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
export async function updateQuestion(
  examId: string, 
  questionId: string, 
  data: QuestionInput
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Ensure the teacher owns the exam
  const exam = await prisma.exam.findUnique({
    where: { 
      id: examId,
      batch: { teacherId: session.user.id }
    },
  });

  if (!exam) {
    throw new Error("Exam not found or unauthorized");
  }

  // Update the question and the mapping (points)
  await prisma.$transaction([
    prisma.question.update({
      where: { id: questionId },
      data: {
        type: data.type,
        content: data.content,
        options: data.options || {},
        correctAnswer: data.correctAnswer,
        testCases: data.testCases || [],
        points: data.points || 1.0,
      },
    }),
    prisma.examQuestion.update({
      where: {
        examId_questionId: {
          examId,
          questionId,
        },
      },
      data: {
        points: data.points || 1.0,
      },
    }),
  ]);

  revalidatePath(`/teacher/exams/${examId}`);
}

/**
 * Fetches all student exam sessions and calculates their total scores for a specific exam.
 * @param examId The ID of the exam
 */
export async function getExamResults(examId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const results = await prisma.studentExamSession.findMany({
    where: {
      examId,
      exam: { batch: { teacherId: session.user.id } }
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          prn: true,
        }
      },
      submissions: {
        select: {
          pointsAwarded: true,
          isCorrect: true,
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return results.map(session => ({
    ...session,
    totalScore: session.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0),
    correctAnswers: session.submissions.filter(sub => sub.isCorrect).length,
  }));
}

/**
 * Fetches exams available for the currently logged-in student.
 */
export async function getStudentExams() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  const studentId = session.user.id;

  return await prisma.exam.findMany({
    where: {
      batch: {
        students: {
          some: { id: studentId }
        }
      }
    },
    include: {
      batch: {
        select: { name: true }
      },
      sessions: {
        where: { studentId },
        select: { status: true } // We'll calculate score later or use a field
      },
      _count: {
        select: { questions: true }
      }
    },
    orderBy: {
      startTime: "asc"
    }
  });
}

/**
 * Initializes or resumes an exam session for a student.
 * Shuffles questions on first start.
 */
export async function startExamSession(examId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  const studentId = session.user.id;

  // Check if session already exists
  let examSession = await prisma.studentExamSession.findUnique({
    where: { studentId_examId: { studentId, examId } }
  });

  if (examSession && examSession.status !== "NOT_STARTED") {
    return examSession;
  }

  // Get all questions for this exam
  const examQuestions = await prisma.examQuestion.findMany({
    where: { examId },
    select: { questionId: true }
  });

  if (examQuestions.length === 0) {
    throw new Error("This exam has no questions.");
  }

  // Shuffle question IDs
  const shuffledIds = examQuestions
    .map(q => q.questionId)
    .sort(() => Math.random() - 0.5);

  if (!examSession) {
    examSession = await prisma.studentExamSession.create({
      data: {
        studentId,
        examId,
        status: "STARTED",
        startTime: new Date(),
        questionsOrder: shuffledIds,
      }
    });
  } else {
    examSession = await prisma.studentExamSession.update({
      where: { id: examSession.id },
      data: {
        status: "STARTED",
        startTime: new Date(),
        questionsOrder: shuffledIds,
      }
    });
  }

  return examSession;
}

/**
 * Saves a student's answer for a specific question.
 */
export async function saveSubmission(
  sessionId: string,
  questionId: string,
  answer: {
    mcqAnswer?: string;
    codeAnswer?: string;
    language?: string;
  }
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  // Ensure session belongs to student and is active
  const examSession = await prisma.studentExamSession.findUnique({
    where: { 
      id: sessionId,
      studentId: session.user.id,
      status: "STARTED"
    },
    include: {
      exam: true
    }
  });

  if (!examSession) {
    throw new Error("Active session not found");
  }

  // Check if exam time is still valid
  const now = new Date();
  if (now > examSession.exam.endTime) {
    throw new Error("Exam has ended");
  }

  // Upsert submission
  return await prisma.submission.upsert({
    where: {
      sessionId_questionId: {
        sessionId,
        questionId
      }
    },
    update: {
      mcqAnswer: answer.mcqAnswer,
      codeAnswer: answer.codeAnswer,
      language: answer.language,
      submittedAt: new Date(),
    },
    create: {
      sessionId,
      questionId,
      mcqAnswer: answer.mcqAnswer,
      codeAnswer: answer.codeAnswer,
      language: answer.language,
    }
  });
}

/**
 * Marks an exam session as completed and calculates scores for MCQs and Coding questions.
 */
export async function submitExam(sessionId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  const examSession = await prisma.studentExamSession.findUnique({
    where: { 
      id: sessionId,
      studentId: session.user.id
    },
    include: {
      exam: {
        include: {
          questions: {
            include: {
              question: true
            }
          }
        }
      },
      submissions: true
    }
  });

  if (!examSession) {
    throw new Error("Session not found");
  }

  if (examSession.status === "COMPLETED") {
    return examSession;
  }

  const { evaluateCode } = await import("./judge0");

  // Calculate scores for each submission
  await prisma.$transaction(async (tx) => {
    for (const submission of examSession.submissions) {
      const examQuestion = examSession.exam.questions.find(
        eq => eq.questionId === submission.questionId
      );
      
      if (!examQuestion) continue;

      const question = examQuestion.question;
      let isCorrect = false;
      let pointsAwarded = 0;

      if (question.type === "MCQ") {
        isCorrect = submission.mcqAnswer === question.correctAnswer;
        pointsAwarded = isCorrect ? examQuestion.points : 0;
      } else if (question.type === "CODING") {
        const testCases = question.testCases as { input: string; output: string }[];
        if (testCases && testCases.length > 0 && submission.codeAnswer) {
          const evalResult = await evaluateCode(
            submission.codeAnswer, 
            submission.language || "python", 
            testCases
          );
          isCorrect = evalResult.isCorrect;
          // Partial points based on passed test cases
          pointsAwarded = (evalResult.passed / evalResult.total) * examQuestion.points;
        }
      }

      await tx.submission.update({
        where: { id: submission.id },
        data: {
          isCorrect,
          pointsAwarded,
        }
      });
    }

    await tx.studentExamSession.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        endTime: new Date(),
      }
    });
  });

  revalidatePath("/student");
  revalidatePath(`/student/exams/${examSession.examId}`);
  revalidatePath("/teacher/exams/[id]/results", "page");
}

/**
 * Logs a tab switch or full-screen exit event.
 */
export async function logTabSwitch(sessionId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  return await prisma.studentExamSession.update({
    where: { 
      id: sessionId,
      studentId: session.user.id
    },
    data: {
      tabSwitches: {
        increment: 1
      }
    }
  });
}
