import { z } from "zod";

/**
 * Runtime validation for every server action boundary.
 *
 * Server actions are directly callable HTTP endpoints; TypeScript types are erased at runtime
 * and cannot protect against a crafted request (negative duration, NaN dates, 10 MB payloads,
 * or an id belonging to somebody else's exam). Every action now parses its input through one
 * of these schemas before touching the database.
 */

export const idSchema = z.string().trim().min(1).max(64);
export const shortText = z.string().trim().min(1).max(200);
export const longText = z.string().trim().min(1).max(20_000);

export const languageSchema = z.enum(["python", "c", "cpp", "java", "javascript"]);

const isoDate = z.union([z.date(), z.string().min(4).max(64)]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
    return z.NEVER;
  }
  return date;
});

/* ------------------------------------------------------------------ exams */

export const createExamSchema = z
  .object({
    title: shortText,
    description: z.string().trim().max(2000).optional(),
    startTime: isoDate,
    endTime: isoDate,
    duration: z.coerce.number().int().min(1).max(600),
    batchId: idSchema,
    allowRunCode: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    negativeMarking: z.coerce.number().min(0).max(10).optional(),
    subjects: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    proctoring: z
      .object({
        maxTabSwitches: z.coerce.number().int().min(1).max(20).optional(),
        blockClipboard: z.boolean().optional(),
        requireFullscreen: z.boolean().optional(),
      })
      .partial()
      .optional(),
  })
  .refine((data) => data.startTime.getTime() < data.endTime.getTime(), {
    message: "The start time must be before the end time.",
    path: ["endTime"],
  })
  .refine((data) => data.duration * 60_000 <= data.endTime.getTime() - data.startTime.getTime(), {
    message: "The duration cannot be longer than the exam window.",
    path: ["duration"],
  });

export type CreateExamInput = z.infer<typeof createExamSchema>;

/* -------------------------------------------------------------- questions */

export const testCaseSchema = z.object({
  input: z.string().max(5000),
  output: z.string().max(5000),
});

export const questionInputSchema = z
  .object({
    type: z.enum(["MCQ", "CODING"]),
    content: longText,
    options: z.record(z.string(), z.string().max(2000)).optional(),
    correctAnswer: z.string().max(200).optional(),
    testCases: z.array(testCaseSchema).max(50).optional(),
    points: z.coerce.number().min(0).max(1000).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    topic: z.string().trim().max(120).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    bloomLevel: z.string().trim().max(60).optional(),
    explanation: z.string().trim().max(5000).optional(),
  })
  .superRefine((question, ctx) => {
    if (question.type === "MCQ") {
      const options = question.options ?? {};
      const filledOptions = Object.entries(options).filter(([, text]) => text.trim().length > 0);

      if (filledOptions.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "An MCQ needs at least two non-empty options.",
          path: ["options"],
        });
      }
      if (!question.correctAnswer || !options[question.correctAnswer]?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "The correct answer must be one of the options and cannot be blank.",
          path: ["correctAnswer"],
        });
      }
    }
    if (question.type === "CODING") {
      const usableTestCases = (question.testCases ?? []).filter((testCase) => testCase.output.trim().length > 0);
      if (usableTestCases.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A coding question needs at least one test case with an expected output.",
          path: ["testCases"],
        });
      }
    }
  });

export type QuestionInput = z.infer<typeof questionInputSchema>;

export const uploadQuestionsSchema = z.object({
  examId: idSchema,
  questions: z.array(questionInputSchema).min(1).max(500),
});

export const updateQuestionSchema = z.object({
  examId: idSchema,
  questionId: idSchema,
  data: questionInputSchema,
});

export const examQuestionRefSchema = z.object({
  examId: idSchema,
  questionId: idSchema,
});

export const duplicateExamSchema = z.object({
  examId: idSchema,
  targetBatchId: idSchema.optional(),
});

/* ------------------------------------------------------------- proctoring */

export const sessionIdSchema = z.object({ sessionId: idSchema });

export const saveSubmissionSchema = z
  .object({
    sessionId: idSchema,
    questionId: idSchema,
    answer: z
      .object({
        mcqAnswer: z.string().trim().max(8).optional(),
        codeAnswer: z.string().max(20_000).optional(),
        language: languageSchema.optional(),
      })
      .refine((answer) => answer.mcqAnswer !== undefined || answer.codeAnswer !== undefined, {
        message: "Provide either an MCQ answer or code.",
      }),
  })
  .strict();

export const proctorEventSchema = z.object({
  sessionId: idSchema,
  type: z
    .enum([
      "TAB_BLUR",
      "FULLSCREEN_EXIT",
      "CLIPBOARD_ATTEMPT",
      "DEVTOOLS_ATTEMPT",
      "DUPLICATE_TAB",
      "IP_COLLISION",
    ])
    .default("TAB_BLUR"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateBlurStateSchema = z.object({
  sessionId: idSchema,
  isBlurred: z.boolean(),
});

/* ------------------------------------------------------------ certificates */

export const issueCertificateSchema = z.object({
  examId: idSchema,
  studentId: idSchema,
});

/* ------------------------------------------------------------------ code */

export const runCodeSchema = z.object({
  code: z.string().min(1).max(20_000),
  language: languageSchema,
  stdin: z.string().max(10_000).optional(),
});

/* -------------------------------------------------------------------- AI */

export const generateQuestionsSchema = z.object({
  prompt: z.string().trim().min(10).max(8_000),
  count: z.coerce.number().int().min(1).max(30).default(5),
});

export const explainCodeSchema = z.object({
  questionContent: z.string().trim().min(1).max(8_000),
  code: z.string().min(1).max(20_000),
  pointsAwarded: z.coerce.number().min(0).max(10_000),
  totalPoints: z.coerce.number().min(0).max(10_000),
});

/* ------------------------------------------------------------------ batch */

export const createBatchSchema = z.object({
  name: shortText,
});

export const addStudentSchema = z.object({
  batchId: idSchema,
  emailOrPrn: z.string().trim().min(1).max(200),
});

export const batchStudentSchema = z.object({
  batchId: idSchema,
  studentId: idSchema,
});

/* ------------------------------------------------------------------- auth */

export const signUpSchema = z
  .object({
    name: z
      .string({ required_error: "Name is required." })
      .trim()
      .min(2, "Name must be at least 2 characters long.")
      .max(120),
    email: z
      .string({ required_error: "A valid email address is required." })
      .trim()
      .toLowerCase()
      .email("A valid email address is required.")
      .max(200),
    password: z
      .string({ required_error: "Password must be at least 8 characters long." })
      .min(8, "Password must be at least 8 characters long.")
      .max(200),
    role: z.enum(["TEACHER", "STUDENT"]),
    prn: z.string().trim().max(60).optional(),
    inviteCode: z.string().trim().max(200).optional(),
    department: z.string().trim().max(120).optional(),
    year: z.string().trim().max(60).optional(),
    division: z.string().trim().max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "STUDENT") {
      if (!data.prn) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "PRN is required for students.", path: ["prn"] });
      if (!data.department) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Department is required.", path: ["department"] });
      if (!data.year) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Year is required.", path: ["year"] });
      if (!data.division) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Division is required.", path: ["division"] });
    }
    if (data.role === "TEACHER" && !data.department) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Department is required.", path: ["department"] });
    }
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
