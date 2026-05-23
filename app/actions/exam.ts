"use server";

import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { revalidatePath } from "next/cache";
import { pusherServer } from "@/app/lib/pusher-server";
import { headers } from "next/headers";
import { randomUUID } from "crypto";

export async function createExam(data: {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  batchId: string;
  allowRunCode?: boolean;
  shuffleOptions?: boolean;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const exam = await prisma.exam.create({
    data: {
      ...data,
      allowRunCode: data.allowRunCode ?? true,
      shuffleOptions: data.shuffleOptions ?? true,
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
      createdAt: "desc",
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

  // Pre-generate IDs so we can use createMany for high performance (averting transaction timeouts)
  const questionsWithIds = questions.map((q) => ({
    id: randomUUID(),
    type: q.type,
    content: q.content,
    options: q.options || {},
    correctAnswer: q.correctAnswer,
    testCases: q.testCases || [],
    points: q.points || 1.0,
  }));

  const examQuestions = questionsWithIds.map((q) => ({
    id: randomUUID(),
    examId,
    questionId: q.id,
    points: q.points || 1.0,
    order: 0,
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
    }
  );

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
      published: true,
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
      createdAt: "desc"
    }
  });
}

/**
 * Initializes or resumes an exam session for a student.
 * Shuffles questions and optionally MCQ options on first start.
 */
export async function startExamSession(examId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  const studentId = session.user.id;
  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  const sessionInclude = {
    student: {
      select: { name: true, prn: true }
    },
    exam: {
      select: { shuffleOptions: true }
    }
  };

  // Check if session already exists
  let examSession = await prisma.studentExamSession.findUnique({
    where: { studentId_examId: { studentId, examId } },
    include: sessionInclude
  });

  if (examSession && examSession.status !== "NOT_STARTED") {
    return examSession;
  }

  // Get all questions for this exam
  const examQuestions = await prisma.examQuestion.findMany({
    where: { examId },
    include: { question: true }
  });

  if (examQuestions.length === 0) {
    throw new Error("This exam has no questions.");
  }

  // Shuffle question IDs
  const shuffledIds = examQuestions
    .map(q => q.questionId)
    .sort(() => Math.random() - 0.5);

  // Optionally shuffle MCQ options
  const optionsMapping: Record<string, string[]> = {};
  const examObj = examSession?.exam || await prisma.exam.findUnique({ where: { id: examId }, select: { shuffleOptions: true } });
  
  if (examObj?.shuffleOptions) {
    examQuestions.forEach(eq => {
      if (eq.question.type === "MCQ" && eq.question.options) {
        const keys = Object.keys(eq.question.options as Record<string, string>);
        optionsMapping[eq.questionId] = keys.sort(() => Math.random() - 0.5);
      }
    });
  }

  const upsertData = {
    status: "STARTED" as const,
    startTime: new Date(),
    questionsOrder: shuffledIds,
    optionsMapping: optionsMapping || {},
    ipAddress,
    userAgent,
  };

  if (!examSession) {
    examSession = await prisma.studentExamSession.create({
      data: {
        studentId,
        examId,
        ...upsertData,
      },
      include: sessionInclude
    });
  } else {
    examSession = await prisma.studentExamSession.update({
      where: { id: examSession.id },
      data: upsertData,
      include: sessionInclude
    });
  }

  if (!examSession) throw new Error("Failed to start exam session.");

  // Trigger Pusher event for the teacher's live dashboard
  await pusherServer.trigger(`exam-${examId}`, "student-joined", {
    studentId,
    studentName: examSession.student.name,
    prn: examSession.student.prn,
    startTime: examSession.startTime,
    ipAddress,
  });

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
  const submission = await prisma.submission.upsert({
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

  // Fetch count of submissions for this session to show progress
  const answeredCount = await prisma.submission.count({
    where: { sessionId }
  });

  // Trigger Pusher event
  await pusherServer.trigger(`exam-${examSession.examId}`, "answer-saved", {
    studentId: session.user.id,
    answeredCount,
  });

  return submission;
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

  // Trigger Pusher event
  await pusherServer.trigger(`exam-${examSession.examId}`, "student-submitted", {
    studentId: session.user.id,
  });

  revalidatePath("/student");
  revalidatePath(`/student/exams/${examSession.examId}`);
  revalidatePath("/teacher/exams/[id]/results", "page");

  // Automatically attempt to issue certificate if they passed
  try {
    const { issueCertificate } = await import("./certificate");
    await issueCertificate(examSession.examId, session.user.id);
  } catch (err) {
    // Silently fail if they didn't pass or other issues, 
    // as certificates can be generated later manually too.
    console.log("Auto-certificate issuance skipped or failed:", (err as Error).message);
  }
}

/**
 * Fetches advanced analytics for a specific exam.
 */
export async function getExamAnalytics(examId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        include: {
          question: true
        }
      },
      sessions: {
        where: { status: "COMPLETED" },
        include: {
          submissions: true
        }
      }
    }
  });

  if (!exam) throw new Error("Exam not found");

  const totalCompleted = exam.sessions.length;
  
  // Question-level metrics
  const questionMetrics = exam.questions.map(eq => {
    const submissions = exam.sessions.flatMap(s => 
      s.submissions.filter(sub => sub.questionId === eq.questionId)
    );
    
    const correctCount = submissions.filter(s => s.isCorrect).length;
    const avgScore = submissions.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0) / (totalCompleted || 1);
    const successRate = (correctCount / (totalCompleted || 1)) * 100;

    let difficulty = "Medium";
    if (successRate > 80) difficulty = "Easy";
    else if (successRate < 40) difficulty = "Hard";

    return {
      questionId: eq.questionId,
      content: eq.question.content,
      type: eq.question.type,
      successRate,
      avgScore,
      difficulty,
      totalPoints: eq.points
    };
  });

  // Score distribution
  const scores = exam.sessions.map(s => 
    s.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0)
  );

  return {
    totalCompleted,
    questionMetrics,
    scores,
    maxPossibleScore: exam.questions.reduce((sum, q) => sum + q.points, 0)
  };
}

