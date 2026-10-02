import React from "react";
import { SearchX } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description = "No results matched your search or active filters. Try adjusting your parameters.",
  action,
  icon,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto my-8 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
        {icon || <SearchX className="w-7 h-7" />}
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-1.5">{title}</h3>
      {description && <p className="text-xs text-slate-500 max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
