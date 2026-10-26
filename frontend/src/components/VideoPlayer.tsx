import React, { useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Music,
} from 'lucide-react';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  src: string;
  mediaType: 'video' | 'audio';
  title?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ src, mediaType, title, onTimeUpdate }, ref) => {
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (mediaRef.current) {
          mediaRef.current.currentTime = Math.max(0, Math.min(seconds, duration || 99999));
          mediaRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      },
      play: () => {
        mediaRef.current?.play().catch(() => {});
        setIsPlaying(true);
      },
      pause: () => {
        mediaRef.current?.pause();
        setIsPlaying(false);
      },
      getCurrentTime: () => mediaRef.current?.currentTime || 0,
    }));

    const togglePlay = () => {
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
      if (mediaRef.current) {
        mediaRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);
      }
    };

    const skipTime = (delta: number) => {
      if (mediaRef.current) {
        const nextTime = Math.max(0, Math.min(mediaRef.current.currentTime + delta, duration));
        mediaRef.current.currentTime = nextTime;
        setCurrentTime(nextTime);
      }
    };

    const toggleMute = () => {
      if (!mediaRef.current) return;
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    };

    const cyclePlaybackRate = () => {
      const rates = [1, 1.25, 1.5, 1.75, 2];
      const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
      const nextRate = rates[nextIdx];
      setPlaybackRate(nextRate);
      if (mediaRef.current) {
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

    const formatTime = (secs: number) => {
      if (isNaN(secs)) return '00:00';
      const total = Math.floor(secs);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
      <div
        ref={containerRef}
        className="group relative bg-[#090d16] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between"
      >
        {/* Media Frame */}
        <div className="relative aspect-video w-full flex items-center justify-center bg-black/40 overflow-hidden">
          {mediaType === 'video' ? (
            <video
              ref={mediaRef as any}
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
                }
              }}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <audio
                ref={mediaRef as any}
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
                  }
                }}
                onEnded={() => setIsPlaying(false)}
              />
              <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <Music className="w-10 h-10 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">{title || 'Audio Recording'}</p>
                <p className="text-xs text-slate-400">Multimodal Speech Analysis</p>
              </div>
            </div>
          )}

          {/* Quick Play/Pause Overlay Icon on Hover */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="p-4 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-xl backdrop-blur-md transform scale-95 group-hover:scale-100 transition-transform">
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 translate-x-0.5" />}
            </div>
          </button>
        </div>

        {/* Video Player Controls Bar */}
        <div className="p-3 bg-gradient-to-t from-slate-950 via-slate-950/90 to-slate-900/60 border-t border-slate-800/80 space-y-2">
          {/* Progress Timeline Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 group/slider">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all"
              />
              <div
                className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg pointer-events-none"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-slate-500 w-10">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition-colors"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => skipTime(-5)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Rewind 5s"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => skipTime(5)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Forward 5s"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
                    if (mediaRef.current) {
                      mediaRef.current.volume = val;
                      mediaRef.current.muted = val === 0;
                      setIsMuted(val === 0);
                    }
                  }}
                  className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Speed pill */}
              <button
                onClick={cyclePlaybackRate}
                className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:bg-slate-800 text-[11px] font-mono text-slate-300 transition-colors"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              {mediaType === 'video' && (
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
