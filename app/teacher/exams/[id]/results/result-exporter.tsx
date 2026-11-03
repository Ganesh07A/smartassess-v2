"use client";

import { useState } from "react";
import { FileSpreadsheet, Printer, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { exportExamResults } from "@/app/actions/exam-filters";
import type { ResultFilter } from "@/lib/filters/schemas";

interface ResultExporterProps {
  examId: string;
  examTitle: string;
  batchName?: string;
  questionsCount: number;
  totalFiltered: number;
  filter: ResultFilter;
}

export default function ResultExporter({
  examId,
  examTitle,
  batchName,
  questionsCount,
  totalFiltered,
  filter,
}: ResultExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const fetchExportRows = async () => {
    const res = await exportExamResults(examId, filter);
    if (res.truncated) {
      toast.info(
        `Export limited to the first ${res.cap.toLocaleString()} matching records. Narrow your filters to export specific subsets.`
      );
    }
    return res.rows;
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchExportRows();
      if (rows.length === 0) {
        toast.info("No records to export.");
        return;
      }

      const data = rows.map((res) => {
        const correctCount = res.submissions.filter((s) => s.isCorrect).length;
        return {
          "Student Name": res.student.name || "Unknown",
          PRN: res.student.prn || "N/A",
          Email: res.student.email || "N/A",
          Status: res.status,
          "Score (%)": `${res.percentage.toFixed(1)}%`,
          "Total Score": res.totalScore.toFixed(2),
          "Max Score": res.maxScore.toFixed(2),
          "Correct Answers": `${correctCount}/${questionsCount}`,
          Violations: res.violationCount,
          "Risk Score": res.riskScore,
          "Submitted At": res.submittedAt
            ? new Date(res.submittedAt).toLocaleString()
            : "—",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Results");

      const maxWidth = data.reduce(
        (w, r) => Math.max(w, r["Student Name"].length),
        12
      );
      worksheet["!cols"] = [{ wch: maxWidth + 5 }];

      XLSX.writeFile(
        workbook,
        `${examTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Results_Filtered.xlsx`
      );
      toast.success(`Exported ${rows.length} results to Excel.`);
    } catch (err) {
      console.error("Excel Export Error:", err);
      toast.error("Failed to export Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchExportRows();
      if (rows.length === 0) {
        toast.info("No records to export.");
        return;
      }

      // Responsive layout:
      // Small exports (<= 25 students): compact portrait PDF
      // Larger exports (> 25 students): landscape layout for optimal readability
      const isLandscape = rows.length > 25;
      const doc = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      // 1. Header: SmartAssess | Examination Report
      let currentY = 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("SmartAssess | Examination Report", margin, currentY);

      // Metadata bullet list
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // slate-600

      const now = new Date();
      const formattedDate =
        now.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }) +
        ", " +
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

      const exportScopeText = `${rows.length} ${
        rows.length === 1 ? "student" : "students"
      }${totalFiltered !== rows.length ? ` (${totalFiltered} total matching filters)` : ""}`;

      const metaLines = [
        `- Exam: ${examTitle}`,
        `- Batch: ${batchName || "N/A"}`,
        `- Generated: ${formattedDate}`,
        `- Export scope: ${exportScopeText}`,
      ];

      metaLines.forEach((line) => {
        doc.text(line, margin, currentY);
        currentY += 4.5;
      });

      // 2. Metrics Calculation (Violations omitted from top summary per user request)
      const totalStudents = rows.length;
      const avgScore =
        totalStudents > 0
          ? (
              rows.reduce((sum, r) => sum + r.percentage, 0) / totalStudents
            ).toFixed(1) + "%"
          : "0%";
      const completedCount = rows.filter(
        (r) => r.status === "COMPLETED" || r.status === "FORCE_SUBMITTED"
      ).length;

      // Summary Header Line
      currentY += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Students: ${totalStudents} \u00B7 Average Score: ${avgScore} \u00B7 Completed: ${completedCount}`,
        margin,
        currentY
      );

      // Summary Cards Container (3 cards: Students, Average Score, Completed)
      currentY += 2.5;
      const cards = [
        { label: "STUDENTS", value: String(totalStudents) },
        { label: "AVERAGE SCORE", value: avgScore },
        { label: "COMPLETED", value: String(completedCount) },
      ];

      const cardGap = 4;
      const cardWidth =
        (contentWidth - cardGap * (cards.length - 1)) / cards.length;
      const cardHeight = 12;

      cards.forEach((card, idx) => {
        const cardX = margin + idx * (cardWidth + cardGap);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(card.label, cardX + 3.5, currentY + 4);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(card.value, cardX + 3.5, currentY + 9.5);
      });

      currentY += cardHeight + 6;

      // 3. Detailed Student Table:
      // STRICT HEADERS ONLY: Student, PRN, Status, Score%, Total, Correct, Violations
      const headers = [
        ["Student", "PRN", "Status", "Score%", "Total", "Correct", "Violations"],
      ];

      const tableData = rows.map((res) => {
        const correctCount = res.submissions.filter((s) => s.isCorrect).length;
        return [
          res.student.name || "Unknown",
          res.student.prn || "N/A",
          res.status,
          `${res.percentage.toFixed(1)}%`,
          res.totalScore.toFixed(1),
          `${correctCount}/${questionsCount}`,
          String(res.violationCount),
        ];
      });

      autoTable(doc, {
        head: headers,
        body: tableData,
        startY: currentY,
        theme: "striped",
        showHead: "everyPage",
        rowPageBreak: "avoid",
        headStyles: {
          fillColor: [30, 41, 59], // slate-800
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: isLandscape ? 8 : 7.5,
          cellPadding: 2,
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: isLandscape ? 7.5 : 7,
          cellPadding: 2,
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: isLandscape
          ? {
              0: { halign: "left" }, // Student (takes available width)
              1: { halign: "left", cellWidth: 38 }, // PRN
              2: { halign: "center", cellWidth: 32 }, // Status
              3: { halign: "right", cellWidth: 26 }, // Score %
              4: { halign: "right", cellWidth: 26 }, // Total
              5: { halign: "center", cellWidth: 26 }, // Correct
              6: { halign: "center", cellWidth: 26 }, // Violations
            }
          : {
              0: { halign: "left" }, // Student (takes available width)
              1: { halign: "left", cellWidth: 30 }, // PRN
              2: { halign: "center", cellWidth: 25 }, // Status
              3: { halign: "right", cellWidth: 22 }, // Score %
              4: { halign: "right", cellWidth: 22 }, // Total
              5: { halign: "center", cellWidth: 22 }, // Correct
              6: { halign: "center", cellWidth: 22 }, // Violations
            },
      });

      // 4. Repeated Footer Page Numbers on Every Page
      const totalPages = (
        doc.internal as unknown as { getNumberOfPages: () => number }
      ).getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          "SmartAssess Examination System — Confidential Academic Record",
          margin,
          pageHeight - 7
        );
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth - margin,
          pageHeight - 7,
          { align: "right" }
        );
      }

      doc.save(`${examTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Results_Report.pdf`);
      toast.success(`Exported ${rows.length} results to PDF.`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast.error("Failed to export PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={exportToExcel}
        disabled={isExporting || totalFiltered === 0}
        className="flex items-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
        )}
        Excel ({totalFiltered})
      </button>

      <button
        type="button"
        onClick={exportToPDF}
        disabled={isExporting || totalFiltered === 0}
        className="flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Printer className="w-3.5 h-3.5 mr-1.5" />
        )}
        PDF
      </button>
    </div>
  );
}
