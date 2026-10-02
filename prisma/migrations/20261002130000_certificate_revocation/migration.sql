-- AlterTable
ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "revokedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_revokedAt_idx" ON "Certificate"("revokedAt");
