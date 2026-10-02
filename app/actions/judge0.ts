"use server";

import { requireUser } from "@/lib/auth/scope";
import { parseInput } from "@/lib/validation/parse";
import { runCodeSchema } from "@/lib/validation/schemas";
import { rateLimits } from "@/lib/rate-limit";
import { executeOnJudge0 } from "@/lib/judge0/client";

/**
 * Runs a student's code visibly in the browser (the "Run" button).
 * Grading uses the internal evaluator instead; this action is the only publicly callable entry
 * point and enforces size limits plus a per-user quota.
 */
export async function runCode(code: string, language: string, stdin?: string) {
  const user = await requireUser();
  if (user.role === "STUDENT") {
    await rateLimits.codeRun(user.id);
  }

  const input = parseInput(runCodeSchema, { code, language, stdin });
  return await executeOnJudge0(input);
}
