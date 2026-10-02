import { describe, it, expect } from "vitest";
import { z } from "zod";
import { csv, intParam, dateParam, readParams, toURLSearchParams } from "../parse";

describe("lib/filters/parse", () => {
  describe("csv()", () => {
    const parser = csv(["apple", "banana", "cherry"] as const);

    it("splits, trims, and filters comma-separated tokens", () => {
      const res = parser.parse("  apple , banana , cherry  ");
      expect(res).toEqual(["apple", "banana", "cherry"]);
    });

    it("ignores empty segments and limits to 20 items", () => {
      const longInput = Array(30).fill("apple").join(",");
      const res = parser.parse(longInput);
      expect(res.length).toBe(20);
    });

    it("rejects unknown enum values", () => {
      expect(() => parser.parse("apple,invalid")).toThrow();
    });
  });

  describe("intParam()", () => {
    const parser = intParam(1, 100, 25);

    it("coerces valid integers", () => {
      expect(parser.parse("42")).toBe(42);
      expect(parser.parse(10)).toBe(10);
    });

    it("falls back to default on invalid or out-of-bounds input", () => {
      expect(parser.parse("invalid")).toBe(25);
      expect(parser.parse("-5")).toBe(25);
      expect(parser.parse("9999")).toBe(25);
    });
  });

  describe("dateParam()", () => {
    const parser = dateParam();

    it("parses valid YYYY-MM-DD to UTC Date", () => {
      const res = parser.parse("2026-08-15");
      expect(res).toBeInstanceOf(Date);
      expect(res?.toISOString()).toBe("2026-08-15T00:00:00.000Z");
    });

    it("returns undefined for invalid format or dates without throwing", () => {
      expect(parser.parse("2026-13-99")).toBeUndefined();
      expect(parser.parse("not-a-date")).toBeUndefined();
      expect(parser.parse(undefined)).toBeUndefined();
    });
  });

  describe("readParams()", () => {
    const testSchema = z.object({
      q: z.string().optional().catch(undefined),
      page: intParam(1, 100, 1),
    });

    it("parses valid params and ignores unknown keys like tab=analytics", () => {
      const params = { q: "dbms", page: "2", tab: "analytics" };
      const parsed = readParams(testSchema, params);
      expect(parsed).toEqual({ q: "dbms", page: 2 });
    });

    it("never throws on corrupted or garbage inputs", () => {
      const garbage = { q: "   ", page: "NaN", unknown: "xyz" };
      const parsed = readParams(testSchema, garbage);
      expect(parsed.page).toBe(1);
    });

    it("flattens string array parameters by taking the last value", () => {
      const arrayParams = { page: ["1", "3"] };
      const parsed = readParams(testSchema, arrayParams);
      expect(parsed.page).toBe(3);
    });
  });

  describe("toURLSearchParams()", () => {
    it("converts values to query string omitting null and undefined", () => {
      const params = toURLSearchParams({
        q: "math",
        status: ["active", "draft"],
        page: 2,
        date: new Date("2026-05-10T00:00:00.000Z"),
        empty: "",
        nil: undefined,
      });

      expect(params.get("q")).toBe("math");
      expect(params.get("status")).toBe("active,draft");
      expect(params.get("page")).toBe("2");
      expect(params.get("date")).toBe("2026-05-10");
      expect(params.has("empty")).toBe(false);
      expect(params.has("nil")).toBe(false);
    });
  });
});
