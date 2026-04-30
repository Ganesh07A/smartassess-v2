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
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const exam = await prisma.exam.create({
    data: {
      ...data,
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
