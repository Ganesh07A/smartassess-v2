"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface ResultExporterProps {
  exam: {
    title: string;
    batch: { name: string };
    _count: { questions: number };
  };
  results: any[];
}

export default function ResultExporter({ exam, results }: ResultExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = () => {
    setIsExporting(true);
    try {
      const data = results.map((res) => ({
        "Student Name": res.student.name,
        "PRN": res.student.prn || "N/A",
        "Email": res.student.email,
        "Status": res.status,
        "Correct Answers": `${res.correctAnswers}/${exam._count.questions}`,
        "Total Score": res.totalScore.toFixed(2),
        "Last Updated": new Date(res.updatedAt).toLocaleString(),
        "Tab Switches": res.tabSwitches
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Results");

      // Auto-size columns
      const max_width = data.reduce((w, r) => Math.max(w, r["Student Name"].length), 10);
      worksheet["!cols"] = [{ wch: max_width + 5 }];

      XLSX.writeFile(workbook, `${exam.title}_Results.xlsx`);
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Failed to export Excel report.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF() as any;
      const pageWidth = doc.internal.pageSize.getWidth();

      // Title & Header
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175); // Blue-800
      doc.text("Official Examination Report", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text(`Exam: ${exam.title}`, pageWidth / 2, 30, { align: "center" });
      doc.text(`Batch: ${exam.batch.name}`, pageWidth / 2, 38, { align: "center" });

      doc.setDrawColor(200);
      doc.line(20, 45, pageWidth - 20, 45);

      // Summary Table
      const tableData = results.map((res) => [
        res.student.name,
        res.student.prn || "N/A",
        res.status,
        `${res.correctAnswers}/${exam._count.questions}`,
        res.totalScore.toFixed(2),
        res.tabSwitches.toString()
      ]);

      (doc as any).autoTable({
        startY: 55,
        head: [['Student', 'PRN', 'Status', 'Correct', 'Score', 'Warnings']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          4: { fontStyle: 'bold', textColor: [22, 101, 52] } // Green for scores
        }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Report Generated: ${new Date().toLocaleString()}`, 20, finalY);
      doc.text(`SmartAssess Platform - Confidential`, pageWidth - 20, finalY, { align: "right" });

      doc.save(`${exam.title}_Official_Report.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Failed to export PDF report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={exportToExcel}
        disabled={isExporting}
        className="flex items-center px-4 py-2 bg-white border-2 border-green-600 text-green-700 font-bold rounded-xl hover:bg-green-50 transition-all shadow-sm text-sm"
      >
        <FileSpreadsheet className="w-4 h-4 mr-2" />
        Excel Export
      </button>
      <button
        onClick={exportToPDF}
        disabled={isExporting}
        className="flex items-center px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all text-sm"
      >
        <Printer className="w-4 h-4 mr-2" />
        Official PDF
      </button>
    </div>
  );
}
