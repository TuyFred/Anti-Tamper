import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

/**
 * Autoplay video with sound ON by default. User can mute/unmute via the overlay button.
 * If the browser blocks autoplay with sound, playback starts muted until the user taps unmute or the video.
 */
export default function SoundOnVideo({
  src,
  type = 'video/mp4',
  poster,
  className = 'w-full h-full object-cover',
  loop = true,
  autoPlay = true,
  overlayClassName = '',
  showMuteButton = true,
  muted: controlledMuted,
  onMutedChange,
  muteButtonClassName = 'absolute top-3 right-3 z-10 p-2.5 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/80 transition',
  onError,
}) {
  const videoRef = useRef(null);
  const [internalMuted, setInternalMuted] = useState(false);
  const userMuted = controlledMuted !== undefined ? controlledMuted : internalMuted;
  const setUserMuted = onMutedChange || setInternalMuted;
  const [soundBlocked, setSoundBlocked] = useState(false);

  const applySound = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = userMuted;
    v.volume = userMuted ? 0 : 1;
    if (!autoPlay) return;
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
  }, [userMuted, autoPlay]);

  useEffect(() => {
    applySound();
  }, [src, applySound]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') applySound();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [applySound]);

  const toggleMute = () => {
    const next = !userMuted;
    const v = videoRef.current;
    if (v) {
      v.muted = next;
      v.volume = next ? 0 : 1;
      if (!next) v.play().catch(() => {});
    }
    if (!next) setSoundBlocked(false);
    if (onMutedChange) onMutedChange(next);
    else setInternalMuted(next);
  };

  const tryEnableSound = () => {
    if (userMuted) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.play().then(() => setSoundBlocked(false)).catch(() => {});
  };

  return (
    <div className={`relative ${overlayClassName}`} onClick={soundBlocked ? tryEnableSound : undefined}>
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        loop={loop}
        playsInline
        muted={userMuted}
        poster={poster}
        className={className}
        onError={onError}
      >
        <source src={src} type={type} />
      </video>

      {showMuteButton && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className={muteButtonClassName}
          aria-label={userMuted ? 'Unmute video' : 'Mute video'}
          title={userMuted ? 'Turn sound on' : 'Turn sound off'}
        >
          {userMuted || soundBlocked ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}

      {soundBlocked && !userMuted && (
        <div className="absolute bottom-3 left-3 right-3 z-10 pointer-events-none">
          <p className="text-[11px] text-white/90 bg-black/50 backdrop-blur px-3 py-1.5 rounded-lg text-center">
            Tap video or speaker to enable sound
          </p>
        </div>
      )}
    </div>
  );
}
