import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/app/db";

/**
 * Certificate issuance lives here (and not in `app/actions/certificate.ts`) on purpose:
 * every export of a `"use server"` module becomes a publicly callable endpoint, so internal
 * helpers that must only be invoked by trusted server code cannot live there.
 */

export const PASS_PERCENTAGE = 40;

export function gradeForPercentage(percentage: number): string {
  if (percentage >= 85) return "O (Outstanding)";
  if (percentage >= 75) return "A+ (Excellent)";
  if (percentage >= 65) return "A (Very Good)";
  if (percentage >= 55) return "B+ (Good)";
  if (percentage >= 45) return "B (Above Average)";
  if (percentage >= PASS_PERCENTAGE) return "C (Pass)";
  return "F";
}

interface ScoreSnapshot {
  earnedPoints: number;
  totalPoints: number;
  percentage: number;
}

/**
 * Prefers the denormalized columns written at submit time and only recomputes for legacy rows
 * that predate them.
 */
export async function resolveSessionScore(sessionId: string): Promise<ScoreSnapshot | null> {
  const session = await prisma.studentExamSession.findUnique({
    where: { id: sessionId },
    select: {
      maxScore: true,
      totalScore: true,
      percentage: true,
      submissions: { select: { pointsAwarded: true } },
      exam: { select: { questions: { select: { points: true } } } },
    },
  });

  if (!session) return null;

  const hasDenormalized = session.maxScore > 0 || session.submissions.length === 0;
  if (hasDenormalized) {
    return {
      earnedPoints: session.totalScore,
      totalPoints: session.maxScore,
      percentage: session.percentage,
    };
  }

  const totalPoints = session.exam.questions.reduce((sum, eq) => sum + eq.points, 0);
  const earnedPoints = session.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded ?? 0), 0);
  return {
    earnedPoints,
    totalPoints,
    percentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0,
  };
}

function certificateSequenceSql() {
  // The sequence is created by the migration; a raw nextval is atomic and race-free, unlike
  // `count() + 1` which produces duplicate certificate numbers under concurrent submissions.
  return prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('"CertificateNumber_seq"') AS nextval`;
}

/**
 * Issues a certificate if the student passed. Safe to call repeatedly and from a background
 * job: duplicate requests return the existing certificate.
 */
export async function issueCertificateInternal(examId: string, studentId: string) {
  const examSession = await prisma.studentExamSession.findUnique({
    where: { studentId_examId: { studentId, examId } },
    select: { id: true, status: true, student: { select: { name: true } }, exam: { select: { title: true } } },
  });

  if (!examSession || (examSession.status !== "COMPLETED" && examSession.status !== "FORCE_SUBMITTED")) {
    throw new Error("Exam session not found or not completed.");
  }

  const existing = await prisma.certificate.findUnique({
    where: { studentId_examId: { studentId, examId } },
  });
  if (existing) return existing;

  const score = await resolveSessionScore(examSession.id);
  if (!score) throw new Error("Unable to resolve the exam score.");

  if (score.percentage < PASS_PERCENTAGE) {
    throw new Error(`Student did not meet the passing criteria (${PASS_PERCENTAGE}%).`);
  }

  const year = new Date().getFullYear();
  const [{ nextval }] = await certificateSequenceSql();
  const certificateId = `SA-${year}-${String(Number(nextval)).padStart(4, "0")}`;
  const verificationCode = randomBytes(5).toString("hex").toUpperCase();

  try {
    return await prisma.certificate.create({
      data: {
        certificateId,
        studentId,
        examId,
        score: score.earnedPoints,
        grade: gradeForPercentage(score.percentage),
        verificationCode,
      },
    });
  } catch {
    // Concurrent issuance (e.g. submit + manual re-issue) — return whatever won the race.
    const raced = await prisma.certificate.findUnique({
      where: { studentId_examId: { studentId, examId } },
    });
    if (raced) return raced;
    throw new Error("Failed to issue the certificate.");
  }
}
