import {
  MIN_N_FOR_PSYCHOMETRICS,
  FACILITY_TOO_EASY,
  FACILITY_TOO_HARD,
  DISCRIMINATION_MIN,
  DISCRIMINATION_NEGATIVE,
  UPPER_LOWER_FRACTION,
} from "./thresholds";

export type ItemFlag =
  | "TOO_EASY"
  | "TOO_HARD"
  | "WEAK_DISCRIMINATION"
  | "NEGATIVE_DISCRIMINATION"
  | "INSUFFICIENT_DATA"
  | "NON_FUNCTIONING_DISTRACTOR";

export interface ItemScore {
  questionId: string;
  maxPoints: number;
  /** One entry per included session, aligned with `totals`; null = unattempted. */
  scores: (number | null)[];
}

export interface OptionChoice {
  questionId: string;
  optionKeys: string[];
  correctKey?: string;
  /** Option key selected per session (null = unattempted), aligned with totals. */
  chosen: (string | null)[];
}

export interface ItemAnalysisInput {
  items: ItemScore[];
  /** Total score per included session, aligned with every item's `scores` array. */
  totals: number[];
  /** For MCQ distractor analysis; original option keys -> selected key per session. */
  choices?: OptionChoice[];
  /** Override minimum N requirement for testing hand-computed fixtures. */
  minN?: number;
  truncated?: boolean;
}

export interface DistractorMetric {
  key: string;
  count: number;
  upperCount: number;
  lowerCount: number;
  isKey: boolean;
}

export interface ItemAnalysis {
  questionId: string;
  attempted: number;
  facility: number | null; // mean item score / maxPoints, 0..1
  discrimination: number | null; // corrected item-total correlation, -1..1
  discriminationUpperLower: number | null; // D = (U - L) / (n_group * m_i), -1..1
  flags: ItemFlag[];
  distractors?: DistractorMetric[];
}

export interface TestAnalysis {
  n: number; // included sessions count
  alpha: number | null; // Cronbach's alpha
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
  percentile: (score: number) => number; // 0..100
  items: ItemAnalysis[];
  truncated: boolean; // true when fetch cap was hit
}

/** Compute sample/population mean */
function calcMean(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

/** Compute population variance (sum((x - mean)^2) / N) */
function calcVariance(vals: number[], mean: number): number {
  if (vals.length <= 1) return 0;
  return vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
}

/** Compute Pearson correlation between two aligned number vectors */
function calcPearsonR(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;

  const meanX = calcMean(x);
  const meanY = calcMean(y);

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) {
    return null; // Zero variance in either vector
  }

  const r = cov / Math.sqrt(varX * varY);
  return Math.max(-1, Math.min(1, r));
}

