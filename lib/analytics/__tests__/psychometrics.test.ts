import { describe, it, expect } from "vitest";
import { analyzeTestItems } from "../psychometrics";
import { MAX_SESSIONS_FOR_ANALYSIS } from "../thresholds";

describe("Psychometrics & Item Analysis Engine", () => {
  describe("Hand-verifiable fixture (§6.6 specification)", () => {
    // 4 sessions, 3 items, each 1 point, totals [3, 2, 1, 0]
    const items = [
      { questionId: "q1", maxPoints: 1, scores: [1, 1, 1, 0] },
      { questionId: "q2", maxPoints: 1, scores: [1, 1, 0, 0] },
      { questionId: "q3", maxPoints: 1, scores: [1, 0, 0, 0] },
    ];
    const totals = [3, 2, 1, 0];

    it("matches exact facility, discrimination, and alpha values with minN=1", () => {
      const result = analyzeTestItems({
        items,
        totals,
        minN: 1, // Bypass default threshold of 10 to test mathematical accuracy on small fixture
      });

      expect(result.n).toBe(4);
      expect(result.mean).toBe(1.5);
      expect(result.median).toBe(1.5);
      expect(result.min).toBe(0);
      expect(result.max).toBe(3);

      // Item 1: facility 0.75, r ≈ 0.522
      expect(result.items[0].facility).toBeCloseTo(0.75, 3);
      expect(result.items[0].discrimination).toBeCloseTo(0.522, 3);

      // Item 2: facility 0.50, r ≈ 0.707
      expect(result.items[1].facility).toBeCloseTo(0.5, 3);
      expect(result.items[1].discrimination).toBeCloseTo(0.707, 3);

      // Item 3: facility 0.25, r ≈ 0.522
      expect(result.items[2].facility).toBeCloseTo(0.25, 3);
      expect(result.items[2].discrimination).toBeCloseTo(0.522, 3);

      // Cronbach's alpha = 0.75 ((3/2) * (1 - 0.625/1.25))
      expect(result.alpha).toBeCloseTo(0.75, 3);

      // Upper-lower discrimination D must be null because N=4 groups overlap
      expect(result.items[0].discriminationUpperLower).toBeNull();
      expect(result.items[1].discriminationUpperLower).toBeNull();
      expect(result.items[2].discriminationUpperLower).toBeNull();
    });

    it("returns null discrimination and alpha under default threshold when N < 10", () => {
      const result = analyzeTestItems({ items, totals }); // uses default minN=10
      expect(result.alpha).toBeNull();
      expect(result.items[0].discrimination).toBeNull();
      expect(result.items[0].flags).toContain("INSUFFICIENT_DATA");
    });
  });

  describe("Upper-Lower Discrimination (D) with N=12", () => {
    it("computes D = 1.0 for top-only item and D = -1.0 for bottom-only item", () => {
      // 12 sessions, n_group = floor(0.27 * 12) = 3 (top 3: indices 0..2, bottom 3: indices 9..11)
      const totals = [10, 9, 9, 8, 7, 6, 6, 5, 4, 3, 3, 1];
      const items = [
        {
          questionId: "top-only",
          maxPoints: 1,
          scores: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
        {
          questionId: "bottom-only",
          maxPoints: 1,
          scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
        },
      ];

      const result = analyzeTestItems({ items, totals, minN: 10 });
      const topItem = result.items.find((i) => i.questionId === "top-only")!;
      const bottomItem = result.items.find((i) => i.questionId === "bottom-only")!;

      expect(topItem.discriminationUpperLower).toBeCloseTo(1.0, 3);
      expect(bottomItem.discriminationUpperLower).toBeCloseTo(-1.0, 3);
    });
  });

  describe("Advisory flags and distractor analysis", () => {
    it("flags TOO_EASY and null discrimination for zero-variance item", () => {
      const totals = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const items = [
        {
          questionId: "all-correct",
          maxPoints: 1,
          scores: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        },
      ];

      const result = analyzeTestItems({ items, totals });
      const item = result.items[0];
      expect(item.facility).toBe(1.0);
      expect(item.discrimination).toBeNull();
      expect(item.flags).toContain("TOO_EASY");
    });

    it("flags NEGATIVE_DISCRIMINATION for inverted broken item", () => {
      const totals = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      // Top 3 got it wrong, bottom 3 got it right
      const items = [
        {
          questionId: "broken-item",
          maxPoints: 1,
          scores: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
        },
      ];

      const result = analyzeTestItems({ items, totals });
      const item = result.items[0];
      expect(item.discrimination).not.toBeNull();
      expect(item.discrimination!).toBeLessThan(0);
      expect(item.flags).toContain("NEGATIVE_DISCRIMINATION");
    });

    it("flags NON_FUNCTIONING_DISTRACTOR when option C is selected by 0 students", () => {
      const totals = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
      const items = [
        { questionId: "mcq-1", maxPoints: 1, scores: [1, 1, 1, 1, 0, 0, 0, 0, 0, 0] },
      ];
      const choices = [
        {
          questionId: "mcq-1",
          optionKeys: ["A", "B", "C", "D"],
          correctKey: "A",
          // Notice 'C' is never chosen
          chosen: ["A", "A", "A", "A", "B", "B", "D", "D", "B", "D"],
        },
      ];

      const result = analyzeTestItems({ items, totals, choices });
      const item = result.items[0];
      expect(item.flags).toContain("NON_FUNCTIONING_DISTRACTOR");

      const distC = item.distractors?.find((d) => d.key === "C");
      expect(distC?.count).toBe(0);
      expect(distC?.isKey).toBe(false);
    });

    it("correctly handles coding items with partial credit", () => {
      const totals = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];
      const items = [
        {
          questionId: "coding-partial",
          maxPoints: 1,
          scores: [1.0, 0.75, 0.75, 0.5, 0.5, 0.25, 0.25, 0.0, 0.0, 0.0],
        },
      ];

      const result = analyzeTestItems({ items, totals });
      const item = result.items[0];
      expect(item.facility).toBeGreaterThan(0);
      expect(item.discrimination).toBeGreaterThan(0.7);
    });

    it("accurately reports truncation flag", () => {
      const totals = new Array(MAX_SESSIONS_FOR_ANALYSIS + 1).fill(5);
      const items = [
        {
          questionId: "q",
          maxPoints: 1,
          scores: new Array(MAX_SESSIONS_FOR_ANALYSIS + 1).fill(1),
        },
      ];

      const result = analyzeTestItems({ items, totals, truncated: true });
      expect(result.truncated).toBe(true);
    });
  });
});
