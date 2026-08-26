import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  total = 0,
  rangeStart = 0,
  rangeEnd = 0,
  hasPrev,
  hasNext,
  className = '',
}) {
  if (totalPages <= 1) return null;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 ${className}`}>
      <p className="text-xs text-slate-500 tabular-nums">
        {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-slate-400 hover:text-white hover:bg-surface-lighter disabled:opacity-40 disabled:pointer-events-none transition"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[4.5rem] text-center text-xs font-medium text-slate-400 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-slate-400 hover:text-white hover:bg-surface-lighter disabled:opacity-40 disabled:pointer-events-none transition"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
