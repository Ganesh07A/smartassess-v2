"use client";

import { useState, useTransition } from "react";
import { releaseExamResults, unreleaseExamResults } from "@/app/actions/exam-admin";
import { Eye, EyeOff, AlertTriangle, Check, Loader2 } from "lucide-react";
import LocalTime from "@/ui/local-time";

interface ReleaseResultsButtonProps {
  examId: string;
  resultsReleasedAt: Date | string | null;
}

export function ReleaseResultsButton({
  examId,
  resultsReleasedAt,
}: ReleaseResultsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isReleased = Boolean(resultsReleasedAt);

  const handleInitialReleaseClick = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await releaseExamResults(examId, { force: false });
        if (res.requiresConfirmation) {
          setConfirmMessage(res.message || "Students are still active. Release anyway?");
          setShowConfirm(true);
        }
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const handleForcedRelease = () => {
    setError(null);
    startTransition(async () => {
      try {
        await releaseExamResults(examId, { force: true });
        setShowConfirm(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  const handleUnrelease = () => {
    if (!window.confirm("Are you sure you want to hide results from students again?")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await unreleaseExamResults(examId);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="relative inline-flex flex-col items-start gap-1">
      {isReleased ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Released <LocalTime dateString={resultsReleasedAt!} mode="date" className="ml-1" />
            </span>
          </span>
          <button
            type="button"
            onClick={handleUnrelease}
            disabled={isPending}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100 flex items-center gap-1 cursor-pointer"
            title="Hide results from students"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
            <span>Hide</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInitialReleaseClick}
          disabled={isPending}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          <span>Release Results</span>
        </button>
      )}

      {error && <p className="text-[11px] text-rose-600 font-semibold">{error}</p>}

      {/* Confirmation Modal for Active/Open Exam */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Confirm Results Release</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{confirmMessage}</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-[11px] text-amber-800 space-y-1">
              <p className="font-semibold">Notice regarding Academic Integrity:</p>
              <p>Releasing scores while an exam window is open will allow finished students to view their scores and answer explanations.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForcedRelease}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Release</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
