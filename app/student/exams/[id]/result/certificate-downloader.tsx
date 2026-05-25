"use client";

import { useState } from "react";
import { Award, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

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

    const proceedWithPDF = (logoImg?: HTMLImageElement) => {
      try {
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Off-white/cream vintage background
        doc.setFillColor(253, 252, 248);
        doc.rect(0, 0, pageWidth, pageHeight, "F");

        // 2. Thick Outer Navy Border
        doc.setDrawColor(15, 32, 67);
        doc.setLineWidth(4);
        doc.roundedRect(8, 8, pageWidth - 16, pageHeight - 16, 6, 6, "S");

        // 3. Thin Gold Inner Border
        doc.setDrawColor(197, 160, 89);
        doc.setLineWidth(1);
        doc.roundedRect(12, 12, pageWidth - 24, pageHeight - 24, 5, 5, "S");

        // 4. Elegant Corner Accents
        doc.setDrawColor(197, 160, 89);
        doc.setLineWidth(1.5);
        
        // Top Left corner lines
        doc.line(16, 22, 22, 22);
        doc.line(22, 16, 22, 22);
        
        // Top Right corner lines
        doc.line(pageWidth - 16, 22, pageWidth - 22, 22);
        doc.line(pageWidth - 22, 16, pageWidth - 22, 22);
        
        // Bottom Left corner lines
        doc.line(16, pageHeight - 22, 22, pageHeight - 22);
        doc.line(22, pageHeight - 16, 22, pageHeight - 22);
        
        // Bottom Right corner lines
        doc.line(pageWidth - 16, pageHeight - 22, pageWidth - 22, pageHeight - 22);
        doc.line(pageWidth - 22, pageHeight - 16, pageWidth - 22, pageHeight - 22);

        // 5. Official SmartAssess Logo in the Top Center
        if (logoImg) {
          // Embed logo directly without any border drawn around it, sizing it to 26x26mm
          doc.addImage(logoImg, "PNG", pageWidth / 2 - 13, 19, 26, 26);
        } else {
          // Fallback to old gold/navy circle badge
          doc.setFillColor(197, 160, 89);
          doc.circle(pageWidth / 2, 32, 10, "F");
          doc.setFillColor(15, 32, 67);
          doc.circle(pageWidth / 2, 32, 8.5, "F");
          doc.setTextColor(197, 160, 89);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.text("S", pageWidth / 2, 36.5, { align: "center" });
        }

        // 6. Header Typography
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 32, 67);
        doc.setFontSize(10);
        doc.text("SMARTASSESS PLATFORM", pageWidth / 2, 50, { align: "center" });

        doc.setFont("times", "bolditalic");
        doc.setTextColor(197, 160, 89);
        doc.setFontSize(26);
        doc.text("Certificate of Achievement", pageWidth / 2, 64, { align: "center" });

        // 7. Recipient Info
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(11);
        doc.text("THIS CERTIFICATE IS PROUDLY PRESENTED TO", pageWidth / 2, 78, { align: "center" });

        doc.setFont("times", "bold");
        doc.setTextColor(15, 32, 67);
        doc.setFontSize(32);
        doc.text(student.name || "N/A", pageWidth / 2, 94, { align: "center" });

        // Gold line under name
        doc.setDrawColor(197, 160, 89);
        doc.setLineWidth(0.6);
        doc.line(pageWidth / 2 - 50, 98, pageWidth / 2 + 50, 98);

        // 8. Completion Statement
        doc.setFont("times", "italic");
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(13);
        doc.text("for successfully completing the examination and demonstrating proficiency in", pageWidth / 2, 108, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 32, 67);
        doc.setFontSize(20);
        doc.text(exam.title, pageWidth / 2, 120, { align: "center" });

        // 9. Grade Details
        if (certificate.grade) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(80, 80, 80);
          doc.setFontSize(10);
          doc.text("with an overall assessment grade of", pageWidth / 2, 132, { align: "center" });

          doc.setFont("helvetica", "bold");
          doc.setTextColor(197, 160, 89);
          doc.setFontSize(13);
          doc.text(certificate.grade, pageWidth / 2, 140, { align: "center" });
        }

        // 10. Date & Signature Lines
        // Date Left
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.line(40, 168, 85, 168);
        
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 32, 67);
        doc.setFontSize(11);
        doc.text(new Date(certificate.issueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 62.5, 164, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(9);
        doc.text("Date of Issuance", 62.5, 173, { align: "center" });

        // Signature Right
        doc.line(pageWidth - 85, 168, pageWidth - 40, 168);

        // Gold styled digital signature text
        doc.setFont("times", "italic");
        doc.setTextColor(197, 160, 89);
        doc.setFontSize(15);
        doc.text("SmartAssess", pageWidth - 62.5, 163, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(9);
        doc.text("Authorized Signature", pageWidth - 62.5, 173, { align: "center" });

        // 11. Verification footer box
        const verifyUrl = `${window.location.origin}/verify/${certificate.verificationCode}`;
        
        doc.setFillColor(245, 246, 248);
        doc.rect(pageWidth / 2 - 85, 180, 170, 10, "F");
        
        doc.setDrawColor(220, 224, 230);
        doc.setLineWidth(0.2);
        doc.rect(pageWidth / 2 - 85, 180, 170, 10, "S");

        doc.setFont("helvetica", "normal");
        doc.setTextColor(110, 110, 110);
        doc.setFontSize(7.5);
        doc.text(
          `Certificate ID: ${certificate.certificateId}   |   Verification Code: ${certificate.verificationCode}   |   Verify at: ${verifyUrl}`, 
          pageWidth / 2, 
          186.5, 
          { align: "center" }
        );

        // Save PDF
        doc.save(`Certificate_${student.name?.replace(/\s+/g, "_") || "Student"}_SmartAssess.pdf`);
      } catch (error) {
        console.error("PDF Generation Error:", error);
        toast.error("Failed to generate certificate.");
      } finally {
        setIsGenerating(false);
      }
    };

    const img = new Image();
    img.src = "/smartassess-logo.png";
    img.onload = () => proceedWithPDF(img);
    img.onerror = () => {
      console.warn("Failed to load official SmartAssess logo. Generating certificate without it.");
      proceedWithPDF();
    };
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
