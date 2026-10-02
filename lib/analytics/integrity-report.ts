/**
 * Canonical JSON payload generator and stable SHA-256 hashing for
 * Assessment Integrity Reports and invigilator evidence verification.
 */

export interface CanonicalIntegrityPayload {
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentPrn: string | null;
  sessionId: string;
  startedAt: string | null;
  submittedAt: string | null;
  totalScore: number;
  percentage: number;
  ipAddress: string | null;
  userAgent: string | null;
  events: {
    type: string;
    severity: number;
    occurredAt: string;
    metadata: Record<string, unknown> | null;
  }[];
  submissions: {
    questionId: string;
    submittedAt: string;
    pointsAwarded: number | null;
    isCorrect: boolean | null;
  }[];
}

/**
 * Normalizes an object by recursively sorting its keys so that JSON.stringify
 * produces a deterministic, byte-for-byte canonical string.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const record = obj as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortKeys(record[key]);
  }
  return sorted;
}

/**
 * Builds a deterministic canonical payload from raw session and event data.
 */
export function buildCanonicalIntegrityPayload(input: {
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentPrn: string | null;
  sessionId: string;
  startedAt: Date | string | null;
  submittedAt: Date | string | null;
  totalScore: number;
  percentage: number;
  ipAddress: string | null;
  userAgent: string | null;
  events: {
    type: string;
    severity: number;
    occurredAt: Date | string;
    metadata?: unknown;
  }[];
  submissions: {
    questionId: string;
    submittedAt: Date | string;
    pointsAwarded?: number | null;
    isCorrect?: boolean | null;
  }[];
}): CanonicalIntegrityPayload {
  const sortedEvents = [...input.events]
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .map((e) => ({
      type: e.type,
      severity: e.severity,
      occurredAt: new Date(e.occurredAt).toISOString(),
      metadata: (e.metadata as Record<string, unknown>) ?? null,
    }));

  const sortedSubmissions = [...input.submissions]
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .map((s) => ({
      questionId: s.questionId,
      submittedAt: new Date(s.submittedAt).toISOString(),
      pointsAwarded: s.pointsAwarded ?? null,
      isCorrect: s.isCorrect ?? null,
    }));

  const payload: CanonicalIntegrityPayload = {
    examId: input.examId,
    examTitle: input.examTitle,
    studentId: input.studentId,
    studentName: input.studentName,
    studentPrn: input.studentPrn ?? null,
    sessionId: input.sessionId,
    startedAt: input.startedAt ? new Date(input.startedAt).toISOString() : null,
    submittedAt: input.submittedAt ? new Date(input.submittedAt).toISOString() : null,
    totalScore: input.totalScore,
    percentage: input.percentage,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    events: sortedEvents,
    submissions: sortedSubmissions,
  };

  return sortKeys(payload) as CanonicalIntegrityPayload;
}

/**
 * Computes a hex-encoded SHA-256 hash of the canonical JSON payload.
 * Compatible with both browser WebCrypto and Node.js environments.
 */
export async function computeCanonicalHash(
  payload: CanonicalIntegrityPayload,
): Promise<string> {
  const canonicalJson = JSON.stringify(sortKeys(payload));
  const data = new TextEncoder().encode(canonicalJson);

  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node fallback for tests / SSR
  const { createHash } = await import("crypto");
  return createHash("sha256").update(data).digest("hex");
}
