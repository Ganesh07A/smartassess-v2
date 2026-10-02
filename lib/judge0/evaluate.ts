import "server-only";

import { executeOnJudge0 } from "./client";

export interface CodeEvaluation {
  passed: number;
  total: number;
  isCorrect: boolean;
}

/**
 * Grades a submission against its test cases. Internal helper used by exam finalization (never
 * exported from a `"use server"` module, so it cannot be invoked directly by a client).
 */
export async function evaluateCode(
  code: string,
  language: string,
  testCases: { input: string; output: string }[],
): Promise<CodeEvaluation> {
  if (!testCases || testCases.length === 0) {
    return { passed: 0, total: 0, isCorrect: true };
  }

  let passedCount = 0;

  for (const testCase of testCases) {
    try {
      const result = await executeOnJudge0({ code, language, stdin: testCase.input });
      // Status 3 is "Accepted"
      if (result.status?.id === 3 && result.stdout?.trim() === testCase.output.trim()) {
        passedCount += 1;
      }
    } catch (err) {
      console.error("Error evaluating test case:", err);
    }
  }

  return {
    passed: passedCount,
    total: testCases.length,
    isCorrect: passedCount === testCases.length,
  };
}
