-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "shuffleOptions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "StudentExamSession" ADD COLUMN     "optionsMapping" JSONB;
