"use server";

import { prisma } from "@/app/db";
import { assertExamAccess, requireTeacher } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { idSchema } from "@/lib/validation/schemas";
import { integrityFilterSchema, type IntegrityFilter } from "@/lib/filters/schemas";
import {
  buildIntegrityWhere,
  buildIntegrityOrderBy,
  INTEGRITY_SESSION_SELECT,
  type IntegritySessionRow,
} from "@/lib/filters/builders/integrity";
import { pageCount, paginationArgs, type PagedResult } from "@/lib/filters/pagination";
import {
  buildCanonicalIntegrityPayload,
  computeCanonicalHash,
} from "@/lib/analytics/integrity-report";

export interface IntegrityConsoleSummary {
  totalSessions: number;
  flaggedCount: number;
  criticalCount: number;
  clipboardAttemptCount: number;
  duplicateIpSessionCount: number;
  averageRiskScore: number;
}

export interface IntegrityPagedResult extends PagedResult<IntegritySessionRow> {
  summary: IntegrityConsoleSummary;
}

/**
 * Fetches paginated integrity audit sessions with aggregate health metrics.
 */
export async function getExamIntegrityPaged(
  examId: string,
  input: Partial<IntegrityFilter> = {},
): Promise<IntegrityPagedResult> {
  const teacher = await requireTeacher();
  const id = parseInput(idSchema, examId);
  await assertExamAccess(id, teacher);

  const filter = integrityFilterSchema.parse(input);

  // Find duplicate IPs within this exam's sessions
  const ipGroups = await prisma.studentExamSession.groupBy({
    by: ["ipAddress"],
    where: {
      examId: id,
      ipAddress: { not: null },
      status: { not: "NOT_STARTED" },
    },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } },
    },
  });

  const duplicateIps = ipGroups
    .map((g) => g.ipAddress)
    .filter((ip): ip is string => Boolean(ip));

  const where = buildIntegrityWhere(id, filter, duplicateIps);
  const orderBy = buildIntegrityOrderBy(filter);
  const { skip, take } = paginationArgs(filter.page, filter.perPage);

  // Summary strip metrics and facet counts
  const [
    rows,
    total,
    totalSessions,
    flaggedCount,
    criticalCount,
    clipboardCount,
    dupCount,
    riskAgg,
    eventGroups,
  ] = await Promise.all([
    prisma.studentExamSession.findMany({
      where,
      orderBy,
      skip,
      take,
      select: INTEGRITY_SESSION_SELECT,
    }),
    prisma.studentExamSession.count({ where }),
    prisma.studentExamSession.count({
      where: { examId: id, status: { not: "NOT_STARTED" } },
    }),
    prisma.studentExamSession.count({
      where: { examId: id, status: { not: "NOT_STARTED" }, riskScore: { gte: 40 } },
    }),
    prisma.studentExamSession.count({
      where: { examId: id, status: { not: "NOT_STARTED" }, riskScore: { gte: 70 } },
    }),
    prisma.studentExamSession.count({
      where: {
        examId: id,
        events: { some: { type: "CLIPBOARD_ATTEMPT" } },
      },
    }),
    duplicateIps.length > 0
      ? prisma.studentExamSession.count({
          where: { examId: id, ipAddress: { in: duplicateIps } },
        })
      : 0,
    prisma.studentExamSession.aggregate({
      where: { examId: id, status: { not: "NOT_STARTED" } },
      _avg: { riskScore: true },
    }),
    prisma.proctorEvent.groupBy({
      by: ["type"],
      where: { session: { examId: id } },
      _count: { _all: true },
    }),
  ]);

  const mappedRows: IntegritySessionRow[] = rows.map((r) => ({
    ...r,
    isDuplicateIp: Boolean(r.ipAddress && duplicateIps.includes(r.ipAddress)),
  }));

  const riskFacets = [
    { value: "all", label: "All Sessions", count: totalSessions },
    { value: "flagged", label: "Flagged (Score ≥ 40)", count: flaggedCount },
    { value: "critical", label: "Critical (Score ≥ 70)", count: criticalCount },
  ];

  const typeFacets = eventGroups.map((g) => ({
    value: g.type,
    label: g.type.replace(/_/g, " "),
    count: g._count._all,
  }));

  return {
    rows: mappedRows,
    total,
    page: filter.page,
    perPage: filter.perPage,
    totalPages: pageCount(total, filter.perPage),
    facets: {
      risk: riskFacets,
      type: typeFacets,
    },
    summary: {
      totalSessions,
      flaggedCount,
      criticalCount,
      clipboardAttemptCount: clipboardCount,
      duplicateIpSessionCount: dupCount,
      averageRiskScore: Math.round(riskAgg._avg.riskScore ?? 0),
    },
  };
}

export type TimelineItem =
  | {
      kind: "proctor";
      id: string;
      timestamp: Date;
      type: string;
      severity: number;
      metadata: Record<string, unknown> | null;
    }
  | {
      kind: "submission";
      id: string;
      timestamp: Date;
      questionId: string;
      pointsAwarded: number | null;
      isCorrect: boolean | null;
    };

/**
 * Fetches an interleaved chronological timeline of proctoring events and submissions
 * for an individual student session with verified exam access.
 */
export async function getSessionIntegrityTimeline(
  examId: string,
  sessionId: string,
) {
  const teacher = await requireTeacher();
  const validExamId = parseInput(idSchema, examId);
  const validSessionId = parseInput(idSchema, sessionId);

  const exam = await assertExamAccess(validExamId, teacher, {
    id: true,
    title: true,
  });

  const session = await prisma.studentExamSession.findFirst({
    where: {
      id: validSessionId,
      examId: validExamId,
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          prn: true,
          department: true,
        },
      },
      events: {
        orderBy: { occurredAt: "asc" },
      },
      submissions: {
        select: {
          id: true,
          questionId: true,
          submittedAt: true,
          pointsAwarded: true,
          isCorrect: true,
        },
        orderBy: { submittedAt: "asc" },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Interleave events and submissions into a unified chronological stream
  const timeline: TimelineItem[] = [];

  for (const e of session.events) {
    timeline.push({
      kind: "proctor",
      id: e.id,
      timestamp: e.occurredAt,
      type: e.type,
      severity: e.severity,
      metadata: (e.metadata as Record<string, unknown>) ?? null,
    });
  }

  for (const s of session.submissions) {
    timeline.push({
      kind: "submission",
      id: s.id,
      timestamp: s.submittedAt,
      questionId: s.questionId,
      pointsAwarded: s.pointsAwarded,
      isCorrect: s.isCorrect,
    });
  }

  timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Compute canonical payload and stable SHA-256 hash for audit verification
  const canonicalPayload = buildCanonicalIntegrityPayload({
    examId: exam.id,
    examTitle: exam.title,
    studentId: session.student.id,
    studentName: session.student.name || "Student",
    studentPrn: session.student.prn,
    sessionId: session.id,
    startedAt: session.startTime,
    submittedAt: session.submittedAt,
    totalScore: session.totalScore,
    percentage: session.percentage,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    events: session.events.map((e) => ({
      type: e.type,
      severity: e.severity,
      occurredAt: e.occurredAt,
      metadata: e.metadata,
    })),
    submissions: session.submissions.map((s) => ({
      questionId: s.questionId,
      submittedAt: s.submittedAt,
      pointsAwarded: s.pointsAwarded,
      isCorrect: s.isCorrect,
    })),
  });

  const canonicalHash = await computeCanonicalHash(canonicalPayload);

  return {
    exam,
    session,
    timeline,
    canonicalPayload,
    canonicalHash,
  };
}
