"use client";

import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import jsPDF from "jspdf";

interface CertificateDownloaderProps {
  certificate: {
    certificateId: string;
    issueDate: Date;
    grade: string | null;
    verificationCode: string | null;
  };
  student: {
    name: string | null;
    prn: string | null;
  };
  exam: {
    title: string;
  };
}

export default function CertificateDownloader({
  certificate,
  student,
  exam
}: CertificateDownloaderProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Background / Border
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(2);
      doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
      doc.setLineWidth(0.5);
      doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

      // Header
      doc.setFontSize(40);
      doc.setTextColor(30, 64, 175);
      doc.text("SmartAssess", pageWidth / 2, 40, { align: "center" });
      
      doc.setFontSize(20);
      doc.setTextColor(100);
      doc.text("CERTIFICATE OF COMPLETION", pageWidth / 2, 55, { align: "center" });

      // Body
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("This is to certify that", pageWidth / 2, 80, { align: "center" });

      doc.setFontSize(30);
      doc.setTextColor(30, 64, 175);
      doc.text(student.name || "N/A", pageWidth / 2, 95, { align: "center" });

      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text(`has successfully completed the examination`, pageWidth / 2, 110, { align: "center" });

      doc.setFontSize(22);
      doc.setTextColor(30, 64, 175);
      doc.text(exam.title, pageWidth / 2, 125, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(100);
      doc.text(`Issued on ${new Date(certificate.issueDate).toLocaleDateString()}`, pageWidth / 2, 140, { align: "center" });
      
      if (certificate.grade) {
        doc.setFontSize(18);
        doc.setTextColor(0);
        doc.text(`Grade: ${certificate.grade}`, pageWidth / 2, 155, { align: "center" });
      }

      // Footer
      const verifyUrl = `${window.location.origin}/verify/${certificate.verificationCode}`;
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Certificate ID: ${certificate.certificateId}`, 20, pageHeight - 20);
      doc.text(`Verify at: ${verifyUrl}`, pageWidth / 2, pageHeight - 20, { align: "center" });
      doc.text(`Verification Code: ${certificate.verificationCode}`, pageWidth - 20, pageHeight - 20, { align: "right" });

      // Save
      doc.save(`Certificate_${student.name}_${exam.title}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert("Failed to generate certificate.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={isGenerating}
      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
    >
      {isGenerating ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <Award className="w-5 h-5 mr-2" />
      )}
      {isGenerating ? "Preparing..." : "Download Certificate"}
    </button>
  );
}
