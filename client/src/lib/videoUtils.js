export function youtubeEmbedUrl(url, { muted = false } = {}) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) id = u.searchParams.get('v') || u.pathname.split('/').pop();
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${id}&controls=0&rel=0&modestbranding=1&playsinline=1`;
  } catch {
    return null;
  }
}

export function isDirectVideo(url) {
  if (!url) return false;
  if (url.includes('/uploads/promo-videos/')) return true;
  return /\.(mp4|webm|ogg|ogv|mov|avi|mkv|m4v|wmv|flv|3gp|3g2|mpg|mpeg)(\?|$)/i.test(url)
    || url.includes('mixkit.co/videos');
}

export function mimeFromUrl(url) {
  if (!url) return 'video/mp4';
  const ext = url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const map = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/x-m4v',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
  };
  return map[ext] || 'video/mp4';
}

export function isYoutube(url) {
  return /youtube\.com|youtu\.be/i.test(url || '');
}

export function youtubeSlideshowEmbed(url, { muted = false } = {}) {
  const base = youtubeEmbedUrl(url, { muted });
  if (!base) return null;
  return base
    .replace('loop=1', 'loop=0')
    .replace(/&playlist=[^&]+/, '');
}
