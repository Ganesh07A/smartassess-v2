"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadQuestions } from "@/app/actions/exam";



export default function BulkUpload({ examId }: { examId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const downloadTemplate = () => {
    const mcqSheet = [
      {
        Type: "MCQ",
        Content: "What is the capital of France?",
        OptionA: "Paris",
        OptionB: "London",
        OptionC: "Berlin",
        OptionD: "Madrid",
        CorrectAnswer: "A",
        Points: 1,
      },
    ];

    const codingSheet = [
      {
        Type: "CODING",
        Content: "Write a function to add two numbers.",
        TestCases: "1 2 | 3\n10 20 | 30",
        Points: 5,
      },
    ];

    const wb = XLSX.utils.book_new();
    const wsMCQ = XLSX.utils.json_to_sheet(mcqSheet);
    const wsCoding = XLSX.utils.json_to_sheet(codingSheet);

    XLSX.utils.book_append_sheet(wb, wsMCQ, "MCQs");
    XLSX.utils.book_append_sheet(wb, wsCoding, "Coding");

    XLSX.writeFile(wb, "SmartAssess_Question_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setStatus(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        
        const allQuestions: {
          type: "MCQ" | "CODING";
          content: string;
          options?: Record<string, string>;
          correctAnswer?: string;
          testCases?: { input: string; output: string }[];
          points: number;
        }[] = [];
        const skippedRows: string[] = [];

        // Parse all sheets in the workbook to be highly flexible and robust
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;

          const sheetData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
          if (!sheetData || sheetData.length === 0) continue;

          sheetData.forEach((row) => {
            // Find key-value pairs with case-insensitive and space-trimmed keys
            const normalizedRow: Record<string, unknown> = {};
            Object.keys(row).forEach((key) => {
              const normalizedKey = key.toLowerCase().replace(/\s+/g, "");
              normalizedRow[normalizedKey] = row[key];
            });

            const contentVal = normalizedRow["content"];
            const content = contentVal ? String(contentVal).trim() : "";
            // Skip rows without content to avoid reading empty template rows
            if (!content) return;

            const typeVal = normalizedRow["type"];
            const type = typeVal ? String(typeVal).toUpperCase().trim() : "";
            const pointsVal = normalizedRow["points"];
            const points = typeof pointsVal === "number" ? pointsVal : parseFloat(String(pointsVal || "")) || 1.0;

            const optionAVal = normalizedRow["optiona"];
            const optionBVal = normalizedRow["optionb"];
            const optionCVal = normalizedRow["optionc"];
            const optionDVal = normalizedRow["optiond"];
            const correctAnswerVal = normalizedRow["correctanswer"];
            const testcasesVal = normalizedRow["testcases"];

            // Determine if the question is MCQ or CODING
            // Check 'type' first, then fall back to inferring by the presence of options/testcases keys
            if (
              type === "MCQ" ||
              (!type && (correctAnswerVal !== undefined || optionAVal !== undefined))
            ) {
              // Drop blank options and validate the key here so a malformed row is reported to the
              // teacher instead of being rejected later by server-side validation.
              const options: Record<string, string> = {};
              (
                [
                  ["A", optionAVal],
                  ["B", optionBVal],
                  ["C", optionCVal],
                  ["D", optionDVal],
                ] as const
              ).forEach(([key, value]) => {
                const text = (value !== undefined ? String(value) : "").trim();
                if (text) options[key] = text;
              });

              const correctAnswer = (correctAnswerVal !== undefined ? String(correctAnswerVal) : "")
                .trim()
                .toUpperCase();

              if (Object.keys(options).length < 2 || !(correctAnswer in options)) {
                skippedRows.push(`"${content.slice(0, 40)}…" (MCQ needs ≥2 options and a valid answer key)`);
                return;
              }

              allQuestions.push({
                type: "MCQ",
                content,
                options,
                correctAnswer,
                points,
              });
            } else if (
              type === "CODING" ||
              (!type && testcasesVal !== undefined)
            ) {
              const rawCases = testcasesVal;
              let testCases: { input: string; output: string }[] = [];

              if (typeof rawCases === "string") {
                try {
                  testCases = JSON.parse(rawCases);
                } catch {
                  testCases = rawCases
                    .split("\n")
                    .filter((line) => line.includes("|"))
                    .map((line) => {
                      const [input, output] = line.split("|").map((s) => s.trim());
                      return { input, output };
                    });
                }
              } else if (Array.isArray(rawCases)) {
                testCases = rawCases as { input: string; output: string }[];
              }

              const validTestCases = (Array.isArray(testCases) ? testCases : []).filter(
                (testCase) => testCase.input?.trim() && testCase.output?.trim(),
              );

              if (validTestCases.length === 0) {
                skippedRows.push(`"${content.slice(0, 40)}…" (coding question needs at least one test case)`);
                return;
              }

              allQuestions.push({
                type: "CODING",
                content,
                testCases: validTestCases,
                points,
              });
            }
          });
        }

        if (allQuestions.length === 0) {
          throw new Error(
            skippedRows.length > 0
              ? `No valid questions found. Skipped ${skippedRows.length} row(s): ${skippedRows.slice(0, 3).join(", ")}`
              : "No questions found in the file. Please ensure sheet names or columns match the template.",
          );
        }

        await uploadQuestions(examId, allQuestions);
        setStatus({
          type: "success",
          message:
            skippedRows.length > 0
              ? `Uploaded ${allQuestions.length} questions. Skipped ${skippedRows.length} invalid row(s): ${skippedRows
                  .slice(0, 3)
                  .join(", ")}${skippedRows.length > 3 ? "…" : ""}`
              : `Successfully uploaded ${allQuestions.length} questions.`,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to parse or upload file.";
        setStatus({ type: "error", message: errorMsg });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <h3 className="text-lg text-black font-semibold mb-4 flex items-center">
        <FileSpreadsheet className="w-5 h-5 mr-2 text-green-600" />
        Bulk Upload Questions
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Download our predefined Excel template to add MCQs and Coding questions in bulk.
          </p>
          <button
            onClick={downloadTemplate}
            className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </button>
        </div>

        <div className="relative border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center hover:border-blue-400 transition-colors group">
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={loading}
          />
          {loading ? (
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2" />
              <p className="text-sm font-medium text-gray-600">Click or drag Excel file to upload</p>
              <p className="text-xs text-gray-400 mt-1">.xlsx, .xls only</p>
            </>
          )}
        </div>
      </div>

      {status && (
        <div className={`mt-6 p-4 rounded-lg flex items-center ${
          status.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          {status.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 mr-3 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          )}
          <p className="text-sm">{status.message}</p>
        </div>
      )}
    </div>
  );
}
