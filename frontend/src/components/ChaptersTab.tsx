import React from 'react';
import { Chapter } from '../lib/types';
import { Play, Clock, Sparkles } from 'lucide-react';

interface ChaptersTabProps {
  chapters: Chapter[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export const ChaptersTab: React.FC<ChaptersTabProps> = ({
  chapters,
  currentTime,
  onSeek,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Timestamped Chapters</h3>
          <p className="text-xs text-slate-400">Click any chapter to jump the player directly to that segment</p>
        </div>
        <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
          {chapters.length} Sections
        </span>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, idx) => {
          const isActive =
            currentTime >= chapter.start_time && currentTime <= chapter.end_time;

          return (
            <div
              key={idx}
              className={`p-4 rounded-2xl border transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                  : 'bg-slate-900/40 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onSeek(chapter.start_time)}
                    className={`mt-0.5 px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-indigo-300 hover:bg-indigo-600 hover:text-white'
                    }`}
                    title="Jump to chapter"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{chapter.start_time_formatted}</span>
                  </button>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      {chapter.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {chapter.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{chapter.end_time_formatted}</span>
                </div>
              </div>

              {chapter.key_moments && chapter.key_moments.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-slate-800/60 pl-2">
                  <p className="text-[11px] font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Key Moments:</span>
                  </p>
                  <ul className="space-y-1">
                    {chapter.key_moments.map((km, kIdx) => (
                      <li
                        key={kIdx}
                        className="text-xs text-slate-400 flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 shrink-0" />
                        <span>{km}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
