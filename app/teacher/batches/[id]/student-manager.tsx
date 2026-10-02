"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Loader2,
  UserMinus,
  FileSpreadsheet,
  ListPlus,
  Trash2,
  CheckSquare,
  Square,
  AlertCircle,
  X,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";
import type { RosterRow } from "@/lib/filters/builders/roster";
import type { PagedResult } from "@/lib/filters/pagination";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { ConfirmDialog } from "@/ui/filters/confirm-dialog";
import { EmptyState } from "@/ui/filters/empty-state";
import {
  addStudentToBatch,
  addStudentsToBatch,
  importStudentsFromCsv,
  bulkRemoveStudentsFromBatch,
  removeStudentFromBatch,
  type CsvStudentInput,
} from "@/app/actions/batch";

interface StudentManagerProps {
  batchId: string;
  batchName: string;
  data: PagedResult<RosterRow>;
}

export default function StudentManager({
  batchId,
  batchName,
  data,
}: StudentManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [activeModal, setActiveModal] = useState<"single" | "paste" | "csv" | null>(null);

  // Single add state
  const [singleIdent, setSingleIdent] = useState("");

  // Paste list state
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState<{
    added: number;
    notFound: string[];
    alreadyInBatch: string[];
  } | null>(null);

  // CSV Import state
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<{
    created: number;
    enrolled: number;
    errors: { row: number; identifier: string; error: string }[];
  } | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const filterDefs: FilterDef[] = [
    {
      type: "search",
      param: "q",
      label: "Student",
      placeholder: "Search by student name, PRN, or email...",
    },
    {
      type: "facet",
      param: "year",
      label: "Year",
      options: data.facets?.year ?? [],
    },
    {
      type: "facet",
      param: "division",
      label: "Division",
      options: data.facets?.division ?? [],
    },
    {
      type: "sort",
      param: "sort",
      label: "Sort by",
      sortOptions: [
        { value: "name", label: "Student Name" },
        { value: "prn", label: "PRN" },
        { value: "addedAt", label: "Date Added" },
      ],
    },
  ];

  const isAllSelected =
    data.rows.length > 0 && data.rows.every((row) => selectedIds.includes(row.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.rows.map((row) => row.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  /* ------------------------------------------------------------- Single Add */
  const handleSingleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleIdent.trim()) return;

    startTransition(async () => {
      try {
        await addStudentToBatch(batchId, singleIdent.trim());
        toast.success("Student enrolled in batch");
        setSingleIdent("");
        setActiveModal(null);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to add student");
      }
    });
  };

  /* ------------------------------------------------------------- Paste List Add */
  const handlePasteAdd = async () => {
    const lines = pasteText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Please enter at least one email or PRN");
      return;
    }

    startTransition(async () => {
      try {
        const res = await addStudentsToBatch(batchId, lines);
        setPasteResult(res);
        toast.success(`Enrolled ${res.added} student(s)`);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to process student list");
      }
    });
  };

  /* ------------------------------------------------------------- CSV Import */
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) setCsvText(text);
    };
    reader.readAsText(file);
  };

  const parseCsvToRows = (csvContent: string): CsvStudentInput[] => {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes("name"));
    const emailIdx = headers.findIndex((h) => h.includes("email"));
    const prnIdx = headers.findIndex((h) => h.includes("prn"));
    const deptIdx = headers.findIndex((h) => h.includes("dept") || h.includes("department"));
    const yearIdx = headers.findIndex((h) => h.includes("year"));
    const divIdx = headers.findIndex((h) => h.includes("div") || h.includes("division"));

    const rows: CsvStudentInput[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length === 0 || parts.every((p) => !p)) continue;

      const name = nameIdx !== -1 ? parts[nameIdx] : parts[0] || "";
      const email = emailIdx !== -1 ? parts[emailIdx] : parts[1] || "";
      const prn = prnIdx !== -1 ? parts[prnIdx] : parts[2] || undefined;
      const department = deptIdx !== -1 ? parts[deptIdx] : undefined;
      const year = yearIdx !== -1 ? parts[yearIdx] : undefined;
      const division = divIdx !== -1 ? parts[divIdx] : undefined;

      rows.push({ name, email, prn, department, year, division });
    }

    return rows;
  };

  const handleCsvImport = async () => {
    const rows = parseCsvToRows(csvText);
    if (rows.length === 0) {
      toast.error("No valid student rows found in CSV");
      return;
    }

    startTransition(async () => {
      try {
        const res = await importStudentsFromCsv(batchId, rows);
        setCsvResult(res);
        toast.success(`Import complete: ${res.created} created, ${res.enrolled} enrolled`);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to import CSV");
      }
    });
  };

  /* ------------------------------------------------------------- Bulk Remove */
  const handleBulkRemove = async () => {
    startTransition(async () => {
      try {
        const res = await bulkRemoveStudentsFromBatch(batchId, selectedIds);
        toast.success(`Removed ${res.count} student(s) from batch`);
        setSelectedIds([]);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to remove students");
      }
    });
  };

  /* ------------------------------------------------------------- Single Remove */
  const handleSingleRemove = async (studentId: string) => {
    setRemovingId(studentId);
    try {
      await removeStudentFromBatch(batchId, studentId);
      toast.success("Student removed from batch");
      router.refresh();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to remove student");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Strip: Enrolment Methods */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider ml-1">
            Enrolment:
          </span>
          <button
            type="button"
            onClick={() => setActiveModal("single")}
            className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Single Student
          </button>
          <button
            type="button"
            onClick={() => {
              setPasteResult(null);
              setActiveModal("paste");
            }}
            className="px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ListPlus className="w-3.5 h-3.5" />
            Paste List
          </button>
          <button
            type="button"
            onClick={() => {
              setCsvResult(null);
              setActiveModal("csv");
            }}
            className="px-3 py-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV Import
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in">
            <span className="text-xs font-bold text-slate-500">
              {selectedIds.length} selected
            </span>
            <ConfirmDialog
              title="Remove Students from Batch"
              description={`Are you sure you want to remove ${selectedIds.length} student(s) from "${batchName}"? Their accounts and exam submissions remain intact.`}
              confirmLabel="Remove Students"
              variant="danger"
              isLoading={isPending}
              onConfirm={handleBulkRemove}
              trigger={
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Selected
                </button>
              }
            />
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40">
        <FilterBar defs={filterDefs} />
      </div>

      {/* Roster Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-slate-400 hover:text-indigo-600 cursor-pointer"
              title={isAllSelected ? "Deselect all" : "Select all on page"}
            >
              {isAllSelected ? (
                <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>
            <h3 className="font-black text-slate-800 text-sm">
              Enrolled Roster ({data.total})
            </h3>
          </div>
        </div>

        {data.rows.length === 0 ? (
          <EmptyState
            title="No enrolled students found"
            description="Use Single Add, Paste List, or CSV Import to populate this batch."
            action={
              <button
                type="button"
                onClick={() => setActiveModal("single")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                Add Student
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.rows.map((student) => {
              const isSelected = selectedIds.includes(student.id);

              return (
                <div
                  key={student.id}
                  className={`px-6 py-4 flex items-center justify-between gap-4 transition-colors ${
                    isSelected ? "bg-indigo-50/30" : "hover:bg-slate-50/40"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSelectRow(student.id)}
                      className="text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-slate-800 text-sm">
                          {student.name || "Unnamed Student"}
                        </p>
                        {student.prn && (
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                            {student.prn}
                          </span>
                        )}
                        {student.year && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-1.5 py-0.5 rounded">
                            {student.year}
                          </span>
                        )}
                        {student.division && (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100/60 px-1.5 py-0.5 rounded">
                            Div {student.division}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">{student.email}</p>
                    </div>
                  </div>

                  <ConfirmDialog
                    title="Remove Student from Batch"
                    description={`Remove ${student.name || "this student"} from ${batchName}?`}
                    confirmLabel="Remove"
                    variant="danger"
                    isLoading={removingId === student.id}
                    onConfirm={() => handleSingleRemove(student.id)}
                    trigger={
                      <button
                        type="button"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Remove student from batch"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {data.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100">
            <Pagination
              total={data.total}
              page={data.page}
              perPage={data.perPage}
              totalPages={data.totalPages}
            />
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- Modals */}

      {/* Single Add Modal */}
      {activeModal === "single" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-800">Add Student</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Enroll an existing student by email or PRN.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleAdd} className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="Enter email or PRN (e.g. 2024CS001)"
                value={singleIdent}
                onChange={(e) => setSingleIdent(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !singleIdent.trim()}
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Enrol Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Paste List Modal */}
      {activeModal === "paste" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-800">Paste Student List</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Enter emails or PRNs separated by commas or new lines (up to 500).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!pasteResult ? (
              <div className="space-y-4">
                <textarea
                  rows={8}
                  placeholder={`student1@college.edu\n2024CS002\nstudent3@college.edu`}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-medium border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                />

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !pasteText.trim()}
                    onClick={handlePasteAdd}
                    className="px-5 py-2 text-xs font-black bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add to Batch
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-center">
                    <p className="text-xl font-black text-emerald-700">{pasteResult.added}</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Added</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl text-center">
                    <p className="text-xl font-black text-amber-700">{pasteResult.alreadyInBatch.length}</p>
                    <p className="text-[10px] font-bold text-amber-600 uppercase">Already Enrolled</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-center">
                    <p className="text-xl font-black text-rose-700">{pasteResult.notFound.length}</p>
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Not Found</p>
                  </div>
                </div>

                {pasteResult.notFound.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl space-y-1 max-h-36 overflow-y-auto">
                    <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Unrecognized Identifiers (Not in database):
                    </p>
                    <p className="text-[11px] font-mono text-rose-700">
                      {pasteResult.notFound.join(", ")}
                    </p>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setPasteResult(null);
                      setPasteText("");
                      setActiveModal(null);
                    }}
                    className="px-5 py-2 text-xs font-black bg-slate-800 hover:bg-slate-900 text-white rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {activeModal === "csv" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-800">CSV Student Onboarding</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Create accounts & enrol students directly. Expected headers:{" "}
                  <code className="text-indigo-600 font-bold">name, email, prn, year, division</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!csvResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer">
                    <FileUp className="w-3.5 h-3.5" />
                    Select CSV File
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={handleCsvFileUpload}
                    />
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Or paste raw CSV text below
                  </span>
                </div>

                <textarea
                  rows={7}
                  placeholder={`name,email,prn,year,division\nAlex Smith,alex@college.edu,2024CS001,Third Year,A`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono font-medium border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                />

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !csvText.trim()}
                    onClick={handleCsvImport}
                    className="px-5 py-2 text-xs font-black bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Import Students
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-center">
                    <p className="text-xl font-black text-emerald-700">{csvResult.created}</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Created</p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl text-center">
                    <p className="text-xl font-black text-indigo-700">{csvResult.enrolled}</p>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase">Enrolled</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-center">
                    <p className="text-xl font-black text-rose-700">{csvResult.errors.length}</p>
                    <p className="text-[10px] font-bold text-rose-600 uppercase">Errors</p>
                  </div>
                </div>

                {csvResult.errors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl space-y-1.5 max-h-40 overflow-y-auto">
                    <p className="text-xs font-bold text-rose-800">
                      Row Errors ({csvResult.errors.length}):
                    </p>
                    <div className="space-y-1">
                      {csvResult.errors.map((err, i) => (
                        <div key={i} className="text-[11px] text-rose-700">
                          <strong className="font-bold">Row {err.row} ({err.identifier}):</strong>{" "}
                          {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setCsvResult(null);
                      setCsvText("");
                      setActiveModal(null);
                    }}
                    className="px-5 py-2 text-xs font-black bg-slate-800 hover:bg-slate-900 text-white rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
