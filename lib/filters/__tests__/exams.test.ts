import { describe, it, expect } from "vitest";
import {
  buildExamStatusWhere,
  buildExamWhere,
  buildExamOrderBy,
} from "../builders/exams";
import { examFilterSchema } from "../schemas";

describe("lib/filters/builders/exams", () => {
  const dummyScope = { batch: { teacherId: "teacher-123" } };
  const mockNow = new Date("2026-10-02T12:00:00.000Z");

  describe("buildExamStatusWhere()", () => {
    it("builds active status condition relative to now", () => {
      const condition = buildExamStatusWhere(["active"], mockNow);
      expect(condition).toEqual({
        OR: [
          {
            published: true,
            status: { not: "ARCHIVED" },
            startTime: { lte: mockNow },
            endTime: { gte: mockNow },
          },
        ],
      });
    });

    it("combines two statuses into an OR fragment", () => {
      const condition = buildExamStatusWhere(["active", "draft"], mockNow);
      expect(condition).toEqual({
        OR: [
          {
            published: true,
            status: { not: "ARCHIVED" },
            startTime: { lte: mockNow },
            endTime: { gte: mockNow },
          },
          {
            published: false,
            status: { not: "ARCHIVED" },
          },
        ],
      });
    });
  });

  describe("buildExamWhere()", () => {
    it("always nests scope first inside AND", () => {
      const filter = examFilterSchema.parse({});
      const where = buildExamWhere(filter, dummyScope, mockNow);
      expect(where).toEqual({
        AND: [dummyScope],
      });
    });

    it("applies trimmed q with insensitive search across title, description, batch name", () => {
      const filter = examFilterSchema.parse({ q: "  operating systems  " });
      const where = buildExamWhere(filter, dummyScope, mockNow);
      expect(where.AND).toContainEqual({
        OR: [
          { title: { contains: "operating systems", mode: "insensitive" } },
          { description: { contains: "operating systems", mode: "insensitive" } },
          { batch: { name: { contains: "operating systems", mode: "insensitive" } } },
        ],
      });
    });

    it("handles batchId array filter with in operator", () => {
      const filter = examFilterSchema.parse({ batch: "batch-1,batch-2" });
      const where = buildExamWhere(filter, dummyScope, mockNow);
      expect(where.AND).toContainEqual({
        batchId: { in: ["batch-1", "batch-2"] },
      });
    });

    it("combines active status with scope using AND, never OR", () => {
      const filter = examFilterSchema.parse({ status: "active" });
      const where = buildExamWhere(filter, dummyScope, mockNow);
      const andList = Array.isArray(where.AND) ? where.AND : [where.AND];
      expect(andList[0]).toEqual(dummyScope);
      expect(andList[1]).toHaveProperty("OR");
    });
  });

  describe("buildExamOrderBy()", () => {
    it("falls back to createdAt desc by default and appends stable tiebreaker", () => {
      const filter = examFilterSchema.parse({});
      const orderBy = buildExamOrderBy(filter);
      expect(orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    });

    it("handles leading minus in sort param for descending direction", () => {
      const filter = examFilterSchema.parse({ sort: "-startTime" });
      const orderBy = buildExamOrderBy(filter);
      expect(orderBy).toEqual([{ startTime: "desc" }, { id: "asc" }]);
    });

    it("handles explicit dir param", () => {
      const filter = examFilterSchema.parse({ sort: "title", dir: "asc" });
      const orderBy = buildExamOrderBy(filter);
      expect(orderBy).toEqual([{ title: "asc" }, { id: "asc" }]);
    });

    it("orders by session count when sessions sort key is provided", () => {
      const filter = examFilterSchema.parse({ sort: "sessions", dir: "desc" });
      const orderBy = buildExamOrderBy(filter);
      expect(orderBy).toEqual([{ sessions: { _count: "desc" } }, { id: "asc" }]);
    });

    it("ignores unknown sort field and falls back to createdAt", () => {
      const filter = examFilterSchema.parse({ sort: "hackedField" });
      const orderBy = buildExamOrderBy(filter);
      expect(orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    });
  });
});
