import { MapPin, Loader2, ExternalLink, Clock, Radio } from 'lucide-react';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { googleMapsDirectionsUrl, MAP_LABELS } from '../lib/mapConfig';

function formatLastSeen(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return null;
  }
}

/**
 * Professional location readout — address, coordinates, status, maps link.
 */
export default function MapLocationCard({
  lat,
  lng,
  title,
  subtitle,
  lastUpdated,
  online,
  compact = false,
  showMapsLink = true,
  theme = 'dark',
  className = '',
}) {
  const { placeName, loading } = useReverseGeocode(lat, lng);
  const light = theme === 'light';

  if (lat == null || lng == null) return null;

  const lastSeen = formatLastSeen(lastUpdated);
  const mapsUrl = googleMapsDirectionsUrl(lat, lng);

  const textMain = light ? 'text-slate-900' : 'text-white';
  const textMuted = light ? 'text-slate-600' : 'text-slate-500';
  const textSub = light ? 'text-slate-700' : 'text-slate-300';
  const border = light ? 'border-slate-200' : 'border-border';
  const bg = light ? 'bg-white' : 'bg-surface/90';

  if (compact) {
    return (
      <div className={`min-w-0 ${className}`}>
        {loading && !placeName ? (
          <p className={`text-[11px] ${textMuted} flex items-center gap-1`}>
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            {MAP_LABELS.resolvingLocation}
          </p>
        ) : (
          placeName && <p className={`text-xs ${textMain} truncate`}>{placeName}</p>
        )}
        <p className={`text-[11px] ${textMuted} font-mono truncate`}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
          {lastSeen && <span className="opacity-70 ml-1.5">· {lastSeen}</span>}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${border} ${bg} p-3 space-y-2 min-w-[220px] ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
            light ? 'bg-blue-50 border border-blue-100' : 'bg-primary/15 border border-primary/25'
          }`}>
            <MapPin className={`w-4 h-4 ${light ? 'text-blue-600' : 'text-primary-light'}`} />
          </div>
          <div className="min-w-0">
            {title && <p className={`text-xs font-semibold ${textMain} truncate`}>{title}</p>}
            {loading && !placeName ? (
              <p className={`text-[11px] ${textMuted} flex items-center gap-1 mt-0.5`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                {MAP_LABELS.resolvingLocation}
              </p>
            ) : (
              <p className={`text-[11px] ${textSub} leading-snug mt-0.5 break-words`}>
                {placeName || MAP_LABELS.selectedLocation}
              </p>
            )}
            {subtitle && <p className={`text-[10px] ${textMuted} mt-1 break-words`}>{subtitle}</p>}
          </div>
        </div>
        {online != null && (
          <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            online
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : light ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-surface-lighter text-slate-500 border-border'
          }`}>
            <Radio className={`w-3 h-3 ${online ? 'animate-pulse' : ''}`} />
            {online ? MAP_LABELS.online : MAP_LABELS.offline}
          </span>
        )}
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-2 pt-1 border-t ${light ? 'border-slate-100' : 'border-border/60'}`}>
        <p className={`text-[10px] font-mono ${textMuted}`}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
        {lastSeen && (
          <p className={`text-[10px] ${textMuted} flex items-center gap-1`}>
            <Clock className="w-3 h-3" />
            {lastSeen}
          </p>
        )}
      </div>

      {showMapsLink && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium transition ${
            light ? 'text-blue-600 hover:text-blue-800' : 'text-primary-light hover:text-white'
          }`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {MAP_LABELS.openInMaps}
        </a>
      )}
    </div>
  );
}
