"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Code,
  ArrowUpDown,
  Trash2,
  Copy,
  Tag,
  Loader2,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { QuestionRow } from "@/lib/filters/builders/questions";
import type { PagedResult } from "@/lib/filters/pagination";
import { FilterBar } from "@/ui/filters/filter-bar";
import { Pagination } from "@/ui/filters/pagination";
import { ConfirmDialog } from "@/ui/filters/confirm-dialog";
import { EmptyState } from "@/ui/filters/empty-state";
import EditQuestionModal from "./edit-modal";
import DeleteQuestionButton from "./delete-button";
import {
  reorderExamQuestions,
  bulkDeleteExamQuestions,
  bulkDuplicateExamQuestions,
  bulkUpdateQuestionsTopicDifficulty,
} from "@/app/actions/exam-admin";
import type { Difficulty } from "@prisma/client";

interface QuestionBankClientProps {
  examId: string;
  data: PagedResult<QuestionRow>;
  totalPoints: number;
}

export default function QuestionBankClient({
  examId,
  data,
  totalPoints,
}: QuestionBankClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk edit topic/diff modal state
  const [isBulkTagOpen, setIsBulkTagOpen] = useState(false);
  const [bulkTopic, setBulkTopic] = useState("");
  const [bulkDifficulty, setBulkDifficulty] = useState<Difficulty | "">("");

  // Reorder state: working array of questions when in reorder mode
  const [isReordering, setIsReordering] = useState(false);
  const [orderedItems, setOrderedItems] = useState<QuestionRow[]>([]);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);

  const toggleReordering = () => {
    if (!isReordering) {
      setOrderedItems(data.rows);
      setHasOrderChanges(false);
      setIsReordering(true);
    } else {
      setIsReordering(false);
      setHasOrderChanges(false);
      setOrderedItems([]);
    }
  };

  const items = isReordering ? orderedItems : data.rows;

  const isAllSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.questionId));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.questionId));
    }
  };

  const toggleSelectItem = (questionId: string) => {
    setSelectedIds((prev) =>
      prev.includes(questionId)
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId],
    );
  };

  /* ------------------------------------------------------------- Reorder handlers */
  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) return;

    const copy = [...orderedItems];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    setOrderedItems(copy);
    setHasOrderChanges(true);
  };

  const handleSaveOrder = async () => {
    startTransition(async () => {
      try {
        const orderedIds = orderedItems.map((q) => q.questionId);
        await reorderExamQuestions(examId, orderedIds);
        toast.success("Question order saved successfully");
        setHasOrderChanges(false);
        setIsReordering(false);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to save question order");
      }
    });
  };

  /* -------------------------------------------------------- Bulk Action Handlers */
  const handleBulkDelete = async () => {
    startTransition(async () => {
      try {
        const res = await bulkDeleteExamQuestions(examId, selectedIds);
        toast.success(`Removed ${res.count} question(s)`);
        setSelectedIds([]);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to remove questions");
      }
    });
  };

  const handleBulkDuplicate = async () => {
    startTransition(async () => {
      try {
        const res = await bulkDuplicateExamQuestions(examId, selectedIds);
        toast.success(`Duplicated ${res.count} question(s)`);
        setSelectedIds([]);
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to duplicate questions");
      }
    });
  };

  const handleBulkUpdateTag = async () => {
    startTransition(async () => {
      try {
        const patch: { topic?: string; difficulty?: Difficulty } = {};
        if (bulkTopic.trim()) patch.topic = bulkTopic.trim();
        if (bulkDifficulty) patch.difficulty = bulkDifficulty as Difficulty;

        const res = await bulkUpdateQuestionsTopicDifficulty(examId, selectedIds, patch);
        toast.success(`Updated ${res.count} question(s)`);
        setIsBulkTagOpen(false);
        setSelectedIds([]);
        setBulkTopic("");
        setBulkDifficulty("");
        router.refresh();
      } catch (err: unknown) {
        toast.error((err as Error)?.message || "Failed to update questions");
      }
    });
  };

  const filterDefs = [
    {
      type: "search" as const,
      param: "q",
      label: "Question",
      placeholder: "Search question text or code...",
    },
    {
      type: "facet" as const,
      param: "type",
      label: "Type",
      options: data.facets?.type ?? [],
    },
    {
      type: "facet" as const,
      param: "difficulty",
      label: "Difficulty",
      options: data.facets?.difficulty ?? [],
    },
    {
      type: "facet" as const,
      param: "topic",
      label: "Topic",
      options: data.facets?.topic ?? [],
    },
    {
      type: "sort" as const,
      param: "sort",
      label: "Sort by",
      sortOptions: [
        { value: "order", label: "Question Order" },
        { value: "points", label: "Points" },
        { value: "difficulty", label: "Difficulty" },
        { value: "topic", label: "Topic" },
      ],
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/40 overflow-hidden">
      {/* Container Header */}
      <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
              Question Bank
              <span className="text-xs font-bold text-slate-400">({data.total})</span>
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              Filter, search, reorder, and bulk edit assessment items
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100/60 px-3.5 py-1.5 rounded-xl">
            Total: {totalPoints} Points
          </span>

          {!isReordering && items.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </button>
          )}

          <button
            type="button"
            onClick={toggleReordering}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isReordering
                ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {isReordering ? "Exit Reorder Mode" : "Reorder Questions"}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      {!isReordering && (
        <div className="p-6 border-b border-slate-100">
          <FilterBar defs={filterDefs} />
        </div>
      )}

      {/* Floating / Sticky Order Changes Banner */}
      {isReordering && hasOrderChanges && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
            Unsaved question order changes detected.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOrderedItems(data.rows);
                setHasOrderChanges(false);
              }}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-amber-100/60 rounded-xl"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveOrder}
              className="px-4 py-1.5 text-xs font-black bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm flex items-center gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Order
            </button>
          </div>
        </div>
      )}

      {/* Bulk Selection Action Strip */}
      {selectedIds.length > 0 && !isReordering && (
        <div className="bg-indigo-50/80 border-b border-indigo-100 px-6 py-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            {selectedIds.length} question(s) selected
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkTagOpen(true)}
              className="px-3 py-1.5 text-xs font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50/50 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              Set Topic / Difficulty
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={handleBulkDuplicate}
              className="px-3 py-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Duplicate
            </button>

            <ConfirmDialog
              title="Delete Selected Questions"
              description={`Are you sure you want to remove ${selectedIds.length} question(s) from this exam? This cannot be undone.`}
              confirmLabel="Delete Questions"
              variant="danger"
              onConfirm={handleBulkDelete}
              isLoading={isPending}
              trigger={
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              }
            />

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 ml-2"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Question Item Cards */}
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <EmptyState
            title="No questions found"
            description="No assessment items match your current filter criteria or search query."
          />
        ) : (
          items.map((eq, index) => {
            const isMCQ = eq.question.type === "MCQ";
            const isSelected = selectedIds.includes(eq.questionId);

            return (
              <div
                key={eq.id}
                className={`p-6 transition-all duration-200 flex items-start gap-4 group ${
                  isSelected ? "bg-indigo-50/30" : "hover:bg-slate-50/40"
                } border-l-4 ${isMCQ ? "border-l-indigo-500" : "border-l-teal-500"}`}
              >
                {/* Checkbox / Reorder handle */}
                {!isReordering ? (
                  <button
                    type="button"
                    onClick={() => toggleSelectItem(eq.questionId)}
                    className="mt-1 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4.5 h-4.5 text-indigo-600" />
                    ) : (
                      <Square className="w-4.5 h-4.5" />
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, "up")}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => moveItem(index, "down")}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Content & Metadata */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      #{isReordering ? index + 1 : eq.order}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        isMCQ
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100/40"
                          : "bg-teal-50 text-teal-700 border border-teal-100/40"
                      }`}
                    >
                      {isMCQ ? (
                        <BookOpen className="w-2.5 h-2.5 mr-1" />
                      ) : (
                        <Code className="w-2.5 h-2.5 mr-1" />
                      )}
                      {eq.question.type}
                    </span>

                    {/* Difficulty Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        eq.question.difficulty === "EASY"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50"
                          : eq.question.difficulty === "HARD"
                            ? "bg-rose-50 text-rose-700 border border-rose-100/50"
                            : "bg-amber-50 text-amber-700 border border-amber-100/50"
                      }`}
                    >
                      {eq.question.difficulty}
                    </span>

                    {/* Topic Badge */}
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                      {eq.question.topic || "Untagged"}
                    </span>
                  </div>

                  <p className="text-slate-800 font-bold text-sm leading-relaxed max-w-3xl whitespace-pre-wrap">
                    {eq.question.content}
                  </p>
                </div>

                {/* Actions & Points */}
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-xs font-black text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-lg">
                    {eq.points} pts
                  </span>

                  {!isReordering && (
                    <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex items-center space-x-1.5">
                      <EditQuestionModal
                        examId={examId}
                        question={{
                          id: eq.question.id,
                          type: eq.question.type,
                          content: eq.question.content,
                          options: eq.question.options as Record<string, string> | null,
                          correctAnswer: eq.question.correctAnswer,
                          testCases: eq.question.testCases as { input: string; output: string }[] | null,
                          points: eq.points,
                        }}
                      />
                      <DeleteQuestionButton examId={examId} questionId={eq.questionId} />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {!isReordering && data.totalPages > 1 && (
        <div className="p-6 border-t border-slate-100">
          <Pagination
            total={data.total}
            page={data.page}
            perPage={data.perPage}
            totalPages={data.totalPages}
          />
        </div>
      )}

      {/* Bulk Set Topic / Difficulty Dialog */}
      {isBulkTagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 w-full max-w-md space-y-5">
            <div>
              <h3 className="text-lg font-black text-slate-800">Set Topic & Difficulty</h3>
              <p className="text-xs text-slate-500 font-medium">
                Bulk assign curriculum metadata to {selectedIds.length} selected question(s).
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Topic</label>
                <input
                  type="text"
                  placeholder="e.g. Algorithms, Data Structures, SQL"
                  value={bulkTopic}
                  onChange={(e) => setBulkTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Difficulty</label>
                <select
                  value={bulkDifficulty}
                  onChange={(e) => setBulkDifficulty(e.target.value as Difficulty | "")}
                  className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white"
                >
                  <option value="">Leave unchanged</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkTagOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || (!bulkTopic && !bulkDifficulty)}
                onClick={handleBulkUpdateTag}
                className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Apply to {selectedIds.length} Item(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
