import "server-only";

import { prisma } from "@/app/db";

/**
 * Fixed-window rate limiter backed by Postgres.
 *
 * Chosen over an in-memory map because the app runs on serverless instances (Vercel) where
 * each lambda has its own memory; a per-instance counter would be trivially bypassed by
 * retrying until you land on a fresh instance. A single upsert per call is cheap enough for
 * the actions it protects (AI generation, code execution, sign-up).
 */

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many requests. Please slow down and try again shortly.") {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const counter = await prisma.rateLimitCounter.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  // Opportunistic cleanup so the table cannot grow forever; never blocks the request.
  if (Math.random() < CLEANUP_PROBABILITY) {
    void prisma.rateLimitCounter
      .deleteMany({ where: { windowStart: { lt: new Date(now - CLEANUP_MAX_AGE_MS) } } })
      .catch(() => undefined);
  }

  if (counter.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
    throw new RateLimitError(retryAfterSeconds);
  }
}

/** Convenience wrappers for the quotas actually enforced in this codebase. */
export const rateLimits = {
  aiGeneration: (userId: string) => enforceRateLimit(`ai:generate:${userId}`, 20, 60 * 60 * 1000),
  aiExplain: (userId: string) => enforceRateLimit(`ai:explain:${userId}`, 40, 60 * 60 * 1000),
  codeRun: (userId: string) => enforceRateLimit(`judge0:run:${userId}`, 60, 60 * 1000),
  signUp: (ip: string) => enforceRateLimit(`auth:signup:${ip}`, 5, 60 * 60 * 1000),
  submission: (sessionId: string) => enforceRateLimit(`exam:submit:${sessionId}`, 240, 60 * 1000),
  heartbeat: (sessionId: string) => enforceRateLimit(`exam:heartbeat:${sessionId}`, 20, 60 * 1000),
  proctorEvent: (sessionId: string) => enforceRateLimit(`exam:proctor:${sessionId}`, 60, 60 * 1000),
  login: (email: string) => enforceRateLimit(`auth:login:${email.toLowerCase()}`, 10, 15 * 60 * 1000),
};
