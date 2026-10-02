import { describe, it, expect } from "vitest";
import {
  buildScoreBandWhere,
  buildResultWhere,
  buildResultOrderBy,
} from "../builders/results";
import { resultFilterSchema } from "../schemas";

describe("lib/filters/builders/results", () => {
  const examId = "exam-uuid-456";

  describe("buildScoreBandWhere()", () => {
    it("handles band 0-40 properly with gte 0 and lt 40", () => {
      const condition = buildScoreBandWhere(["0-40"]);
      expect(condition).toEqual({
        percentage: { gte: 0, lt: 40 },
      });
    });

    it("handles band 75-100 properly with gte 75 and lte 100", () => {
      const condition = buildScoreBandWhere(["75-100"]);
      expect(condition).toEqual({
        percentage: { gte: 75, lte: 100 },
      });
    });

    it("combines multiple bands into an OR query", () => {
      const condition = buildScoreBandWhere(["0-40", "40-60"]);
      expect(condition).toEqual({
        OR: [
          { percentage: { gte: 0, lt: 40 } },
          { percentage: { gte: 40, lt: 60 } },
        ],
      });
    });
  });

  describe("buildResultWhere()", () => {
    it("scopes by examId", () => {
      const filter = resultFilterSchema.parse({});
      const where = buildResultWhere(examId, filter);
      expect(where).toEqual({
        AND: [{ examId }],
      });
    });

    it("handles flagged filter as violationCount >= 3", () => {
      const filter = resultFilterSchema.parse({ flagged: "1" });
      const where = buildResultWhere(examId, filter);
      expect(where.AND).toContainEqual({
        violationCount: { gte: 3 },
      });
    });

    it("removes only the excluded facet for facet counting", () => {
      const filter = resultFilterSchema.parse({
        status: "COMPLETED",
        band: "75-100",
      });

      // When counting status facet, status condition should be excluded while band is retained
      const whereWithoutStatus = buildResultWhere(examId, filter, { excludeFacet: "status" });
      expect(whereWithoutStatus.AND).toContainEqual({
        percentage: { gte: 75, lte: 100 },
      });
      const andClauses = Array.isArray(whereWithoutStatus.AND) ? whereWithoutStatus.AND : [];
      const hasStatus = andClauses.some(
        (c: unknown) => typeof c === "object" && c !== null && "status" in c,
      );
      expect(hasStatus).toBe(false);

      // When counting band facet, band condition should be excluded while status is retained
      const whereWithoutBand = buildResultWhere(examId, filter, { excludeFacet: "band" });
      expect(whereWithoutBand.AND).toContainEqual({
        status: { in: ["COMPLETED"] },
      });
    });
  });

  describe("buildResultOrderBy()", () => {
    it("defaults to percentage desc with id asc tiebreaker", () => {
      const filter = resultFilterSchema.parse({});
      const orderBy = buildResultOrderBy(filter);
      expect(orderBy).toEqual([{ percentage: "desc" }, { id: "asc" }]);
    });

    it("supports totalScore sort with direction", () => {
      const filter = resultFilterSchema.parse({ sort: "totalScore", dir: "asc" });
      const orderBy = buildResultOrderBy(filter);
      expect(orderBy).toEqual([{ totalScore: "asc" }, { id: "asc" }]);
    });

    it("supports student name sort relation", () => {
      const filter = resultFilterSchema.parse({ sort: "-name" });
      const orderBy = buildResultOrderBy(filter);
      expect(orderBy).toEqual([{ student: { name: "desc" } }, { id: "asc" }]);
    });
  });
});
