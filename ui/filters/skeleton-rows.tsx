export interface SkeletonRowsProps {
  rows?: number;
  className?: string;
}

export function SkeletonRows({ rows = 5, className = "" }: SkeletonRowsProps) {
  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      className={`space-y-4 animate-pulse ${className}`}
    >
      {Array.from({ length: Math.min(rows, 10) }).map((_, idx) => (
        <div
          key={`skeleton-row-${idx}`}
          className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-2.5 flex-1">
            <div className="h-5 bg-slate-200 rounded-lg w-1/3" />
            <div className="h-3.5 bg-slate-100 rounded-md w-1/2" />
            <div className="flex gap-2 pt-2">
              <div className="h-6 bg-slate-100 rounded-lg w-20" />
              <div className="h-6 bg-slate-100 rounded-lg w-24" />
              <div className="h-6 bg-slate-100 rounded-lg w-16" />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="h-9 bg-slate-100 rounded-xl w-24" />
            <div className="h-9 bg-slate-200 rounded-xl w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
