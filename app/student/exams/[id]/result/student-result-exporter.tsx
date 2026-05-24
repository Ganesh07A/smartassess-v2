"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

interface StudentResultExporterProps {
  student: {
    name: string | null;
    prn: string | null;
  };
  exam: {
    title: string;
    batch: { name: string };
  };
  score: number;
  totalPoints: number;
  percentage: number;
  questions: {
    questionId: string;
    question: {
      content: string;
      type: string;
    }
  }[];
  submissions: {
    questionId: string;
    isCorrect: boolean | null;
    pointsAwarded: number | null;
  }[];
}

export default function StudentResultExporter({
  student,
  exam,
  score,
  totalPoints,
  percentage,
  questions,
  submissions
}: StudentResultExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const downloadReport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175);
      doc.text("Individual Performance Report", pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Student: ${student.name || "Unknown"} (PRN: ${student.prn || "N/A"})`, 20, 35);
      doc.text(`Exam: ${exam.title}`, 20, 42);
      doc.text(`Batch: ${exam.batch.name}`, 20, 49);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 20, 35, { align: "right" });

      doc.setDrawColor(200);
      doc.line(20, 55, pageWidth - 20, 55);

      // Score Summary
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Summary", 20, 65);
      
      autoTable(doc, {
        startY: 70,
        head: [['Metric', 'Value']],
        body: [
          ['Total Points Obtained', `${score.toFixed(1)} / ${totalPoints.toFixed(1)}`],
          ['Percentage', `${percentage.toFixed(2)}%`],
          ['Result Status', percentage >= 40 ? 'PASS' : 'FAIL'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175] },
        styles: { fontSize: 10 }
      });

      // Question Breakdown
      const tableData = questions.map((eq, idx) => {
        const sub = submissions.find(s => s.questionId === eq.questionId);
        return [
          (idx + 1).toString(),
          eq.question.content.substring(0, 50) + (eq.question.content.length > 50 ? "..." : ""),
          eq.question.type,
          sub?.isCorrect ? "Correct" : (sub?.pointsAwarded && sub.pointsAwarded > 0 ? "Partial" : "Incorrect"),
          sub?.pointsAwarded?.toFixed(1) || "0.0"
        ];
      });

      // @ts-expect-error - lastAutoTable is added dynamically by jspdf-autotable
      const finalY = doc.lastAutoTable.finalY + 15;
      doc.text("Question-wise Breakdown", 20, finalY);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['#', 'Question', 'Type', 'Status', 'Points']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [75, 85, 99] },
        styles: { fontSize: 9 }
      });

      doc.save(`${student.name}_${exam.title}_Report.pdf`);
    } catch (err) {
      console.error("Report Download Error:", err);
      toast.error("Failed to generate report.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={downloadReport}
      disabled={isExporting}
      className="flex items-center px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all disabled:opacity-50"
    >
      <Download className="w-5 h-5 mr-2" />
      {isExporting ? "Generating..." : "Download Report"}
    </button>
  );
}
