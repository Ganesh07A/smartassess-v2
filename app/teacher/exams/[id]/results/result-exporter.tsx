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
  questionsCount: number;
  totalFiltered: number;
  filter: ResultFilter;
}

export default function ResultExporter({
  examId,
  examTitle,
  questionsCount,
  totalFiltered,
  filter,
}: ResultExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const fetchExportRows = async () => {
    const res = await exportExamResults(examId, filter);
    if (res.truncated) {
      toast.info(`Export limited to the first ${res.cap.toLocaleString()} matching records. Narrow your filters to export specific subsets.`);
    }
    return res.rows;
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchExportRows();

      const data = rows.map((res) => {
        const correctCount = res.submissions.filter((s) => s.isCorrect).length;
        return {
          "Student Name": res.student.name || "Unknown",
          "PRN": res.student.prn || "N/A",
          "Email": res.student.email || "N/A",
          "Status": res.status,
          "Score (%)": `${res.percentage.toFixed(1)}%`,
          "Total Score": res.totalScore.toFixed(2),
          "Max Score": res.maxScore.toFixed(2),
          "Correct Answers": `${correctCount}/${questionsCount}`,
          "Violations": res.violationCount,
          "Risk Score": res.riskScore,
          "Submitted At": res.submittedAt ? new Date(res.submittedAt).toLocaleString() : "—",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Results");

      const maxWidth = data.reduce((w, r) => Math.max(w, r["Student Name"].length), 12);
      worksheet["!cols"] = [{ wch: maxWidth + 5 }];

      XLSX.writeFile(workbook, `${examTitle}_Results_Filtered.xlsx`);
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
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text(`${examTitle} — Examination Results`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Generated: ${new Date().toLocaleString()} • Total Exported: ${rows.length} of ${totalFiltered} filtered`,
        14,
        28,
      );

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
        head: [["Student", "PRN", "Status", "Score %", "Total", "Correct", "Violations"]],
        body: tableData,
        startY: 34,
        theme: "striped",
        headStyles: { fillColor: [40, 40, 60] },
        styles: { fontSize: 8 },
      });

      doc.save(`${examTitle}_Results_Filtered.pdf`);
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
