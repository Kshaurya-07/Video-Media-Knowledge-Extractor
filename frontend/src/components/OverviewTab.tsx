import React from 'react';
import { MediaAnalysisResult } from '../lib/types';
import { FileText, CheckCircle2, Award, Zap, Activity } from 'lucide-react';

interface OverviewTabProps {
  analysis: MediaAnalysisResult;
  onSeek: (seconds: number) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ analysis }) => {
  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Duration</span>
          </div>
          <p className="text-xl font-bold text-white font-mono">{analysis.duration_formatted}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Chapters</span>
          </div>
          <p className="text-xl font-bold text-white font-mono">{analysis.chapters.length}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Entities</span>
          </div>
          <p className="text-xl font-bold text-white font-mono">{analysis.entities.length}</p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>Tone</span>
          </div>
          <p className="text-sm font-semibold text-slate-200 truncate mt-1">
            {analysis.sentiment_and_tone.overall || 'Analytical'}
          </p>
        </div>
      </div>

      {/* Overview Block */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-2">
          High-Level Overview
        </h3>
        <p className="text-sm leading-relaxed text-slate-300">
          {analysis.overview}
        </p>
      </div>

      {/* Executive Summary Block */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-3">
          Executive Summary
        </h3>
        <div className="text-sm leading-relaxed text-slate-300 space-y-3 font-normal whitespace-pre-line">
          {analysis.executive_summary}
        </div>
      </div>

      {/* Key Takeaways */}
      <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-4">
          Key Takeaways & Insights
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analysis.key_takeaways.map((takeaway, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-300 text-xs leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <span>{takeaway}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