/** Compute median of numbers */
function calcMedian(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Pure function performing item analysis (facility, discrimination, distractor metrics, Cronbach's alpha).
 * No I/O, strict statistical definitions.
 */
export function analyzeTestItems(input: ItemAnalysisInput): TestAnalysis {
  const { items, totals, choices = [], minN = MIN_N_FOR_PSYCHOMETRICS, truncated = false } = input;
  const n = totals.length;
  const k = items.length;

  // 1. Descriptive stats of totals
  const meanTotal = calcMean(totals);
  const varTotal = calcVariance(totals, meanTotal);
  const sdTotal = Math.sqrt(varTotal);
  const medianTotal = calcMedian(totals);
  const minTotal = totals.length > 0 ? Math.min(...totals) : 0;
  const maxTotal = totals.length > 0 ? Math.max(...totals) : 0;

  const percentile = (score: number): number => {
    if (n === 0) return 0;
    const belowCount = totals.filter((t) => t < score).length;
    return (belowCount / n) * 100;
  };

  // 2. Identify top and bottom groups for discrimination and distractor analysis
  // Sort session indices by total score descending
  const sessionIndices = Array.from({ length: n }, (_, i) => i);
  sessionIndices.sort((a, b) => totals[b] - totals[a]);

  const nGroup = Math.floor(UPPER_LOWER_FRACTION * n);
  const canComputeUpperLower =
    n >= minN && nGroup >= 3 && 2 * nGroup <= n;

  const upperGroupIndices = canComputeUpperLower ? sessionIndices.slice(0, nGroup) : [];
  const lowerGroupIndices = canComputeUpperLower ? sessionIndices.slice(n - nGroup) : [];

  const choicesByQuestion = new Map(choices.map((c) => [c.questionId, c]));

  // 3. Process each item
  const itemAnalyses: ItemAnalysis[] = [];
  const itemVariances: number[] = [];

  for (const item of items) {
    const scores = item.scores.map((s) => s ?? 0); // Unattempted treated as 0 earned points
    const attemptedCount = item.scores.filter((s) => s !== null).length;
    const maxPoints = item.maxPoints > 0 ? item.maxPoints : 1;

    // Facility index (p-value): mean earned points / max points
    const meanItemScore = calcMean(scores);
    const itemVariance = calcVariance(scores, meanItemScore);
    itemVariances.push(itemVariance);

    const facility = Math.max(0, Math.min(1, meanItemScore / maxPoints));

    // Corrected item-total correlation (rest score r)
    let discrimination: number | null = null;
    if (n >= minN) {
      const restScores = totals.map((t, idx) => t - scores[idx]);
      discrimination = calcPearsonR(scores, restScores);
    }

    // Upper-Lower discrimination D = (sum_upper - sum_lower) / (nGroup * maxPoints)
    let discriminationUpperLower: number | null = null;
    if (canComputeUpperLower) {
      const sumUpper = upperGroupIndices.reduce((sum, idx) => sum + scores[idx], 0);
      const sumLower = lowerGroupIndices.reduce((sum, idx) => sum + scores[idx], 0);
      const d = (sumUpper - sumLower) / (nGroup * maxPoints);
      discriminationUpperLower = Math.max(-1, Math.min(1, d));
    }

    // Distractor analysis (for MCQs)
    const choiceInfo = choicesByQuestion.get(item.questionId);
    let distractors: DistractorMetric[] | undefined;
    let nonFunctioningDistractorFlag = false;

    if (choiceInfo) {
      distractors = choiceInfo.optionKeys.map((key) => {
        let count = 0;
        let upperCount = 0;
        let lowerCount = 0;

        for (let idx = 0; idx < n; idx++) {
          if (choiceInfo.chosen[idx] === key) {
            count++;
            if (canComputeUpperLower) {
              if (upperGroupIndices.includes(idx)) upperCount++;
              if (lowerGroupIndices.includes(idx)) lowerCount++;
            }
          }
        }

        const isKey = key === choiceInfo.correctKey;

        // Flag dead distractor (0 choices) or inverted distractor (chosen more by upper group)
        if (!isKey) {
          if (count === 0) {
            nonFunctioningDistractorFlag = true;
          } else if (canComputeUpperLower && upperCount > lowerCount) {
            nonFunctioningDistractorFlag = true;
          }
        }

        return {
          key,
          count,
          upperCount,
          lowerCount,
          isKey,
        };
      });
    }

    // Assign advisory flags
    const flags: ItemFlag[] = [];
    if (n < minN) {
      flags.push("INSUFFICIENT_DATA");
    } else {
      if (facility >= FACILITY_TOO_EASY) {
        flags.push("TOO_EASY");
      } else if (facility <= FACILITY_TOO_HARD) {
        flags.push("TOO_HARD");
      }

      if (discrimination !== null) {
        if (discrimination < DISCRIMINATION_NEGATIVE) {
          flags.push("NEGATIVE_DISCRIMINATION");
        } else if (discrimination < DISCRIMINATION_MIN) {
          flags.push("WEAK_DISCRIMINATION");
        }
      }

      if (nonFunctioningDistractorFlag) {
        flags.push("NON_FUNCTIONING_DISTRACTOR");
      }
    }

    itemAnalyses.push({
      questionId: item.questionId,
      attempted: attemptedCount,
      facility,
      discrimination,
      discriminationUpperLower,
      flags,
      distractors,
    });
  }

  // 4. Cronbach's alpha
  // alpha = (k / (k - 1)) * (1 - sum(var_items) / var_total)
  let alpha: number | null = null;
  if (k >= 2 && n >= minN && varTotal > 0) {
    const sumItemVariances = itemVariances.reduce((sum, v) => sum + v, 0);
    const computedAlpha = (k / (k - 1)) * (1 - sumItemVariances / varTotal);
    alpha = Math.max(0, Math.min(1, computedAlpha));
  }

  return {
    n,
    alpha,
    mean: meanTotal,
    median: medianTotal,
    sd: sdTotal,
    min: minTotal,
    max: maxTotal,
    percentile,
    items: itemAnalyses,
    truncated,
  };
}
