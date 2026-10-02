"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface ExportEvidenceButtonProps {
  examTitle: string;
  studentName: string;
  studentPrn: string | null;
  studentEmail: string | null;
  sessionId: string;
  startedAt: Date | string | null;
  submittedAt: Date | string | null;
  totalScore: number;
  percentage: number;
  ipAddress: string | null;
  userAgent: string | null;
  events: {
    occurredAt: Date | string;
    type: string;
    severity: number;
    metadata?: unknown;
  }[];
  submissions: {
    questionId: string;
    submittedAt: Date | string;
    pointsAwarded?: number | null;
    isCorrect?: boolean | null;
  }[];
  canonicalHash: string;
  teacherName?: string;
  className?: string;
}

export function ExportEvidenceButton({
  examTitle,
  studentName,
  studentPrn,
  studentEmail,
  sessionId,
  startedAt,
  submittedAt,
  totalScore,
  percentage,
  ipAddress,
  userAgent,
  events,
  submissions,
  canonicalHash,
  teacherName = "Faculty Examiner",
  className = "",
}: ExportEvidenceButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF();

      // Header Banner
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, 210, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("SMARTASSESS ASSESSMENT INTEGRITY REPORT", 14, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text("Official Invigilation Audit Trail — Generated for institutional disciplinary purposes", 14, 20);

      // Student & Exam Meta Info Box
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Candidate & Session Record", 14, 38);

      const metaRows = [
        [
          `Student: ${studentName}`,
          `PRN: ${studentPrn || "N/A"}`,
          `Email: ${studentEmail || "N/A"}`,
        ],
        [
          `Examination: ${examTitle}`,
          `Session ID: ${sessionId.slice(0, 16)}...`,
          `Final Score: ${totalScore.toFixed(2)} (${percentage.toFixed(1)}%)`,
        ],
        [
          `Started: ${startedAt ? new Date(startedAt).toLocaleString() : "—"}`,
          `Submitted: ${submittedAt ? new Date(submittedAt).toLocaleString() : "—"}`,
          `Client IP: ${ipAddress || "Unknown"}`,
        ],
        [
          `User Agent: ${(userAgent || "Unknown").slice(0, 75)}...`,
          "",
          "",
        ],
      ];

      autoTable(doc, {
        startY: 42,
        body: metaRows,
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 1.5, textColor: [71, 85, 105] },
      });

      // Proctoring Event Log Table
      const currentY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 65;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text("Chronological Proctoring Events", 14, currentY + 10);

      const eventRows = events.map((e) => {
        let metaStr = "";
        if (e.metadata && typeof e.metadata === "object") {
          metaStr = Object.entries(e.metadata)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | ");
        }

        const sevLabel =
          e.severity === 0
            ? "Info"
            : e.severity === 1
              ? "Warning"
              : e.severity === 2
                ? "Violation"
                : "Critical";

        return [
          new Date(e.occurredAt).toLocaleTimeString(),
          e.type.replace(/_/g, " "),
          sevLabel,
          metaStr || "—",
        ];
      });

      autoTable(doc, {
        startY: currentY + 14,
        head: [["Time", "Event Type", "Severity", "Details / Context"]],
        body: eventRows.length > 0 ? eventRows : [["—", "No recorded proctoring violations", "—", "—"]],
        headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      // Interleaved Submissions Summary
      const postEventsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

      if (postEventsY < 230) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text("Submission Sequence Log", 14, postEventsY + 10);

        const subRows = submissions.map((s, idx) => [
          `#${idx + 1}`,
          new Date(s.submittedAt).toLocaleTimeString(),
          s.pointsAwarded !== null ? `${s.pointsAwarded} pts` : "—",
          s.isCorrect === true ? "Correct" : s.isCorrect === false ? "Incorrect" : "Evaluated",
        ]);

        autoTable(doc, {
          startY: postEventsY + 14,
          head: [["Item", "Answer Time", "Awarded", "Status"]],
          body: subRows.length > 0 ? subRows : [["—", "No submissions recorded", "—", "—"]],
          headStyles: { fillColor: [15, 118, 110], fontSize: 8, fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 2 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      }

      // Footer with SHA-256 verification hash
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 282, 196, 282);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`SHA-256 Verification Hash: ${canonicalHash}`, 14, 286);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Invigilator: ${teacherName} | Generated: ${new Date().toUTCString()} | Page ${i} of ${pageCount}`,
          14,
          291,
        );
      }

      const filename = `integrity_evidence_${(studentPrn || studentName).replace(/\s+/g, "_")}_${sessionId.slice(0, 8)}.pdf`;
      doc.save(filename);
      toast.success("Integrity evidence report generated");
    } catch (err) {
      console.error("Evidence export error:", err);
      toast.error("Failed to generate integrity evidence PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isExporting}
      onClick={handleExport}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50 ${className || "bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60"}`}
    >
      {isExporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
      )}
      <span>Export Evidence PDF</span>
    </button>
  );
}
