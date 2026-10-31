import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Music,
  ExternalLink,
} from 'lucide-react';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface VideoPlayerProps {
  src: string;
  mediaType: 'video' | 'audio';
  title?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
  );
  return match ? match[1] : null;
}

export function formatTimestamp(secs: number): string {
  if (isNaN(secs) || secs < 0) return '00:00';
  const total = Math.floor(secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export function parseTimestamp(formatted: string): number {
  if (!formatted) return 0;
  const parts = formatted.trim().split(':').map((p) => parseFloat(p));
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }
  return 0;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, mediaType, title, onTimeUpdate }, ref) => {
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pendingSeekRef = useRef<number | null>(null);

    const youtubeId = extractYouTubeId(src);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [_isYouTubeReady, setIsYouTubeReady] = useState(false);

    // Send postMessage command to YouTube iframe
    const sendYouTubeCommand = useCallback((func: string, args: any[] = []) => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      }
    }, []);

    // YouTube iframe postMessage listener for reactive synchronization
    useEffect(() => {
      if (!youtubeId) return;

      const handleWindowMessage = (e: MessageEvent) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data && data.event === 'onReady') {
            setIsYouTubeReady(true);
            if (pendingSeekRef.current !== null) {
              const target = pendingSeekRef.current;
              pendingSeekRef.current = null;
              sendYouTubeCommand('seekTo', [target, true]);
              sendYouTubeCommand('playVideo');
            }
          }

          if (data && data.event === 'infoDelivery' && data.info) {
            setIsYouTubeReady(true);
            if (typeof data.info.currentTime === 'number') {
              const ct = data.info.currentTime;
              setCurrentTime(ct);
              onTimeUpdate?.(ct);
            }
            if (typeof data.info.duration === 'number' && data.info.duration > 0) {
              setDuration(data.info.duration);
            }
            if (typeof data.info.playerState === 'number') {
              // 1 = playing, 2 = paused, 0 = ended
              if (data.info.playerState === 1) setIsPlaying(true);
              else if (data.info.playerState === 2 || data.info.playerState === 0) {
                setIsPlaying(false);
              }
            }
          }
        } catch {
          // Ignore non-json postMessages
        }
      };

      window.addEventListener('message', handleWindowMessage);

      // Ping iframe to establish event subscription
      const handshake = setInterval(() => {
        sendYouTubeCommand('listening');
      }, 800);

      return () => {
        window.removeEventListener('message', handleWindowMessage);
        clearInterval(handshake);
      };
    }, [youtubeId, onTimeUpdate, sendYouTubeCommand]);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const clamped = Math.max(0, Math.min(seconds, duration > 0 ? duration : 86400));
        setCurrentTime(clamped);
        onTimeUpdate?.(clamped);

        if (youtubeId) {
          sendYouTubeCommand('seekTo', [clamped, true]);
          sendYouTubeCommand('playVideo');
          setIsPlaying(true);
          pendingSeekRef.current = clamped;
        } else if (mediaRef.current) {
          try {
            mediaRef.current.currentTime = clamped;
            mediaRef.current.play().catch(() => {});
            setIsPlaying(true);
          } catch {
            pendingSeekRef.current = clamped;
          }
        } else {
          pendingSeekRef.current = clamped;
        }
      },
      play: () => {
        if (youtubeId) {
          sendYouTubeCommand('playVideo');
          setIsPlaying(true);
        } else if (mediaRef.current) {
          mediaRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      },
      pause: () => {
        if (youtubeId) {
          sendYouTubeCommand('pauseVideo');
          setIsPlaying(false);
        } else if (mediaRef.current) {
          mediaRef.current.pause();
          setIsPlaying(false);
        }
      },
      getCurrentTime: () => currentTime,
      getDuration: () => duration,
    }));

    const togglePlay = () => {
      if (youtubeId) {
        if (isPlaying) {
          sendYouTubeCommand('pauseVideo');
          setIsPlaying(false);
        } else {
          sendYouTubeCommand('playVideo');
          setIsPlaying(true);
        }
        return;
      }

      if (!mediaRef.current) return;
      if (isPlaying) {
        mediaRef.current.pause();
        setIsPlaying(false);
      } else {
        mediaRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const targetTime = parseFloat(e.target.value);
      setCurrentTime(targetTime);
      onTimeUpdate?.(targetTime);

      if (youtubeId) {
        sendYouTubeCommand('seekTo', [targetTime, true]);
      } else if (mediaRef.current) {
        mediaRef.current.currentTime = targetTime;
      }
    };

    const skipTime = (delta: number) => {
      const newTime = Math.max(0, Math.min(currentTime + delta, duration || 86400));
      setCurrentTime(newTime);
      onTimeUpdate?.(newTime);

      if (youtubeId) {
        sendYouTubeCommand('seekTo', [newTime, true]);
      } else if (mediaRef.current) {
        mediaRef.current.currentTime = newTime;
      }
    };

    const toggleMute = () => {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);

      if (youtubeId) {
        if (nextMuted) sendYouTubeCommand('mute');
        else sendYouTubeCommand('unMute');
      } else if (mediaRef.current) {
        mediaRef.current.muted = nextMuted;
      }
    };

    const cyclePlaybackRate = () => {
      const rates = [0.75, 1, 1.25, 1.5, 2];
      const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
      setPlaybackRate(nextRate);

      if (youtubeId) {
        sendYouTubeCommand('setPlaybackRate', [nextRate]);
      } else if (mediaRef.current) {
        mediaRef.current.playbackRate = nextRate;
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };

    return (
      <div
        ref={containerRef}
        className="group relative bg-neutral-950 border border-neutral-300 rounded-sm overflow-hidden flex flex-col justify-between"
      >
        {/* Media Frame */}
        <div className="relative aspect-video w-full flex items-center justify-center bg-black overflow-hidden">
          {youtubeId ? (
            <div className="relative w-full h-full">
              <iframe
                ref={iframeRef}
                id="vyora-yt-player"
                src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&modestbranding=1&rel=0`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={title || 'YouTube Stream'}
              />
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <a
                  href={`https://www.youtube.com/watch?v=${youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-neutral-950/90 hover:bg-black text-[11px] font-mono text-neutral-300 hover:text-white border border-neutral-700 backdrop-blur-md transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-neutral-300" />
                  <span>Open YouTube</span>
                </a>
              </div>
            </div>
          ) : mediaType === 'video' ? (
            <>
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={src}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlay}
                onTimeUpdate={() => {
                  if (mediaRef.current) {
                    const t = mediaRef.current.currentTime;
                    setCurrentTime(t);
                    onTimeUpdate?.(t);
                  }
                }}
                onLoadedMetadata={() => {
                  if (mediaRef.current) {
                    setDuration(mediaRef.current.duration || 0);
                    if (pendingSeekRef.current !== null) {
                      mediaRef.current.currentTime = pendingSeekRef.current;
                      pendingSeekRef.current = null;
                    }
                  }
                }}
                onEnded={() => setIsPlaying(false)}
                playsInline
              />
              {/* Play/Pause Hover Overlay Icon */}
              <button
                type="button"
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
              >
                <div className="p-4 rounded-full bg-neutral-950/80 hover:bg-neutral-950 text-white border border-neutral-700 shadow-xl backdrop-blur-md transform scale-95 group-hover:scale-100 transition-transform">
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 translate-x-0.5 fill-current" />
                  )}
                </div>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={src}
                onTimeUpdate={() => {
                  if (mediaRef.current) {
                    const t = mediaRef.current.currentTime;
                    setCurrentTime(t);
                    onTimeUpdate?.(t);
                  }
                }}
                onLoadedMetadata={() => {
                  if (mediaRef.current) {
                    setDuration(mediaRef.current.duration || 0);
                    if (pendingSeekRef.current !== null) {
                      mediaRef.current.currentTime = pendingSeekRef.current;
                      pendingSeekRef.current = null;
                    }
                  }
                }}
                onEnded={() => setIsPlaying(false)}
              />
              <div className="w-14 h-14 rounded-sm bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300">
                <Music className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-mono font-medium text-white">{title || 'Audio Media'}</p>
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Acoustic Audio Stream
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Video Player Controls Bar */}
        <div className="p-3 bg-neutral-950 border-t border-neutral-800 space-y-2">
          {/* Progress Timeline Slider */}
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono text-neutral-400 w-12 text-right">
              {formatTimestamp(currentTime)}
            </span>
            <div className="relative flex-1 group/slider">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-neutral-800 rounded-sm appearance-none cursor-pointer accent-neutral-200 hover:h-1.5 transition-all"
              />
              <div
                className="absolute top-0 left-0 h-1 bg-neutral-200 rounded-sm pointer-events-none"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-neutral-500 w-12">
              {formatTimestamp(duration)}
            </span>
          </div>

          {/* Button Row */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 rounded-sm bg-white hover:bg-neutral-200 text-neutral-950 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>

              <button
                type="button"
                onClick={() => skipTime(-5)}
                className="p-1.5 rounded-sm hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
                title="Rewind 5s"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => skipTime(5)}
                className="p-1.5 rounded-sm hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
                title="Forward 5s"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 rounded-sm hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    setIsMuted(val === 0);

                    if (youtubeId) {
                      sendYouTubeCommand('setVolume', [val * 100]);
                      if (val === 0) sendYouTubeCommand('mute');
                      else sendYouTubeCommand('unMute');
                    } else if (mediaRef.current) {
                      mediaRef.current.volume = val;
                      mediaRef.current.muted = val === 0;
                    }
                  }}
                  className="w-14 h-1 bg-neutral-800 rounded-sm appearance-none cursor-pointer accent-neutral-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cyclePlaybackRate}
                className="px-2 py-0.5 rounded-sm bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-[10px] font-mono text-neutral-200 transition-colors"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-sm hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors"
                title="Fullscreen"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);