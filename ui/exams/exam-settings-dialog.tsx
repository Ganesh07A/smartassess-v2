"use client";

import { useState, useTransition } from "react";
import { updateExamSettings } from "@/app/actions/exam-admin";
import { Settings, Lock, Loader2, X, CheckCircle } from "lucide-react";
import type { AnswerRevealPolicy } from "@prisma/client";

interface ExamSettingsDialogProps {
  exam: {
    id: string;
    title: string;
    description: string | null;
    startTime: Date | string;
    endTime: Date | string;
    duration: number;
    allowRunCode: boolean;
    shuffleOptions: boolean;
    negativeMarking: number;
    answerReveal: AnswerRevealPolicy;
    proctoring?: unknown;
  };
  hasStartedSessions?: boolean;
}

export function ExamSettingsDialog({
  exam,
  hasStartedSessions = false,
}: ExamSettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [title, setTitle] = useState(exam.title);
  const [description, setDescription] = useState(exam.description ?? "");
  const [startTime, setStartTime] = useState(
    new Date(exam.startTime).toISOString().slice(0, 16),
  );
  const [endTime, setEndTime] = useState(
    new Date(exam.endTime).toISOString().slice(0, 16),
  );
  const [duration, setDuration] = useState(exam.duration);
  const [allowRunCode, setAllowRunCode] = useState(exam.allowRunCode);
  const [shuffleOptions, setShuffleOptions] = useState(exam.shuffleOptions);
  const [negativeMarking, setNegativeMarking] = useState(exam.negativeMarking);
  const [answerReveal, setAnswerReveal] = useState<AnswerRevealPolicy>(exam.answerReveal);

  const proctoringObj = (exam.proctoring ?? {}) as {
    maxTabSwitches?: number;
    blockClipboard?: boolean;
    requireFullscreen?: boolean;
  };

  const [maxTabSwitches, setMaxTabSwitches] = useState(
    proctoringObj.maxTabSwitches ?? 3,
  );
  const [blockClipboard, setBlockClipboard] = useState(
    Boolean(proctoringObj.blockClipboard),
  );
  const [requireFullscreen, setRequireFullscreen] = useState(
    Boolean(proctoringObj.requireFullscreen),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await updateExamSettings(exam.id, {
          title,
          description: description || null,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          duration: Number(duration),
          allowRunCode,
          shuffleOptions,
          negativeMarking: Number(negativeMarking),
          answerReveal,
          proctoring: {
            maxTabSwitches: Number(maxTabSwitches),
            blockClipboard,
            requireFullscreen,
          },
        });

        if (!res.success) {
          setError(res.error || "Failed to update exam settings.");
          return;
        }

        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 1200);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors cursor-pointer"
      >
        <Settings className="w-3.5 h-3.5 text-slate-500" />
        <span>Settings</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 md:p-8 space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Exam Settings</h3>
                  <p className="text-xs text-slate-500">Configure scheduling, scoring, and proctoring rules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {hasStartedSessions && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Window & Scoring Rules Locked:</span> Students have already started taking this exam. Time windows, duration, negative marking, and answer reveal policies cannot be altered.
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Settings updated successfully!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title & Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Window & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Start Time</span>
                    {hasStartedSessions && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <input
                    type="datetime-local"
                    disabled={hasStartedSessions}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>End Time</span>
                    {hasStartedSessions && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <input
                    type="datetime-local"
                    disabled={hasStartedSessions}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Duration (mins)</span>
                    {hasStartedSessions && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    disabled={hasStartedSessions}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Answer Reveal Policy */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <span>Answer Reveal Policy</span>
                  {hasStartedSessions && <Lock className="w-3 h-3 text-amber-500" />}
                </label>
                <select
                  disabled={hasStartedSessions}
                  value={answerReveal}
                  onChange={(e) => setAnswerReveal(e.target.value as AnswerRevealPolicy)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="AFTER_RELEASE">After Teacher Releases Results (Recommended)</option>
                  <option value="AFTER_EXAM_END">After Exam Window Ends</option>
                  <option value="IMMEDIATELY">Immediately on Student Submission</option>
                  <option value="NEVER">Never Reveal Correct Answers</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Controls when students can view correct answers and explanations on their score report.
                </p>
              </div>

              {/* Scoring & Code Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <span>Negative Marking</span>
                    {hasStartedSessions && <Lock className="w-3 h-3 text-amber-500" />}
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    max={10}
                    disabled={hasStartedSessions}
                    value={negativeMarking}
                    onChange={(e) => setNegativeMarking(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Max Tab Switches</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxTabSwitches}
                    onChange={(e) => setMaxTabSwitches(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Checkbox Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRunCode}
                    onChange={(e) => setAllowRunCode(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Allow running custom test cases in coding IDE</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={hasStartedSessions}
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 disabled:opacity-50"
                  />
                  <span>Shuffle MCQ options per student</span>
                  {hasStartedSessions && <Lock className="w-3 h-3 text-amber-500" />}
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockClipboard}
                    onChange={(e) => setBlockClipboard(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Block copy, cut and paste in exam portal</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireFullscreen}
                    onChange={(e) => setRequireFullscreen(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <span>Enforce full-screen mode with violation tracking</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
