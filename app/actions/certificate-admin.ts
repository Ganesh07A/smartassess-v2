"use server";

import { prisma } from "@/app/db";
import { assertExamAccess, requireTeacher, teacherExamScope } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { idSchema } from "@/lib/validation/schemas";
import { certificateFilterSchema, type CertificateFilter } from "@/lib/filters/schemas";
import {
  buildCertificateWhere,
  buildCertificateOrderBy,
  CERTIFICATE_ROW_SELECT,
  type CertificateRow,
} from "@/lib/filters/builders/certificates";
import { pageCount, paginationArgs, type PagedResult } from "@/lib/filters/pagination";
import { issueCertificateInternal, PASS_PERCENTAGE } from "@/lib/certificates/issue";
import { enforceRateLimit } from "@/lib/rate-limit";
import { revalidatePath } from "next/cache";

export async function getTeacherCertificatesPaged(
  input: Partial<CertificateFilter> = {},
): Promise<PagedResult<CertificateRow>> {
  const teacher = await requireTeacher();
  const filter = certificateFilterSchema.parse(input);

  // Retrieve all exam IDs within the teacher's authorized scope
  const teacherExams = await prisma.exam.findMany({
    where: teacherExamScope(teacher),
    select: { id: true, title: true },
  });

  const teacherExamIds = teacherExams.map((e) => e.id);
  const examTitleMap = new Map(teacherExams.map((e) => [e.id, e.title]));

  const where = buildCertificateWhere(teacherExamIds, filter);
  const orderBy = buildCertificateOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  const whereWithoutExam = buildCertificateWhere(teacherExamIds, { ...filter, exam: undefined });
  const whereWithoutGrade = buildCertificateWhere(teacherExamIds, { ...filter, grade: undefined });

  const [
    rows,
    total,
    examGroups,
    gradeGroups,
    validCount,
    revokedCount,
  ] = await Promise.all([
    prisma.certificate.findMany({
      where,
      orderBy,
      skip,
      take,
      select: CERTIFICATE_ROW_SELECT,
    }),
    prisma.certificate.count({ where }),
    prisma.certificate.groupBy({
      by: ["examId"],
      where: whereWithoutExam,
      _count: { _all: true },
    }),
    prisma.certificate.groupBy({
      by: ["grade"],
      where: whereWithoutGrade,
      _count: { _all: true },
    }),
    prisma.certificate.count({
      where: {
        AND: [where, { revokedAt: null }],
      },
    }),
    prisma.certificate.count({
      where: {
        AND: [where, { revokedAt: { not: null } }],
      },
    }),
  ]);

  const examFacets = examGroups.map((g) => ({
    value: g.examId,
    label: examTitleMap.get(g.examId) || "Exam",
    count: g._count._all,
  }));

  const gradeFacets = gradeGroups
    .filter((g) => g.grade !== null)
    .map((g) => ({
      value: g.grade as string,
      label: g.grade as string,
      count: g._count._all,
    }));

  const revokedFacets = [
    { value: "no", label: "Valid Only", count: validCount },
    { value: "yes", label: "Revoked Only", count: revokedCount },
  ];

  return {
    rows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      exam: examFacets,
      grade: gradeFacets,
      revoked: revokedFacets,
    },
  };
}

/**
 * Bulk issues certificates for all eligible candidates in an exam.
 * Idempotent: previously issued certificates are safely skipped.
 */
export async function issueCertificatesForExam(examId: string) {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  // Rate-limit bulk issuance: 1 request per exam per minute
  await enforceRateLimit(`cert:bulkIssue:${id}`, 1, 60 * 1000);

  const eligibleSessions = await prisma.studentExamSession.findMany({
    where: {
      examId: id,
      status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
      percentage: { gte: PASS_PERCENTAGE },
    },
    select: {
      studentId: true,
    },
  });

  let issuedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const s of eligibleSessions) {
    try {
      const existing = await prisma.certificate.findUnique({
        where: { studentId_examId: { studentId: s.studentId, examId: id } },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await issueCertificateInternal(id, s.studentId);
      issuedCount++;
    } catch (err) {
      console.error(`Failed to issue certificate for student ${s.studentId}:`, err);
      failedCount++;
    }
  }

  revalidatePath("/teacher/certificates");
  revalidatePath(`/teacher/exams/${id}`);

  return {
    issued: issuedCount,
    skipped: skippedCount,
    failed: failedCount,
    totalEligible: eligibleSessions.length,
  };
}

/**
 * Revokes an issued certificate with a mandatory reason.
 */
export async function revokeCertificate(
  certificateId: string,
  rawReason: string,
) {
  const teacher = await requireTeacher();
  const reason = rawReason.trim();

  if (!reason || reason.length > 500) {
    throw new Error("A valid reason for revocation is required (maximum 500 characters).");
  }

  const cert = await prisma.certificate.findFirst({
    where: {
      OR: [{ certificateId }, { id: certificateId }],
    },
    select: {
      id: true,
      examId: true,
      certificateId: true,
    },
  });

  if (!cert) {
    throw new Error("Certificate not found.");
  }

  await assertExamAccess(cert.examId, teacher);

  await prisma.certificate.update({
    where: { id: cert.id },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
      revokedById: teacher.id,
    },
  });

  revalidatePath("/teacher/certificates");
  revalidatePath(`/verify/${cert.certificateId}`);

  return { success: true };
}

/**
 * Reinstates a previously revoked certificate.
 */
export async function reinstateCertificate(certificateId: string) {
  const teacher = await requireTeacher();

  const cert = await prisma.certificate.findFirst({
    where: {
      OR: [{ certificateId }, { id: certificateId }],
    },
    select: {
      id: true,
      examId: true,
      certificateId: true,
    },
  });

  if (!cert) {
    throw new Error("Certificate not found.");
  }

  await assertExamAccess(cert.examId, teacher);

  await prisma.certificate.update({
    where: { id: cert.id },
    data: {
      revokedAt: null,
      revokedReason: null,
      revokedById: null,
    },
  });

  revalidatePath("/teacher/certificates");
  revalidatePath(`/verify/${cert.certificateId}`);

  return { success: true };
}
