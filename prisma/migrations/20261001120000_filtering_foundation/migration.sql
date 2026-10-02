-- Sprint 1 foundations: lifecycle/status, question-bank metadata, denormalized scoring,
-- proctoring audit trail, rate limiting and the indexes every list/filter query needs.
-- NOTE: Made idempotent to recover from partial application.

-- CreateEnum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Difficulty') THEN
    CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExamStatus') THEN
    CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'EXPIRED', 'ARCHIVED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnswerRevealPolicy') THEN
    CREATE TYPE "AnswerRevealPolicy" AS ENUM ('NEVER', 'AFTER_EXAM_END', 'AFTER_RELEASE', 'IMMEDIATELY');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProctorEventType') THEN
    CREATE TYPE "ProctorEventType" AS ENUM ('EXAM_STARTED', 'EXAM_SUBMITTED', 'FORCE_SUBMITTED', 'TAB_BLUR', 'FULLSCREEN_EXIT', 'CLIPBOARD_ATTEMPT', 'DEVTOOLS_ATTEMPT', 'HEARTBEAT_MISSED', 'DUPLICATE_TAB', 'IP_COLLISION', 'TIME_EXTENDED', 'TEACHER_MESSAGE');
  END IF;
END $$;

-- AlterTable Exam (idempotent — ADD COLUMN IF NOT EXISTS)
ALTER TABLE "Exam"
  ADD COLUMN IF NOT EXISTS "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "examCode" TEXT,
  ADD COLUMN IF NOT EXISTS "resultsReleasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "answerReveal" "AnswerRevealPolicy" NOT NULL DEFAULT 'AFTER_EXAM_END',
  ADD COLUMN IF NOT EXISTS "proctoring" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "negativeMarking" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill the lifecycle status of existing exams from published/timestamps
UPDATE "Exam"
SET "status" = CASE
  WHEN "published" = false THEN 'DRAFT'::"ExamStatus"
  WHEN "startTime" > NOW() THEN 'UPCOMING'::"ExamStatus"
  WHEN "endTime" < NOW() THEN 'EXPIRED'::"ExamStatus"
  ELSE 'ACTIVE'::"ExamStatus"
END;

-- AlterTable Question (idempotent)
ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "topic" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "bloomLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "explanation" TEXT;

-- AlterTable StudentExamSession (idempotent)
ALTER TABLE "StudentExamSession"
  ADD COLUMN IF NOT EXISTS "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "violationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "riskScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

-- Backfill denormalized scores so lists can sort/filter in SQL immediately
UPDATE "StudentExamSession" ses
SET "totalScore" = COALESCE(sc.score, 0),
    "maxScore" = COALESCE(pt.max_points, 0),
    "percentage" = CASE
      WHEN COALESCE(pt.max_points, 0) > 0
        THEN ROUND(((COALESCE(sc.score, 0)::numeric / pt.max_points::numeric) * 100)::numeric, 2)::double precision
      ELSE 0
    END,
    "violationCount" = ses."tabSwitches",
    "riskScore" = LEAST(100, ses."tabSwitches" * 20),
    "submittedAt" = CASE
      WHEN ses."status" IN ('COMPLETED', 'FORCE_SUBMITTED') THEN ses."endTime"
      ELSE NULL
    END
FROM (
  SELECT s."id" AS session_id, s."examId" AS exam_id, COALESCE(SUM(sub."pointsAwarded"), 0) AS score
  FROM "StudentExamSession" s
  LEFT JOIN "Submission" sub ON sub."sessionId" = s."id"
  GROUP BY s."id", s."examId"
) sc
LEFT JOIN (
  SELECT "examId" AS exam_id, SUM("points") AS max_points
  FROM "ExamQuestion"
  GROUP BY "examId"
) pt ON pt.exam_id = sc.exam_id
WHERE ses."id" = sc.session_id;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "ProctorEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "type" "ProctorEventType" NOT NULL,
  "severity" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProctorEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RateLimitCounter" (
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key", "windowStart")
);

-- CreateIndex (idempotent — IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Batch_teacherId_idx" ON "Batch"("teacherId");
CREATE INDEX IF NOT EXISTS "Batch_department_idx" ON "Batch"("department");
CREATE INDEX IF NOT EXISTS "Batch_createdAt_idx" ON "Batch"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Exam_examCode_key" ON "Exam"("examCode");
CREATE INDEX IF NOT EXISTS "Exam_batchId_startTime_idx" ON "Exam"("batchId", "startTime");
CREATE INDEX IF NOT EXISTS "Exam_published_startTime_idx" ON "Exam"("published", "startTime");
CREATE INDEX IF NOT EXISTS "Exam_status_idx" ON "Exam"("status");
CREATE INDEX IF NOT EXISTS "Exam_endTime_idx" ON "Exam"("endTime");
CREATE INDEX IF NOT EXISTS "Question_difficulty_topic_idx" ON "Question"("difficulty", "topic");
CREATE INDEX IF NOT EXISTS "Question_type_difficulty_idx" ON "Question"("type", "difficulty");
CREATE INDEX IF NOT EXISTS "Question_tags_idx" ON "Question" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "ExamQuestion_examId_order_idx" ON "ExamQuestion"("examId", "order");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_percentage_idx" ON "StudentExamSession"("examId", "percentage");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_violationCount_idx" ON "StudentExamSession"("examId", "violationCount");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_status_idx" ON "StudentExamSession"("examId", "status");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_lastHeartbeatAt_idx" ON "StudentExamSession"("examId", "lastHeartbeatAt");
CREATE INDEX IF NOT EXISTS "StudentExamSession_examId_updatedAt_idx" ON "StudentExamSession"("examId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Submission_questionId_idx" ON "Submission"("questionId");
CREATE INDEX IF NOT EXISTS "Submission_submittedAt_idx" ON "Submission"("submittedAt");
CREATE INDEX IF NOT EXISTS "Certificate_examId_idx" ON "Certificate"("examId");
CREATE INDEX IF NOT EXISTS "Certificate_issueDate_idx" ON "Certificate"("issueDate");
CREATE INDEX IF NOT EXISTS "ProctorEvent_sessionId_occurredAt_idx" ON "ProctorEvent"("sessionId", "occurredAt");
CREATE INDEX IF NOT EXISTS "ProctorEvent_type_occurredAt_idx" ON "ProctorEvent"("type", "occurredAt");
CREATE INDEX IF NOT EXISTS "ProctorEvent_severity_occurredAt_idx" ON "ProctorEvent"("severity", "occurredAt");
CREATE INDEX IF NOT EXISTS "RateLimitCounter_windowStart_idx" ON "RateLimitCounter"("windowStart");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProctorEvent_sessionId_fkey') THEN
    ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Race-free certificate numbering (see lib/certificates/issue.ts)
CREATE SEQUENCE IF NOT EXISTS "CertificateNumber_seq";
SELECT setval('"CertificateNumber_seq"', (SELECT COUNT(*) FROM "Certificate") + 1, false);
