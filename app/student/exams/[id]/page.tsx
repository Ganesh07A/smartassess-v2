import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { notFound, redirect } from "next/navigation";
import { startExamSession } from "@/app/actions/exam";
import ExamClient from "./exam-client";

export default async function TakeExamPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "STUDENT") {
    redirect("/login");
  }

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      batch: true,
      _count: { select: { questions: true } }
    }
  });

  if (!exam) {
    notFound();
  }

  // Ensure student is in the batch
  const studentInBatch = await prisma.batch.findFirst({
    where: {
      id: exam.batchId,
      students: { some: { id: session.user.id } }
    }
  });

  if (!studentInBatch) {
    redirect("/student");
  }

  // Initialize or resume session
  const examSession = await startExamSession(id);

  if (!examSession) {
    throw new Error("Failed to initialize exam session");
  }

  if (examSession.status === "COMPLETED") {
    redirect("/student");
  }

  // Fetch questions in the order saved in the session
  const questionsOrder = examSession.questionsOrder as string[];
  const questions = await prisma.question.findMany({
    where: { id: { in: questionsOrder } },
  });

  // Sort questions to match the saved order
  const sortedQuestions = questionsOrder.map(qId => questions.find(q => q.id === qId)!);

  // Fetch existing submissions/answers for this session
  const existingSubmissions = await prisma.submission.findMany({
    where: { sessionId: examSession.id },
    select: {
      questionId: true,
      mcqAnswer: true,
      codeAnswer: true,
      isCorrect: true,
      language: true,
    }
  });

  return (
    <ExamClient 
      exam={exam} 
      session={{
        id: examSession.id,
        startTime: examSession.startTime,
        optionsMapping: examSession.optionsMapping as Record<string, string[]> | null
      }} 
      questions={sortedQuestions.map(q => ({
        id: q.id,
        type: q.type as "MCQ" | "CODING",
        content: q.content,
        options: q.options as Record<string, string>,
        testCases: q.testCases as { input: string; output: string }[],
        points: q.points
      }))}
      initialSubmissions={existingSubmissions.map(s => ({
        questionId: s.questionId,
        mcqAnswer: s.mcqAnswer,
        codeAnswer: s.codeAnswer,
        language: s.language as string | null
      }))}
      student={{
        ...session.user,
        prn: (await prisma.user.findUnique({ where: { id: session.user.id }, select: { prn: true } }))?.prn
      }}
    />
  );
}
