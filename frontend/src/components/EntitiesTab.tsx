import React, { useState } from 'react';
import { EntityItem, ActionItem } from '../lib/types';
import { Layers, CheckSquare, Square, Play, CheckCircle2 } from 'lucide-react';

interface EntitiesTabProps {
  entities: EntityItem[];
  actionItems: ActionItem[];
  onSeek: (seconds: number) => void;
}

export const EntitiesTab: React.FC<EntitiesTabProps> = ({
  entities,
  actionItems,
  onSeek,
}) => {
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({});

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const parseTimestamp = (ts: string): number => {
    const parts = ts.split(':').map((p) => parseFloat(p));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  return (
    <div className="space-y-6">
      {/* Action Items Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Key Recommendations & Action Items</h3>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {actionItems.length} Tasks
          </span>
        </div>

        <div className="space-y-2.5">
          {actionItems.map((item, idx) => {
            const isDone = !!completedTasks[idx];
            return (
              <div
                key={idx}
                onClick={() => toggleTask(idx)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                  isDone
                    ? 'bg-slate-950/40 border-slate-800/40 opacity-60'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  className="mt-0.5 text-slate-400 hover:text-emerald-400 shrink-0 transition-colors"
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-1">
                  <p
                    className={`text-xs font-medium text-slate-200 ${
                      isDone ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {item.task}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {item.context}
                  </p>
                  {item.assignee_or_speaker && (
                    <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Speaker: {item.assignee_or_speaker}
                    </span>
                  )}
                </div>

                {item.timestamp && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeek(parseTimestamp(item.timestamp!));
                    }}
                    className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors shrink-0"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>{item.timestamp}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Entities & Concepts Section */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-100">Entities & Concepts Map</h3>
          </div>
          <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
            {entities.length} Detected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entities.map((entity, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">
                    {entity.name}
                  </h4>
                  <span className="inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {entity.category}
                  </span>
                </div>

                <span className="text-[11px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                  {entity.mentions_count}x
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {entity.description}
              </p>

              {entity.timestamps && entity.timestamps.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] text-slate-500">Mentions:</span>
                  {entity.timestamps.map((ts, tIdx) => (
                    <button
                      key={tIdx}
                      onClick={() => onSeek(parseTimestamp(ts))}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                    >
                      {ts}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
