import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Megaphone, Volume2, VolumeX } from 'lucide-react';
import { api } from '../lib/api';
import {
  isDirectVideo, isYoutube, mimeFromUrl, youtubeSlideshowEmbed,
  FALLBACK_PROMO_VIDEO, normalizePromoVideos, resolvePromoVideoUrl,
} from '../lib/videoUtils';
import SoundOnVideo from './SoundOnVideo';

const POLL_MS = 8000;
const YOUTUBE_SLIDE_MS = 12000;
const FALLBACK_SLIDE_MS = 18000;
const FALLBACK_VIDEO = FALLBACK_PROMO_VIDEO;

export default function PromoVideoSlideshow() {
  const videoRef = useRef(null);
  const slideTimerRef = useRef(null);
  const advancingRef = useRef(false);
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const [userMuted, setUserMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [fade, setFade] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  const loadSlides = useCallback(async () => {
    try {
      const list = normalizePromoVideos(await api.getPublicPromoVideos('roles'));
      setSlides(list);
      setUseFallback(false);
      setIndex((i) => (list.length ? Math.min(i, list.length - 1) : 0));
    } catch {
      setSlides([]);
      setUseFallback(true);
    }
  }, []);

  useEffect(() => {
    loadSlides();
    const id = setInterval(loadSlides, POLL_MS);
    return () => clearInterval(id);
  }, [loadSlides]);

  const live = slides.length > 0 && !useFallback;
  const current = slides[index];
  const multi = slides.length > 1;

  const clearSlideTimer = () => {
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  };

  const advanceSlide = useCallback(() => {
    if (!multi || advancingRef.current) return;
    advancingRef.current = true;
    clearSlideTimer();
    setFade(false);
    window.setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
      setFade(true);
      window.setTimeout(() => {
        advancingRef.current = false;
      }, 250);
    }, 200);
  }, [multi, slides.length]);

  const goTo = useCallback((targetIndex) => {
    if (!slides.length || advancingRef.current) return;
    advancingRef.current = true;
    clearSlideTimer();
    setFade(false);
    window.setTimeout(() => {
      setIndex(((targetIndex % slides.length) + slides.length) % slides.length);
      setFade(true);
      window.setTimeout(() => {
        advancingRef.current = false;
      }, 250);
    }, 200);
  }, [slides.length]);

  const goNext = useCallback(() => {
    if (!slides.length) return;
    goTo(index + 1);
  }, [goTo, index, slides.length]);

  const goPrev = useCallback(() => {
    if (!slides.length) return;
    goTo(index - 1);
  }, [goTo, index, slides.length]);

  const playCurrentVideo = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = userMuted;
    v.volume = userMuted ? 0 : 1;
    try {
      await v.play();
      setSoundBlocked(false);
    } catch {
      if (!userMuted) {
        v.muted = true;
        setSoundBlocked(true);
        await v.play().catch(() => {});
      }
    }
  }, [userMuted]);

  // Auto-advance timer for YouTube / unknown formats (multi only)
  useEffect(() => {
    clearSlideTimer();
    if (!live || !multi || !current) return undefined;

    const url = current.video_url;
    if (isYoutube(url) || !isDirectVideo(url)) {
      slideTimerRef.current = setTimeout(advanceSlide, YOUTUBE_SLIDE_MS);
    }
    return clearSlideTimer;
  }, [live, multi, current, index, advanceSlide]);

  // Direct video: play with sound + advance on end
  useEffect(() => {
    clearSlideTimer();
    const v = videoRef.current;
    if (!live || !current || !isDirectVideo(current.video_url) || !v) return undefined;

    const onEnded = () => advanceSlide();
    const onLoadedMeta = () => {
      if (!multi) return;
      const sec = v.duration && Number.isFinite(v.duration) ? v.duration : FALLBACK_SLIDE_MS / 1000;
      clearSlideTimer();
      slideTimerRef.current = setTimeout(advanceSlide, sec * 1000 + 400);
    };

    v.addEventListener('ended', onEnded);
    v.addEventListener('loadedmetadata', onLoadedMeta);
    playCurrentVideo();

    if (v.readyState >= 1) onLoadedMeta();

    return () => {
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      clearSlideTimer();
    };
  }, [live, multi, current, index, advanceSlide, playCurrentVideo]);

  // Keep mute state in sync when user toggles
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.muted = userMuted;
      v.volume = userMuted ? 0 : 1;
    }
  }, [userMuted, current?.id]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') playCurrentVideo();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [playCurrentVideo]);

  const toggleMute = () => {
    setUserMuted((m) => {
      const next = !m;
      const v = videoRef.current;
      if (v) {
        v.muted = next;
        v.volume = next ? 0 : 1;
        if (!next) v.play().catch(() => {});
      }
      if (!next) setSoundBlocked(false);
      return next;
    });
  };

  const tryEnableSound = () => {
    if (userMuted) return;
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      v.volume = 1;
      v.play().then(() => setSoundBlocked(false)).catch(() => {});
    }
  };

  const direct = current && isDirectVideo(current.video_url);
  const youtube = current && isYoutube(current.video_url);
  const embedUrl = youtube ? youtubeSlideshowEmbed(current.video_url, { muted: userMuted }) : null;
  const videoSrc = current ? resolvePromoVideoUrl(current.video_url) : FALLBACK_VIDEO;

  const handleVideoError = () => {
    if (slides.length <= 1) {
      setUseFallback(true);
      return;
    }
    advanceSlide();
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden shadow-xl shadow-primary/5 ring-1 ring-primary/10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-light/60">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary/30 to-accent/20 text-primary-light shrink-0 border border-primary/20">
            <Megaphone className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary-light">Special advertisement</p>
            {live && current?.title ? (
              <p className="text-sm font-semibold text-white truncate">{current.title}</p>
            ) : (
              <p className="text-xs text-slate-500">Smart Box Delivery showcase</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {live && multi && (
            <span className="hidden sm:inline text-[10px] text-slate-500 font-medium">Auto slideshow</span>
          )}
          {live && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 text-success text-[11px] font-semibold border border-success/25">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
          )}
          <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-lg border transition ${
                userMuted || soundBlocked
                  ? 'bg-surface-lighter border-border text-slate-400 hover:text-white'
                  : 'bg-primary/15 border-primary/30 text-primary-light'
              }`}
              aria-label={userMuted ? 'Unmute video' : 'Mute video'}
              title={userMuted ? 'Turn sound on' : 'Turn sound off'}
            >
              {userMuted || soundBlocked ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
        </div>
      </div>

      <div
        className="relative h-[200px] sm:h-[240px] md:h-[280px] bg-surface"
        onClick={soundBlocked && direct ? tryEnableSound : undefined}
      >
        {!live && (
          <>
            <SoundOnVideo
              src={FALLBACK_VIDEO}
              type="video/mp4"
              className="absolute inset-0 w-full h-full object-cover opacity-70"
              overlayClassName="absolute inset-0"
              showMuteButton={false}
              muted={userMuted}
              onMutedChange={setUserMuted}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/30 pointer-events-none" />
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface/90 border border-border text-slate-400 text-[10px] font-medium z-10">
              Smart Box showcase
            </div>
          </>
        )}

        {live && (
          <div className={`absolute inset-0 transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
            {direct && (
              <video
                ref={videoRef}
                key={current.id}
                autoPlay
                loop={!multi}
                playsInline
                muted={userMuted}
                poster={current.poster_url || undefined}
                className="absolute inset-0 w-full h-full object-cover"
                onError={handleVideoError}
              >
                <source src={videoSrc} type={mimeFromUrl(videoSrc)} />
              </video>
            )}
            {youtube && embedUrl && (
              <iframe
                title={current.title}
                key={`${current.id}-${userMuted}`}
                src={embedUrl}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay; encrypted-media"
              />
            )}
            {!direct && !youtube && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                Unsupported video format
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent pointer-events-none" />
          </div>
        )}

        {soundBlocked && direct && !userMuted && live && (
          <div className="absolute bottom-12 left-3 right-3 z-10 pointer-events-none">
            <p className="text-[11px] text-white/90 bg-black/50 backdrop-blur px-3 py-1.5 rounded-lg text-center">
              Tap video or speaker icon to enable sound
            </p>
          </div>
        )}

        {live && multi && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface/90 border border-border text-slate-300 shadow-lg flex items-center justify-center hover:text-white hover:border-primary/40 transition z-10"
              aria-label="Previous ad"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface/90 border border-border text-slate-300 shadow-lg flex items-center justify-center hover:text-white hover:border-primary/40 transition z-10"
              aria-label="Next ad"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {live && multi && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-primary-light' : 'w-1.5 bg-slate-500 hover:bg-slate-300'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {live && (
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-surface/80 border border-border text-slate-300 text-[10px] font-medium z-10">
            {index + 1} / {slides.length}
          </div>
        )}
      </div>

      {live && current?.description && (
        <p className="px-4 py-2.5 text-xs text-slate-400 bg-surface-light/50 border-t border-border line-clamp-2">
          {current.description}
        </p>
      )}
    </div>
  );
}
