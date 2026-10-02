"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/db";
import { assertExamAccess, requireStudent, requireTeacher } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { idSchema, issueCertificateSchema } from "@/lib/validation/schemas";
import { issueCertificateInternal } from "@/lib/certificates/issue";

/**
 * Manually issues a certificate to a student for a specific exam if they have passed.
 *
 * Teacher-only, and the teacher must own (or department-share) the exam: previously this action
 * only checked that *a* session existed, so any signed-in student could mint a certificate for
 * themselves or anybody else.
 */
export async function issueCertificate(examId: string, studentId: string) {
  const teacher = await requireTeacher();
  const input = parseInput(issueCertificateSchema, { examId, studentId });
  await assertExamAccess(input.examId, teacher);

  const certificate = await issueCertificateInternal(input.examId, input.studentId);

  revalidatePath(`/student/exams/${input.examId}/result`);
  revalidatePath("/student");

  return certificate;
}

/**
 * Fetches a certificate for a student-exam pair.
 *
 * Students can only read their own certificate; teachers can read one for an exam they own.
 */
export async function getCertificate(examId: string, studentId: string) {
  const input = parseInput(issueCertificateSchema, { examId, studentId });
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  if (session.user.role === "STUDENT") {
    if (session.user.id !== input.studentId) {
      throw new Error("Unauthorized");
    }
  } else if (session.user.role === "TEACHER") {
    const teacher = await requireTeacher();
    await assertExamAccess(input.examId, teacher, { id: true });
  } else {
    throw new Error("Unauthorized");
  }

  return await prisma.certificate.findUnique({
    where: {
      studentId_examId: {
        studentId: input.studentId,
        examId: input.examId,
      },
    },
    include: {
      student: {
        select: { name: true, prn: true },
      },
      exam: {
        select: { title: true },
      },
    },
  });
}

/**
 * Fetches all certificates for the currently logged-in student.
 */
export async function getStudentCertificates() {
  const student = await requireStudent();
  const studentId = parseInput(idSchema, student.id);

  return await prisma.certificate.findMany({
    where: { studentId },
    include: {
      exam: {
        select: { title: true, startTime: true },
      },
    },
    orderBy: { issueDate: "desc" },
    take: 200,
  });
}
