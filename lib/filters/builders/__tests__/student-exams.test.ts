import { describe, it, expect } from "vitest";
import {
  buildStudentExamStatusWhere,
  buildStudentExamWhere,
  buildStudentExamOrderBy,
} from "../student-exams";
import { studentExamFilterSchema } from "../../schemas";

describe("Student Exams Query Builder", () => {
  const studentId = "student-123";
  const now = new Date("2026-10-02T12:00:00Z");

  it("builds status where for 'upcoming' correctly", () => {
    const where = buildStudentExamStatusWhere(studentId, ["upcoming"], now);
    expect(where.OR).toBeDefined();
    expect(where.OR?.[0]).toEqual({
      published: true,
      status: { not: "ARCHIVED" },
      startTime: { gt: now },
    });
  });

  it("builds status where for 'completed' checking session status", () => {
    const where = buildStudentExamStatusWhere(studentId, ["completed"], now);
    expect(where.OR?.[0]).toEqual({
      sessions: {
        some: {
          studentId,
          status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
        },
      },
    });
  });

  it("builds status where for 'missed' checking endTime past and no completed session", () => {
    const where = buildStudentExamStatusWhere(studentId, ["missed"], now);
    expect(where.OR?.[0]).toEqual({
      published: true,
      status: { not: "ARCHIVED" },
      endTime: { lt: now },
      sessions: {
        none: {
          studentId,
          status: { in: ["COMPLETED", "FORCE_SUBMITTED"] },
        },
      },
    });
  });

  it("builds complete student exam query with batch scoping and search query", () => {
    const filter = studentExamFilterSchema.parse({
      q: "Computer Science",
      status: "active",
    });

    const where = buildStudentExamWhere(studentId, filter, now);
    expect(where.AND).toBeDefined();
    const andArray = where.AND as Array<Record<string, unknown>>;

    // First element must be batch scoping and published check
    expect(andArray[0]).toEqual({
      published: true,
      status: { not: "ARCHIVED" },
      batch: {
        students: {
          some: { id: studentId },
        },
      },
    });
  });

  it("orders by startTime asc by default with id tie-breaker", () => {
    const filter = studentExamFilterSchema.parse({});
    const orderBy = buildStudentExamOrderBy(filter);
    expect(orderBy).toEqual([{ startTime: "asc" }, { id: "asc" }]);
  });
});
