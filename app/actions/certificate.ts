"use server";

import { prisma } from "@/app/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Issues a certificate to a student for a specific exam if they have passed.
 */
export async function issueCertificate(examId: string, studentId: string) {
  const session = await getServerSession(authOptions);

  if (!session) {
    throw new Error("Unauthorized");
  }

  // Fetch the completed exam session
  const examSession = await prisma.studentExamSession.findUnique({
    where: { 
      studentId_examId: { 
        studentId, 
        examId 
      } 
    },
    include: {
      submissions: true,
      exam: {
        include: {
          questions: true
        }
      }
    }
  });

  if (!examSession || (examSession.status !== "COMPLETED" && examSession.status !== "FORCE_SUBMITTED")) {
    throw new Error("Exam session not found or not completed.");
  }

  // Calculate scores
  const totalPoints = examSession.exam.questions.reduce((sum, q) => sum + q.points, 0);
  const earnedPoints = examSession.submissions.reduce((sum, sub) => sum + (sub.pointsAwarded || 0), 0);
  const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

  // Passing criteria: 40%
  if (percentage < 40) {
    throw new Error("Student did not meet the passing criteria (40%).");
  }

  // Check if certificate already exists to prevent duplicates
  const existing = await prisma.certificate.findUnique({
    where: { 
      studentId_examId: { 
        studentId, 
        examId 
      } 
    }
  });

  if (existing) {
    return existing;
  }

  // Generate a professional certificate ID (SA-YYYY-XXXX)
  const year = new Date().getFullYear();
  const count = await prisma.certificate.count();
  const certificateId = `SA-${year}-${(count + 1).toString().padStart(4, '0')}`;
  
  // Unique verification code for QR verification
  const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  // Determine grade based on percentage
  let grade = "F";
  if (percentage >= 85) grade = "O (Outstanding)";
  else if (percentage >= 75) grade = "A+ (Excellent)";
  else if (percentage >= 65) grade = "A (Very Good)";
  else if (percentage >= 55) grade = "B+ (Good)";
  else if (percentage >= 45) grade = "B (Above Average)";
  else if (percentage >= 40) grade = "C (Pass)";

  const certificate = await prisma.certificate.create({
    data: {
      certificateId,
      studentId,
      examId,
      score: earnedPoints,
      grade,
      verificationCode,
    }
  });

  revalidatePath(`/student/exams/${examId}/result`);
  revalidatePath("/student");
  
  return certificate;
}

/**
 * Fetches a certificate for a student-exam pair.
 */
export async function getCertificate(examId: string, studentId: string) {
  return await prisma.certificate.findUnique({
    where: { 
      studentId_examId: { 
        studentId, 
        examId 
      } 
    },
    include: {
      student: {
        select: { name: true, prn: true }
      },
      exam: {
        select: { title: true }
      }
    }
  });
}

/**
 * Fetches all certificates for the currently logged-in student.
 */
export async function getStudentCertificates() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  return await prisma.certificate.findMany({
    where: { studentId: session.user.id },
    include: {
      exam: {
        select: { title: true, startTime: true }
      }
    },
    orderBy: { issueDate: 'desc' }
  });
}
