import { useCallback, useEffect, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { api } from '../lib/api';
import {
  FALLBACK_PROMO_VIDEO,
  isDirectVideo,
  isYoutube,
  mimeFromUrl,
  normalizePromoVideos,
  resolvePromoVideoUrl,
  youtubeSlideshowEmbed,
} from '../lib/videoUtils';
import SoundOnVideo from './SoundOnVideo';

const RIDER_IMG = '/images/rider-hero.png';

/**
 * Homepage rider showcase — live admin promo (section "rider" or "roles") with CDN fallback.
 */
export default function HomeRiderVideo({ poster = RIDER_IMG, className = '' }) {
  const [video, setVideo] = useState(null);
  const [useFallback, setUseFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      for (const section of ['rider', 'roles']) {
        const list = normalizePromoVideos(await api.getPublicPromoVideos(section));
        if (list.length > 0) {
          setVideo(list[0]);
          setUseFallback(false);
          return;
        }
      }
      setVideo(null);
    } catch {
      setVideo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const src = useFallback || !video
    ? FALLBACK_PROMO_VIDEO
    : resolvePromoVideoUrl(video.video_url);

  const direct = !useFallback && video && isDirectVideo(video.video_url);
  const youtube = !useFallback && video && isYoutube(video.video_url);
  const embedUrl = youtube ? youtubeSlideshowEmbed(video.video_url, { muted: false }) : null;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-border shadow-2xl aspect-video bg-black ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface z-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {!loading && direct && (
        <SoundOnVideo
          key={src}
          src={src}
          type={mimeFromUrl(src)}
          poster={video.poster_url || poster}
          className="w-full h-full object-cover"
          overlayClassName="w-full h-full"
          onError={() => setUseFallback(true)}
        />
      )}

      {!loading && youtube && embedUrl && (
        <iframe
          title={video.title || 'Motor delivery'}
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      )}

      {!loading && (!direct && !youtube || useFallback) && (
        <SoundOnVideo
          src={FALLBACK_PROMO_VIDEO}
          type="video/mp4"
          poster={poster}
          className="w-full h-full object-cover"
          overlayClassName="w-full h-full"
        />
      )}

      <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-10 pointer-events-none">
        {video && !useFallback && (
          <span className="px-2.5 py-1 rounded-full bg-success/90 text-white text-[10px] font-bold uppercase tracking-wide">
            Live promo
          </span>
        )}
        {(useFallback || !video) && !loading && (
          <span className="px-2.5 py-1 rounded-full bg-surface/90 border border-border text-slate-300 text-[10px] font-medium">
            Showcase
          </span>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Truck className="w-4 h-4 shrink-0" />
          {video?.title && !useFallback ? video.title : 'Smart Box motor delivery'}
        </p>
        {video?.description && !useFallback && (
          <p className="text-xs text-slate-300 mt-1 line-clamp-2">{video.description}</p>
        )}
      </div>
    </div>
  );
}