/**
 * Logs a tab switch or full-screen exit event.
 */
export async function logTabSwitch(sessionId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  const updatedSession = await prisma.studentExamSession.update({
    where: { 
      id: sessionId,
      studentId: session.user.id
    },
    data: {
      tabSwitches: {
        increment: 1
      }
    },
    include: {
      student: {
        select: {
          name: true,
          prn: true,
        }
      },
      exam: {
        select: {
          id: true,
        }
      }
    }
  });

  // Trigger Pusher event for the teacher's live dashboard
  await pusherServer.trigger(`exam-${updatedSession.exam.id}`, "tab-switch", {
    studentId: session.user.id,
    studentName: updatedSession.student.name,
    prn: updatedSession.student.prn,
    totalSwitches: updatedSession.tabSwitches,
  });

  return updatedSession;
}

/**
 * Duplicates an existing exam along with all its questions.
 */
export async function duplicateExam(examId: string, targetBatchId?: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Fetch the source exam and its questions
  const sourceExam = await prisma.exam.findUnique({
    where: { 
      id: examId,
      batch: { teacherId: session.user.id }
    },
    include: {
      questions: true
    }
  });

  if (!sourceExam) {
    throw new Error("Source exam not found or unauthorized.");
  }

  // Create the new duplicated exam
  const newExam = await prisma.exam.create({
    data: {
      title: `${sourceExam.title} (Copy)`,
      description: sourceExam.description,
      startTime: sourceExam.startTime,
      endTime: sourceExam.endTime,
      duration: sourceExam.duration,
      batchId: targetBatchId || sourceExam.batchId,
      allowRunCode: sourceExam.allowRunCode,
      shuffleOptions: sourceExam.shuffleOptions,
      questions: {
        create: sourceExam.questions.map(q => ({
          questionId: q.questionId,
          points: q.points,
          order: q.order
        }))
      }
    }
  });

  revalidatePath("/teacher/exams");
  return newExam;
}

/**
 * Publishes an exam so that it becomes visible and accessible to students.
 * @param examId The ID of the exam to publish
 */
export async function publishExam(examId: string) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  // Verify ownership of the exam before publishing
  const exam = await prisma.exam.findUnique({
    where: { 
      id: examId,
      batch: { teacherId: session.user.id }
    },
  });

  if (!exam) {
    throw new Error("Exam not found or unauthorized");
  }

  const updatedExam = await prisma.exam.update({
    where: { id: examId },
    data: { published: true },
  });

  revalidatePath(`/teacher/exams/${examId}`);
  revalidatePath("/teacher/exams");
  revalidatePath("/student");
  
  return updatedExam;
}
