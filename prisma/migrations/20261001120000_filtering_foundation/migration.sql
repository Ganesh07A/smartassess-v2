-- Sprint 1 foundations: lifecycle/status, question-bank metadata, denormalized scoring,
-- proctoring audit trail, rate limiting and the indexes every list/filter query needs.

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'UPCOMING', 'ACTIVE', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnswerRevealPolicy" AS ENUM ('NEVER', 'AFTER_EXAM_END', 'AFTER_RELEASE', 'IMMEDIATELY');

-- CreateEnum
CREATE TYPE "ProctorEventType" AS ENUM ('EXAM_STARTED', 'EXAM_SUBMITTED', 'FORCE_SUBMITTED', 'TAB_BLUR', 'FULLSCREEN_EXIT', 'CLIPBOARD_ATTEMPT', 'DEVTOOLS_ATTEMPT', 'HEARTBEAT_MISSED', 'DUPLICATE_TAB', 'IP_COLLISION', 'TIME_EXTENDED', 'TEACHER_MESSAGE');

-- AlterTable
ALTER TABLE "Exam"
  ADD COLUMN "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "examCode" TEXT,
  ADD COLUMN "resultsReleasedAt" TIMESTAMP(3),
  ADD COLUMN "answerReveal" "AnswerRevealPolicy" NOT NULL DEFAULT 'AFTER_EXAM_END',
  ADD COLUMN "proctoring" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "negativeMarking" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill the lifecycle status of existing exams from published/timestamps
UPDATE "Exam"
SET "status" = CASE
  WHEN "published" = false THEN 'DRAFT'::"ExamStatus"
  WHEN "startTime" > NOW() THEN 'UPCOMING'::"ExamStatus"
  WHEN "endTime" < NOW() THEN 'EXPIRED'::"ExamStatus"
  ELSE 'ACTIVE'::"ExamStatus"
END;

-- AlterTable
ALTER TABLE "Question"
  ADD COLUMN "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "topic" TEXT,
  ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "bloomLevel" TEXT,
  ADD COLUMN "explanation" TEXT;

-- AlterTable
ALTER TABLE "StudentExamSession"
  ADD COLUMN "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "violationCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN "submittedAt" TIMESTAMP(3);

-- Backfill denormalized scores so lists can sort/filter in SQL immediately
UPDATE "StudentExamSession" ses
SET "totalScore" = COALESCE(sc.score, 0),
    "maxScore" = COALESCE(pt.max_points, 0),
    "percentage" = CASE
      WHEN COALESCE(pt.max_points, 0) > 0
        THEN ROUND((COALESCE(sc.score, 0)::numeric / pt.max_points) * 100, 2)::double precision
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

-- CreateTable
CREATE TABLE "ProctorEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "type" "ProctorEventType" NOT NULL,
  "severity" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProctorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitCounter" (
  "key" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key", "windowStart")
);

-- CreateIndex (pre-existing relation indexes that were missing)
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Batch_teacherId_idx" ON "Batch"("teacherId");
CREATE INDEX "Batch_department_idx" ON "Batch"("department");
CREATE INDEX "Batch_createdAt_idx" ON "Batch"("createdAt");
CREATE UNIQUE INDEX "Exam_examCode_key" ON "Exam"("examCode");
CREATE INDEX "Exam_batchId_startTime_idx" ON "Exam"("batchId", "startTime");
CREATE INDEX "Exam_published_startTime_idx" ON "Exam"("published", "startTime");
CREATE INDEX "Exam_status_idx" ON "Exam"("status");
CREATE INDEX "Exam_endTime_idx" ON "Exam"("endTime");
CREATE INDEX "Question_difficulty_topic_idx" ON "Question"("difficulty", "topic");
CREATE INDEX "Question_type_difficulty_idx" ON "Question"("type", "difficulty");
CREATE INDEX "Question_tags_idx" ON "Question" USING GIN ("tags");
CREATE INDEX "ExamQuestion_examId_order_idx" ON "ExamQuestion"("examId", "order");
CREATE INDEX "StudentExamSession_examId_percentage_idx" ON "StudentExamSession"("examId", "percentage");
CREATE INDEX "StudentExamSession_examId_violationCount_idx" ON "StudentExamSession"("examId", "violationCount");
CREATE INDEX "StudentExamSession_examId_status_idx" ON "StudentExamSession"("examId", "status");
CREATE INDEX "StudentExamSession_examId_lastHeartbeatAt_idx" ON "StudentExamSession"("examId", "lastHeartbeatAt");
CREATE INDEX "StudentExamSession_examId_updatedAt_idx" ON "StudentExamSession"("examId", "updatedAt");
CREATE INDEX "Submission_questionId_idx" ON "Submission"("questionId");
CREATE INDEX "Submission_submittedAt_idx" ON "Submission"("submittedAt");
CREATE INDEX "Certificate_examId_idx" ON "Certificate"("examId");
CREATE INDEX "Certificate_issueDate_idx" ON "Certificate"("issueDate");
CREATE INDEX "ProctorEvent_sessionId_occurredAt_idx" ON "ProctorEvent"("sessionId", "occurredAt");
CREATE INDEX "ProctorEvent_type_occurredAt_idx" ON "ProctorEvent"("type", "occurredAt");
CREATE INDEX "ProctorEvent_severity_occurredAt_idx" ON "ProctorEvent"("severity", "occurredAt");
CREATE INDEX "RateLimitCounter_windowStart_idx" ON "RateLimitCounter"("windowStart");

-- AddForeignKey
ALTER TABLE "ProctorEvent" ADD CONSTRAINT "ProctorEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Race-free certificate numbering (see lib/certificates/issue.ts)
CREATE SEQUENCE IF NOT EXISTS "CertificateNumber_seq";
SELECT setval('"CertificateNumber_seq"', (SELECT COUNT(*) FROM "Certificate") + 1, false);
