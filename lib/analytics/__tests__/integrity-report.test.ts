import { describe, it, expect } from "vitest";
import {
  buildCanonicalIntegrityPayload,
  computeCanonicalHash,
} from "../integrity-report";

describe("Integrity Report Canonical Hashing", () => {
  const sampleInput = {
    examId: "exam-999",
    examTitle: "Midterm Assessment",
    studentId: "student-101",
    studentName: "John Doe",
    studentPrn: "PRN2026001",
    sessionId: "sess-abc",
    startedAt: "2026-10-02T10:00:00.000Z",
    submittedAt: "2026-10-02T11:00:00.000Z",
    totalScore: 85,
    percentage: 85.0,
    ipAddress: "192.168.1.50",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    events: [
      {
        type: "TAB_BLUR",
        severity: 2,
        occurredAt: "2026-10-02T10:15:00.000Z",
        metadata: { reason: "window blur", count: 1 },
      },
      {
        type: "FULLSCREEN_EXIT",
        severity: 2,
        occurredAt: "2026-10-02T10:30:00.000Z",
        metadata: { reason: "ESC key" },
      },
    ],
    submissions: [
      {
        questionId: "q1",
        submittedAt: "2026-10-02T10:05:00.000Z",
        pointsAwarded: 5,
        isCorrect: true,
      },
      {
        questionId: "q2",
        submittedAt: "2026-10-02T10:20:00.000Z",
        pointsAwarded: 10,
        isCorrect: true,
      },
    ],
  };

  it("produces identical SHA-256 hash when run twice on the same data", async () => {
    const payload1 = buildCanonicalIntegrityPayload(sampleInput);
    const hash1 = await computeCanonicalHash(payload1);

    const payload2 = buildCanonicalIntegrityPayload(sampleInput);
    const hash2 = await computeCanonicalHash(payload2);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // Hex SHA-256
  });

  it("produces identical hash regardless of input event or submission array order", async () => {
    const inputReversed = {
      ...sampleInput,
      events: [...sampleInput.events].reverse(),
      submissions: [...sampleInput.submissions].reverse(),
    };

    const payloadOrig = buildCanonicalIntegrityPayload(sampleInput);
    const hashOrig = await computeCanonicalHash(payloadOrig);

    const payloadReversed = buildCanonicalIntegrityPayload(inputReversed);
    const hashReversed = await computeCanonicalHash(payloadReversed);

    expect(hashReversed).toBe(hashOrig);
  });

  it("produces different hash when data is modified", async () => {
    const modifiedInput = {
      ...sampleInput,
      totalScore: 90, // score changed
    };

    const hashOrig = await computeCanonicalHash(buildCanonicalIntegrityPayload(sampleInput));
    const hashMod = await computeCanonicalHash(buildCanonicalIntegrityPayload(modifiedInput));

    expect(hashMod).not.toBe(hashOrig);
  });
});
