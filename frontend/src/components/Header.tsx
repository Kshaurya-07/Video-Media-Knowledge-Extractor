import React from 'react';
import { Sparkles, Key, CheckCircle, AlertCircle, FileText, Code2 } from 'lucide-react';

interface HeaderProps {
  hasKey: boolean;
  onOpenSettings: () => void;
  onOpenExport?: () => void;
  hasAnalysis: boolean;
  mediaTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  hasKey,
  onOpenSettings,
  onOpenExport,
  hasAnalysis,
  mediaTitle,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
                VYORA AI
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multimodal Video & Media Knowledge Extractor
            </p>
          </div>
        </div>

        {/* Current Media Title if present */}
        {mediaTitle && (
          <div className="hidden lg:flex items-center gap-2 max-w-md px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="truncate font-medium">{mediaTitle}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {hasAnalysis && onOpenExport && (
            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/60 text-xs font-medium transition-colors"
              title="Export Extracted Knowledge"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export</span>
            </button>
          )}

          {/* API Key Status Pill */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              hasKey
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{hasKey ? 'Gemini Active' : 'Enter API Key'}</span>
            {hasKey ? (
              <CheckCircle className="w-3 h-3 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3 h-3 text-amber-400" />
            )}
          </button>

          <a
            href="https://github.com/Kshaurya-07/Video-Media-Knowledge-Extractor"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-100 border border-slate-800 transition-colors"
            title="GitHub Repository"
          >
            <Code2 className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
