import React, { useState, useMemo } from 'react';
import { TranscriptSegment } from '../lib/types';
import { Search, User, Play, Copy, Check } from 'lucide-react';

interface TranscriptTabProps {
  transcript: TranscriptSegment[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export const TranscriptTab: React.FC<TranscriptTabProps> = ({
  transcript,
  currentTime,
  onSeek,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return transcript;
    const q = searchQuery.toLowerCase();
    return transcript.filter(
      (seg) =>
        seg.text.toLowerCase().includes(q) ||
        (seg.speaker && seg.speaker.toLowerCase().includes(q))
    );
  }, [transcript, searchQuery]);

  const copyFullTranscript = () => {
    const text = transcript
      .map((seg) => `[${seg.start_time_formatted}] ${seg.speaker || 'Speaker'}: ${seg.text}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcript by keyword..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        <button
          onClick={copyFullTranscript}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors self-end sm:self-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
          <span>{copied ? 'Copied!' : 'Copy Transcript'}</span>
        </button>
      </div>

      {/* Transcript Segments List */}
      <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No matching transcript dialogue found for "{searchQuery}".
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isActive =
              currentTime >= seg.start_time && currentTime <= seg.end_time;

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl border transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/30 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400">
                      <User className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-300">
                      {seg.speaker || 'Speaker'}
                    </span>
                  </div>

                  <button
                    onClick={() => onSeek(seg.start_time)}
                    className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>{seg.start_time_formatted}</span>
                  </button>
                </div>

                <p className="text-xs leading-relaxed text-slate-300 pl-7">
                  {seg.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
