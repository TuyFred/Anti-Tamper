import { Maximize2, Minimize2, Package, LocateFixed, Loader2 } from 'lucide-react';
import { MAP_LABELS } from '../../lib/mapConfig';

/** GPS (my location), show/follow box, fullscreen */
export default function MapFloatControls({
  onLocateMe,
  locating = false,
  hasUserLocation = false,
  followBox = false,
  onShowBox,
  hasBoxTrack = false,
  fullscreen = false,
  onToggleFullscreen,
  showFullscreen = true,
}) {
  return (
    <div className="live-map-float-controls">
      <button
        type="button"
        onClick={onLocateMe}
        disabled={locating}
        title={MAP_LABELS.useMyLocation}
        className={`live-map-float-btn ${hasUserLocation ? 'live-map-float-btn--active' : ''}`}
      >
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
      </button>
      {hasBoxTrack && onShowBox && (
        <button
          type="button"
          onClick={onShowBox}
          title={MAP_LABELS.showBoxOnMap}
          className={`live-map-float-btn ${followBox ? 'live-map-float-btn--active' : ''}`}
        >
          <Package className="w-4 h-4" />
        </button>
      )}
      {showFullscreen && onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? MAP_LABELS.exitFullscreen : MAP_LABELS.fullscreen}
          className="live-map-float-btn"
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
