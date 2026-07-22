import { isDirectVideo, isYoutube, mimeFromUrl } from '../lib/videoUtils';

function youtubeAdminEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1).split('/')[0];
    else if (u.hostname.includes('youtube.com')) {
      id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop();
    }
    if (!id || id === 'embed') return null;
    return `https://www.youtube.com/embed/${id}?controls=1&rel=0&modestbranding=1&playsinline=1`;
  } catch {
    return null;
  }
}

export default function PromoVideoPreview({
  url,
  poster,
  blobUrl,
  mimeType,
  className = '',
  compact = false,
}) {
  const src = blobUrl || url;
  if (!src) {
    return (
      <div className={`bg-surface-lighter flex items-center justify-center ${className}`}>
        <p className="text-xs text-slate-500">No preview</p>
      </div>
    );
  }

  const direct = blobUrl || isDirectVideo(url);
  const youtube = !blobUrl && isYoutube(url);
  const embed = youtube ? youtubeAdminEmbed(url) : null;

  const heightClass = compact ? 'aspect-video max-h-40' : 'aspect-video';

  if (direct) {
    const mime = mimeType || mimeFromUrl(url || src);
    return (
      <div className={`relative overflow-hidden bg-black ${heightClass} ${className}`}>
        <video
          key={src}
          controls
          playsInline
          preload="metadata"
          poster={poster || undefined}
          className="w-full h-full object-contain bg-black"
        >
          <source src={src} type={mime} />
          Your browser does not support this video format.
        </video>
      </div>
    );
  }

  if (youtube && embed) {
    return (
      <div className={`relative overflow-hidden bg-black ${heightClass} ${className}`}>
        <iframe
          title="Video preview"
          src={embed}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={`bg-surface-lighter flex flex-col items-center justify-center gap-2 p-4 ${heightClass} ${className}`}>
      <p className="text-xs text-slate-400 text-center">Preview unavailable for this URL type</p>
      <p className="text-[10px] text-slate-600 font-mono truncate max-w-full px-2">{url}</p>
    </div>
  );
}
