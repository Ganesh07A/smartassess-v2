"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { CertificateRow } from "@/lib/filters/builders/certificates";
import type { PagedResult } from "@/lib/filters/pagination";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { EmptyState } from "@/ui/filters/empty-state";
import LocalTime from "@/ui/local-time";
import {
  issueCertificatesForExam,
  revokeCertificate,
  reinstateCertificate,
} from "@/app/actions/certificate-admin";

interface CertificatesClientProps {
  data: PagedResult<CertificateRow>;
  activeExamId?: string;
  activeExamTitle?: string;
}

export default function CertificatesClient({
  data,
  activeExamId,
  activeExamTitle,
}: CertificatesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Revocation modal state
  const [revokingCert, setRevokingCert] = useState<CertificateRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // Bulk issue summary modal state
  const [bulkSummary, setBulkSummary] = useState<{
    issued: number;
    skipped: number;
    failed: number;
    totalEligible: number;
  } | null>(null);

  const filterDefs: FilterDef[] = [
    {
      type: "search",
      param: "q",
      label: "Candidate / ID",
      placeholder: "Search by student name, PRN, or certificate ID...",
    },
    {
      type: "facet",
      param: "exam",
      label: "Exam",
      options: data.facets?.exam ?? [],
    },
    {
      type: "facet",
      param: "grade",
      label: "Grade",
      options: data.facets?.grade ?? [],
    },
    {
      type: "facet",
      param: "revoked",
      label: "Revocation",
      options: data.facets?.revoked ?? [],
      multi: false,
    },
    {
      type: "sort",
      param: "sort",
      label: "Sort by",
      sortOptions: [
        { value: "issueDate", label: "Issue Date" },
        { value: "score", label: "Score" },
        { value: "grade", label: "Grade" },
        { value: "name", label: "Student Name" },
      ],
    },
  ];

  /* ----------------------------------------------------------- Bulk Issue */
  const handleBulkIssue = async () => {
    if (!activeExamId) return;

    startTransition(async () => {
      try {
        const res = await issueCertificatesForExam(activeExamId);
        setBulkSummary(res);
        toast.success(`Issued ${res.issued} certificate(s)`);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to issue certificates");
      }
    });
  };

  /* ------------------------------------------------------- Revoke / Reinstate */
  const handleConfirmRevoke = async () => {
    if (!revokingCert || !revokeReason.trim()) return;

    startTransition(async () => {
      try {
        await revokeCertificate(revokingCert.certificateId, revokeReason);
        toast.success(`Certificate ${revokingCert.certificateId} revoked`);
        setRevokingCert(null);
        setRevokeReason("");
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to revoke certificate");
      }
    });
  };

  const handleReinstate = async (cert: CertificateRow) => {
    startTransition(async () => {
      try {
        await reinstateCertificate(cert.certificateId);
        toast.success(`Certificate ${cert.certificateId} reinstated`);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to reinstate certificate");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner if filtered by a specific Exam */}
      {activeExamId && (
        <div className="bg-indigo-50/70 border border-indigo-100 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-white border border-indigo-100 px-2.5 py-0.5 rounded-md">
              Filtered Exam Context
            </span>
            <h3 className="text-base font-black text-slate-800">
              {activeExamTitle || "Selected Examination"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              You are managing certificates specifically for this examination.
            </p>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={handleBulkIssue}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Bulk Issue Certificates
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40">
        <FilterBar defs={filterDefs} />
      </div>

      {/* Certificates Data Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
        {data.rows.length === 0 ? (
          <EmptyState
            title="No certificates found"
            description="No student certificates match your current filter parameters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 font-black text-slate-600 text-[11px] uppercase tracking-wider">
                  <th className="py-4 px-6">Certificate ID</th>
                  <th className="py-4 px-4">Student Candidate</th>
                  <th className="py-4 px-4">Examination</th>
                  <th className="py-4 px-4">Score & Grade</th>
                  <th className="py-4 px-4">Issued Date</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.rows.map((row) => {
                  const isRevoked = Boolean(row.revokedAt);

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isRevoked ? "bg-rose-50/20" : ""
                      }`}
                    >
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">
                        {row.certificateId}
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-black text-slate-800 text-sm">
                          {row.student.name || "Student"}
                        </p>
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          {row.student.prn && <span>PRN: {row.student.prn}</span>}
                          <span>{row.student.email}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4 max-w-[200px]">
                        <span className="truncate block font-bold text-slate-700">
                          {row.exam.title}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <span className="font-black text-slate-800">
                            {row.score !== null ? `${row.score} pts` : "—"}
                          </span>
                          {row.grade && (
                            <span className="text-[10px] font-bold block text-indigo-600">
                              {row.grade}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-500 font-medium">
                        <LocalTime dateString={row.issueDate} mode="date" />
                      </td>

                      <td className="py-4 px-4">
                        {isRevoked ? (
                          <span
                            title={row.revokedReason || "Revoked by instructor"}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
                          >
                            Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Valid
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/verify/${row.certificateId}`}
                            target="_blank"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Open public verification page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>

                          {isRevoked ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleReinstate(row)}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reinstate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRevokingCert(row);
                                setRevokeReason("");
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {/* Revocation Reason Modal */}
      {revokingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  Revoke Certificate
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {revokingCert.certificateId} • {revokingCert.student.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevokingCert(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Revocation Reason (Required)
              </label>
              <textarea
                rows={4}
                required
                maxLength={500}
                placeholder="e.g. Honor code violation discovered post-examination. Question tampering."
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl focus:border-rose-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 font-bold block text-right">
                {revokeReason.length}/500 chars
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRevokingCert(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || !revokeReason.trim()}
                onClick={handleConfirmRevoke}
                className="px-5 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Revocation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Issuance Summary Modal */}
      {bulkSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div>
              <h3 className="text-lg font-black text-slate-800">
                Bulk Issuance Summary
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Results for eligible passing candidates (≥ 40% score).
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-center">
                <p className="text-xl font-black text-emerald-700">{bulkSummary.issued}</p>
                <p className="text-[10px] font-bold text-emerald-600 uppercase">Newly Issued</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center">
                <p className="text-xl font-black text-slate-700">{bulkSummary.skipped}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Already Issued</p>
              </div>
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl text-center">
                <p className="text-xl font-black text-rose-700">{bulkSummary.failed}</p>
                <p className="text-[10px] font-bold text-rose-600 uppercase">Failed</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBulkSummary(null)}
                className="px-5 py-2 text-xs font-black bg-slate-900 hover:bg-black text-white rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
