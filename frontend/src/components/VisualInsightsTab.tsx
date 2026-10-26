import React from 'react';
import { VisualScene } from '../lib/types';
import { Tag, FileCode, Play, Monitor } from 'lucide-react';

interface VisualInsightsTabProps {
  scenes: VisualScene[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export const VisualInsightsTab: React.FC<VisualInsightsTabProps> = ({
  scenes,
  currentTime,
  onSeek,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Visual Insights & Screen OCR</h3>
          <p className="text-xs text-slate-400">
            Detected slides, diagrams, on-screen code snippets, and UI transitions
          </p>
        </div>
        <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
          {scenes.length} Scenes
        </span>
      </div>

      <div className="space-y-4">
        {scenes.map((scene, idx) => {
          const isActive =
            currentTime >= scene.start_time && currentTime <= scene.end_time;

          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl border transition-all duration-200 ${
                isActive
                  ? 'bg-purple-950/20 border-purple-500/50 shadow-lg ring-1 ring-purple-500/30'
                  : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/70 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <button
                    onClick={() => onSeek(scene.start_time)}
                    className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 hover:bg-purple-600 text-purple-300 hover:text-white transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>{scene.start_time_formatted} - {scene.end_time_formatted}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-slate-300 mb-3">
                {scene.description}
              </p>

              {/* Visual Element Badges */}
              {scene.visual_elements && scene.visual_elements.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {scene.visual_elements.map((el, eIdx) => (
                    <span
                      key={eIdx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                    >
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      <span>{el}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Detected Text / OCR Block */}
              {scene.detected_text && scene.detected_text.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Detected On-Screen Text (OCR):</span>
                  </div>
                  <div className="space-y-1 pl-1">
                    {scene.detected_text.map((text, tIdx) => (
                      <p
                        key={tIdx}
                        className="text-xs font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded border border-slate-800/50"
                      >
                        {text}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
