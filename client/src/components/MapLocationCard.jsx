import { MapPin, Loader2, ExternalLink, Clock, Radio, Navigation } from 'lucide-react';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { googleMapsDirectionsUrl, MAP_LABELS } from '../lib/mapConfig';
import { formatLiveLocationSummary, isInRwanda } from '../lib/geocode';

function formatLastSeen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

function formatRelativeUpdate(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 15000) return 'Updated just now';
  if (diff < 60000) return `Updated ${Math.floor(diff / 1000)} seconds ago`;
  if (diff < 3600000) return `Updated ${Math.floor(diff / 60000)} minutes ago`;
  return formatLastSeen(iso);
}

/**
 * Professional location readout — Rwanda-friendly English address, coordinates, live status.
 */
export default function MapLocationCard({
  lat,
  lng,
  title,
  subtitle,
  lastUpdated,
  online,
  live = false,
  compact = false,
  showMapsLink = true,
  theme = 'dark',
  className = '',
}) {
  const { placeName, loading } = useReverseGeocode(lat, lng);
  const light = theme === 'light';
  const inRwanda = isInRwanda(lat, lng);
  const locationLine = formatLiveLocationSummary(placeName, lat, lng);

  if (lat == null || lng == null) return null;

  const lastSeen = formatLastSeen(lastUpdated);
  const relativeUpdate = formatRelativeUpdate(lastUpdated);
  const mapsUrl = googleMapsDirectionsUrl(lat, lng);

  const textMain = light ? 'text-slate-900' : 'text-white';
  const textMuted = light ? 'text-slate-600' : 'text-slate-400';
  const textSub = light ? 'text-slate-700' : 'text-slate-200';
  const border = light ? 'border-slate-200' : 'border-border';
  const bg = light ? 'bg-white' : 'bg-surface/95';

  if (compact) {
    return (
      <div className={`min-w-0 ${className}`}>
        {loading && !placeName ? (
          <p className={`text-[11px] ${textMuted} flex items-center gap-1.5`}>
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            {MAP_LABELS.resolvingLocation}
          </p>
        ) : (
          <p className={`text-xs ${textSub} leading-snug line-clamp-2`}>{locationLine}</p>
        )}
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] ${textMuted}`}>
          {inRwanda && (
            <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
              <Navigation className="w-3 h-3" />
              {MAP_LABELS.locatedInRwanda}
            </span>
          )}
          <span className="font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          {(relativeUpdate || lastSeen) && (
            <span className="opacity-80">· {relativeUpdate || lastSeen}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${border} ${bg} backdrop-blur-sm p-3.5 space-y-2.5 min-w-[240px] shadow-lg ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
            live
              ? 'bg-emerald-500/15 border border-emerald-500/30'
              : light ? 'bg-blue-50 border border-blue-100' : 'bg-primary/15 border border-primary/25'
          }`}>
            <MapPin className={`w-4 h-4 ${live ? 'text-emerald-400' : light ? 'text-blue-600' : 'text-primary-light'}`} />
          </div>
          <div className="min-w-0">
            {title && <p className={`text-sm font-semibold ${textMain} truncate`}>{title}</p>}
            {loading && !placeName ? (
              <p className={`text-xs ${textMuted} flex items-center gap-1.5 mt-1`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {MAP_LABELS.resolvingLocation}
              </p>
            ) : (
              <p className={`text-xs ${textSub} leading-relaxed mt-1 break-words`}>
                {locationLine}
              </p>
            )}
            {subtitle && <p className={`text-[11px] ${textMuted} mt-1 break-words`}>{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {live && online && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {MAP_LABELS.live}
            </span>
          )}
          {online != null && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              online
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : light ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-surface-lighter text-slate-500 border-border'
            }`}>
              <Radio className={`w-3 h-3 ${online ? 'animate-pulse' : ''}`} />
              {online ? MAP_LABELS.online : MAP_LABELS.offline}
            </span>
          )}
        </div>
      </div>

      {inRwanda && (
        <p className={`text-[11px] font-medium flex items-center gap-1.5 ${light ? 'text-emerald-700' : 'text-emerald-400/90'}`}>
          <Navigation className="w-3.5 h-3.5 shrink-0" />
          {MAP_LABELS.locatedInRwanda}
        </p>
      )}

      <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t ${light ? 'border-slate-100' : 'border-border/60'}`}>
        <p className={`text-[10px] font-mono ${textMuted}`}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
        {(relativeUpdate || lastSeen) && (
          <p className={`text-[10px] ${textMuted} flex items-center gap-1`}>
            <Clock className="w-3 h-3 shrink-0" />
            {relativeUpdate || lastSeen}
          </p>
        )}
      </div>

      {showMapsLink && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${
            light ? 'text-blue-600 hover:text-blue-800' : 'text-primary-light hover:text-white'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {MAP_LABELS.openDirections}
        </a>
      )}
    </div>
  );
}
