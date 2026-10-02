export type ExamLifecycleStatus = "DRAFT" | "UPCOMING" | "ACTIVE" | "EXPIRED" | "ARCHIVED";

export interface ExamLifecycleInput {
  published: boolean;
  startTime: Date | string;
  endTime: Date | string;
  status?: string | null;
}

/**
 * Derived lifecycle status of an exam.
 *
 * The database stores `Exam.status` so lists can filter in SQL, but the *displayed* status must
 * always be recomputed from the timestamps: a row is written once at publish time and would
 * otherwise claim "UPCOMING" forever. This helper is the single definition used by every page
 * (previously this logic was re-implemented inline in three different components).
 */
export function resolveExamStatus(exam: ExamLifecycleInput, now: Date = new Date()): ExamLifecycleStatus {
  if (exam.status === "ARCHIVED") return "ARCHIVED";
  if (!exam.published) return "DRAFT";

  const start = new Date(exam.startTime);
  const end = new Date(exam.endTime);

  if (now < start) return "UPCOMING";
  if (now > end) return "EXPIRED";
  return "ACTIVE";
}

const VIOLATION_WEIGHTS: Record<string, number> = {
  TAB_BLUR: 20,
  FULLSCREEN_EXIT: 20,
  CLIPBOARD_ATTEMPT: 10,
  DEVTOOLS_ATTEMPT: 30,
  DUPLICATE_TAB: 15,
  IP_COLLISION: 15,
  HEARTBEAT_MISSED: 5,
};

/**
 * 0–100 proctoring risk score. Deliberately simple and explainable: an invigilator must be able
 * to see *why* a student is flagged, so the score is the capped sum of weighted event counts.
 */
export function computeRiskScore(counts: Partial<Record<string, number>>): number {
  const total = Object.entries(counts).reduce(
    (sum, [type, count]) => sum + (VIOLATION_WEIGHTS[type] ?? 0) * (count ?? 0),
    0,
  );
  return Math.min(100, Math.round(total));
}

export const DEFAULT_MAX_TAB_SWITCHES = 3;

export interface ProctoringSettings {
  maxTabSwitches: number;
  blockClipboard: boolean;
  requireFullscreen: boolean;
}

/** Reads the per-exam proctoring settings, falling back to the historic hard-coded defaults. */
export function readProctoringSettings(raw: unknown): ProctoringSettings {
  const value = (raw ?? {}) as Partial<ProctoringSettings>;
  return {
    maxTabSwitches:
      typeof value.maxTabSwitches === "number" ? value.maxTabSwitches : DEFAULT_MAX_TAB_SWITCHES,
    blockClipboard: value.blockClipboard ?? true,
    requireFullscreen: value.requireFullscreen ?? true,
  };
}
