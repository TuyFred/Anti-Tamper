import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatDateTimeFull, formatRelativeTime } from '../lib/datetime';

/**
 * Alert / notification timestamp — full date+time with optional live relative label.
 */
export default function AlertDateTime({
  iso,
  live = false,
  variant = 'default',
  className = '',
  showIcon = true,
  showTimezone = true,
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!live || !iso) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, [live, iso]);

  if (!iso) return null;

  const relative = live ? formatRelativeTime(iso) : null;
  const full = formatDateTimeFull(iso);
  const tz = showTimezone ? ' (Rwanda time)' : '';

  if (variant === 'toast') {
    return (
      <div className={`alert-datetime alert-datetime--toast ${className}`}>
        {showIcon && <Clock className="w-3.5 h-3.5 shrink-0 text-cyan-400" aria-hidden />}
        <div className="min-w-0">
          {relative && (
            <p className="alert-datetime__live">{relative}</p>
          )}
          <p className="alert-datetime__full">
            {full}{tz}
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <time dateTime={iso} className={`alert-datetime alert-datetime--compact ${className}`}>
        {showIcon && <Clock className="w-3 h-3 shrink-0" aria-hidden />}
        <span>
          {relative && <span className="alert-datetime__live">{relative} · </span>}
          <span className="alert-datetime__full">{full}</span>
        </span>
      </time>
    );
  }

  return (
    <time dateTime={iso} className={`alert-datetime ${className}`}>
      {showIcon && <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />}
      <div className="min-w-0">
        {relative && (
          <span className="alert-datetime__live">{relative}</span>
        )}
        <span className="alert-datetime__full">
          {full}{tz}
        </span>
      </div>
    </time>
  );
}
