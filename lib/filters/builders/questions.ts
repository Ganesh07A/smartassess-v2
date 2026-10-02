import type { Difficulty, Prisma, QuestionType } from "@prisma/client";
import type { QuestionFilter } from "../schemas";

/**
 * Select projection for question rows within an exam.
 * Replaces any loose `as any` casts with strict TypeScript type safety.
 */
export const QUESTION_ROW_SELECT = {
  id: true,
  examId: true,
  questionId: true,
  points: true,
  order: true,
  question: {
    select: {
      id: true,
      type: true,
      content: true,
      options: true,
      correctAnswer: true,
      testCases: true,
      points: true,
      difficulty: true,
      topic: true,
      tags: true,
      bloomLevel: true,
      explanation: true,
    },
  },
} as const;

export type QuestionRow = Prisma.ExamQuestionGetPayload<{ select: typeof QUESTION_ROW_SELECT }>;

/**
 * Builds Prisma where-clause for ExamQuestion filtering.
 */
export function buildQuestionWhere(
  examId: string,
  filter: QuestionFilter,
): Prisma.ExamQuestionWhereInput {
  const conditions: Prisma.ExamQuestionWhereInput[] = [{ examId }];

  if (filter.q && filter.q.trim().length > 0) {
    const q = filter.q.trim();
    conditions.push({
      question: {
        content: { contains: q, mode: "insensitive" },
      },
    });
  }

  if (filter.type && filter.type.length > 0) {
    conditions.push({
      question: {
        type: { in: filter.type as QuestionType[] },
      },
    });
  }

  if (filter.difficulty && filter.difficulty.length > 0) {
    conditions.push({
      question: {
        difficulty: { in: filter.difficulty as Difficulty[] },
      },
    });
  }

  if (filter.topic && filter.topic.length > 0) {
    conditions.push({
      question: {
        topic: { in: filter.topic },
      },
    });
  }

  if (filter.tags && filter.tags.length > 0) {
    conditions.push({
      question: {
        tags: { hasSome: filter.tags },
      },
    });
  }

  if (filter.pointsMin !== undefined) {
    conditions.push({
      points: { gte: filter.pointsMin },
    });
  }

  if (filter.pointsMax !== undefined) {
    conditions.push({
      points: { lte: filter.pointsMax },
    });
  }

  return { AND: conditions };
}

/**
 * Builds Prisma orderBy array for ExamQuestion.
 */
export function buildQuestionOrderBy(
  filter: QuestionFilter,
): Prisma.ExamQuestionOrderByWithRelationInput[] {
  const dir = filter.dir;

  switch (filter.sort) {
    case "points":
      return [{ points: dir }, { id: "asc" }];
    case "difficulty":
      return [{ question: { difficulty: dir } }, { id: "asc" }];
    case "topic":
      return [{ question: { topic: dir } }, { id: "asc" }];
    case "order":
    default:
      return [{ order: dir }, { id: "asc" }];
  }
}
