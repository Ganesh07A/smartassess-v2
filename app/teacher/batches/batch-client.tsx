"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Trash2, Loader2, BookOpen } from "lucide-react";
import { createBatch, deleteBatch } from "@/app/actions/batch";
import type { BatchListRow } from "@/lib/filters/builders/batches";
import type { PagedResult } from "@/lib/filters/pagination";
import { FilterBar, type FilterDef } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { ConfirmDialog } from "@/ui/filters/confirm-dialog";
import { EmptyState } from "@/ui/filters/empty-state";
import LocalTime from "@/ui/local-time";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function BatchClient({ data }: { data: PagedResult<BatchListRow> }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filterDefs: FilterDef[] = [
    {
      type: "search",
      param: "q",
      label: "Batch",
      placeholder: "Search batch name or department...",
    },
    {
      type: "facet",
      param: "department",
      label: "Department",
      options: data.facets?.department ?? [],
    },
    {
      type: "facet",
      param: "year",
      label: "Year",
      options: data.facets?.year ?? [],
    },
    {
      type: "date-range",
      param: "date",
      label: "Created",
    },
    {
      type: "sort",
      param: "sort",
      label: "Sort by",
      sortOptions: [
        { value: "createdAt", label: "Recently Created" },
        { value: "name", label: "Batch Name" },
        { value: "students", label: "Student Count" },
        { value: "exams", label: "Exam Count" },
      ],
    },
  ];

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    setSubmitting(true);
    try {
      await createBatch(newBatchName);
      setNewBatchName("");
      setIsModalOpen(false);
      toast.success("Batch created successfully");
      router.refresh();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to create batch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteBatch(id);
      toast.success("Batch deleted");
      router.refresh();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || "Failed to delete batch");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Batches
          </h2>
          <p className="text-xs md:text-sm font-medium text-slate-500">
            Manage your student cohorts, enrollments, and batch assignments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Batch
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40">
        <FilterBar defs={filterDefs} />
      </div>

      {/* Batches Grid */}
      {data.rows.length === 0 ? (
        <EmptyState
          title="No batches found"
          description="Try adjusting your search criteria, department, or date range."
          action={
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
            >
              Create Batch
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.rows.map((batch) => (
            <div
              key={batch.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/30 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-indigo-100 transition-all duration-200 relative group flex flex-col justify-between"
            >
              <Link
                href={`/teacher/batches/${batch.id}`}
                className="absolute inset-0 z-0"
                aria-label={`View ${batch.name} details`}
              />

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded-md">
                      {batch.department || "General"}
                    </span>
                    <h3 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug">
                      {batch.name}
                    </h3>
                  </div>

                  <ConfirmDialog
                    title="Delete Batch"
                    description={`Are you sure you want to delete "${batch.name}"? All student enrollments and associations will be removed. This cannot be undone.`}
                    confirmLabel="Delete Batch"
                    variant="danger"
                    isLoading={deletingId === batch.id}
                    onConfirm={() => handleDeleteBatch(batch.id)}
                    trigger={
                      <button
                        type="button"
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl p-1.5 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    }
                  />
                </div>

                <div className="text-[11px] font-medium text-slate-400">
                  Created: <LocalTime dateString={batch.createdAt} mode="date" />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-4 mt-4 border-t border-slate-100 text-xs font-bold text-slate-500 relative z-10 pointer-events-none">
                <div className="flex items-center bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                  {batch._count.students} Students
                </div>
                <div className="flex items-center bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                  {batch._count.exams} Exams
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {data.totalPages > 1 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <Pagination
            total={data.total}
            page={data.page}
            perPage={data.perPage}
            totalPages={data.totalPages}
          />
        </div>
      )}

      {/* Create Batch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div>
              <h3 className="text-xl font-black text-slate-800">Create New Batch</h3>
              <p className="text-xs text-slate-500 font-medium">
                Enter cohort details (e.g. FY CSE A, TY AIML B).
              </p>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Batch Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g. TY AIML A"
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newBatchName.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {submitting ? "Creating..." : "Create Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
