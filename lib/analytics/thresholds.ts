/**
 * Psychometric thresholds and configuration standards for item analysis.
 * Single source of truth for difficulty, discrimination, and reliability evaluations.
 */

export const MIN_N_FOR_PSYCHOMETRICS = 10;
export const FACILITY_TOO_EASY = 0.85;
export const FACILITY_TOO_HARD = 0.25;
export const DISCRIMINATION_MIN = 0.1;
export const DISCRIMINATION_NEGATIVE = 0.0;
export const ALPHA_ACCEPTABLE = 0.7;
export const UPPER_LOWER_FRACTION = 0.27;
export const MAX_SESSIONS_FOR_ANALYSIS = 2000;

export const PSYCHOMETRIC_THRESHOLDS = {
  MIN_N_FOR_PSYCHOMETRICS,
  FACILITY_TOO_EASY,
  FACILITY_TOO_HARD,
  DISCRIMINATION_MIN,
  DISCRIMINATION_NEGATIVE,
  ALPHA_ACCEPTABLE,
  UPPER_LOWER_FRACTION,
  MAX_SESSIONS_FOR_ANALYSIS,
} as const;

export const ITEM_FLAG_LABELS = {
  TOO_EASY: "Very Easy (p ≥ 0.85)",
  TOO_HARD: "Very Difficult (p ≤ 0.25)",
  WEAK_DISCRIMINATION: "Weak Discrimination (r < 0.10)",
  NEGATIVE_DISCRIMINATION: "Negative Discrimination (Critical: Key/Wording Error)",
  NON_FUNCTIONING_DISTRACTOR: "Non-functioning Distractor",
  INSUFFICIENT_DATA: "Insufficient Data (N < 10)",
} as const;
