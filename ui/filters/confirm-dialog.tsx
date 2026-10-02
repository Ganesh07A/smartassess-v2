"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  /** Title of the confirmation dialog */
  title: string;
  /** Detailed description or consequence explanation */
  description: string;
  /** Label for the confirm button (e.g. "Delete", "Confirm") */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Tone of the confirm action */
  variant?: "danger" | "warning" | "primary";
  /** Trigger element that opens the dialog */
  trigger?: React.ReactNode;
  /** Controlled open state */
  open?: boolean;
  /** Controlled onOpenChange */
  onOpenChange?: (open: boolean) => void;
  /** Async or sync action to execute on confirmation */
  onConfirm: () => Promise<void> | void;
  /** Whether confirmation is in flight */
  isLoading?: boolean;
}

/**
 * Accessible modal confirmation dialog that replaces native window.confirm().
 * Supports both controlled and uncontrolled trigger modes.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  trigger,
  open: controlledOpen,
  onOpenChange,
  onConfirm,
  isLoading: externalLoading = false,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (isControlled) {
      onOpenChange?.(val);
    } else {
      setInternalOpen(val);
    }
  };

  const isLoading = externalLoading || internalLoading;

  const handleConfirm = async () => {
    try {
      setInternalLoading(true);
      await onConfirm();
      setOpen(false);
    } catch (err) {
      console.error("Confirmation error:", err);
    } finally {
      setInternalLoading(false);
    }
  };

  const variantStyles = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200",
    warning: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200",
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200",
  }[variant];

  return (
    <>
      {trigger && (
        <span onClick={() => setOpen(true)} className="inline-block cursor-pointer">
          {trigger}
        </span>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  variant === "danger"
                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                    : variant === "warning"
                      ? "bg-amber-50 text-amber-600 border border-amber-100"
                      : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{title}</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirm}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${variantStyles}`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
