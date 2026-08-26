/** Inline loader — keeps layout shell visible (fast sidebar navigation) */
export default function ContentSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="glass-card rounded-xl h-24 border border-border/60 bg-surface/40" />
      ))}
    </div>
  );
}
