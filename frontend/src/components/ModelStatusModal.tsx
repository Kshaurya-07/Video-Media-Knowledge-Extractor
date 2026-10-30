import React, { useState } from 'react';
import { ModelStatusResponse, refreshModelCache } from '../lib/api';
import {
  X,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Cpu,
  Layers,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface ModelStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelStatus: ModelStatusResponse | null;
  onRefresh: (newStatus: ModelStatusResponse) => void;
}

export const ModelStatusModal: React.FC<ModelStatusModalProps> = ({
  isOpen,
  onClose,
  modelStatus,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const refreshed = await refreshModelCache();
      onRefresh(refreshed);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to refresh models');
    } finally {
      setIsRefreshing(false);
    }
  };

  const isConnected = modelStatus?.status === 'connected' || modelStatus?.status === 'configured';
  const isAutomatic = modelStatus?.selection_mode === 'automatic';
  const isFallback = modelStatus?.selection_mode === 'fallback';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0F0F11] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Gemini Model Intelligence</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {isFallback ? 'Fallback Active' : isAutomatic ? 'Auto Selection' : 'Admin Override'}
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Dynamic capability detection & automatic model selection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active Model Card */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                  Active Selected Model
                </span>
                <div className="text-base font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>{modelStatus?.display_model || 'Gemini 2.0 Flash'}</span>
                  {isConnected ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <span className="text-xs font-mono text-violet-400">
                  {modelStatus?.selected_model || modelStatus?.configured_model || 'gemini-2.0-flash'}
                </span>
              </div>

              <div
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                  isConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {modelStatus?.status === 'connected'
                  ? 'Verified Active'
                  : modelStatus?.status === 'configured'
                  ? 'Configured'
                  : modelStatus?.status === 'pending_key'
                  ? 'Key Required'
                  : 'Offline'}
              </div>
            </div>

            <div className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/80 pt-2.5">
              {modelStatus?.message ||
                'Automatically discovered and verified via Google Gemini API model listing.'}
            </div>
          </div>

          {/* Selection Policy Details */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400" /> Policy
              </span>
              <span className="text-xs font-semibold text-zinc-200 mt-1 block">
                Multimodal & Speed Priority
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                Favors 1M context Flash models
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Fallback Protection
              </span>
              <span className="text-xs font-semibold text-zinc-200 mt-1 block">
                Automatic Failover
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">
                Blacklists 404 / deprecated models
              </span>
            </div>
          </div>

          {/* Candidate Models Pool */}
          {modelStatus?.candidate_models && modelStatus.candidate_models.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-violet-400" /> Discovered Compatible Models (
                {modelStatus.candidate_models.length})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {modelStatus.candidate_models.map((c) => {
                  const isCurrent =
                    c.model_id === (modelStatus.selected_model || modelStatus.configured_model);
                  return (
                    <div
                      key={c.model_id}
                      className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition-colors ${
                        isCurrent
                          ? 'bg-violet-500/10 border-violet-500/30 text-white font-medium'
                          : 'bg-zinc-900/30 border-zinc-800/60 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isCurrent && <Sparkles className="w-3 h-3 text-violet-400" />}
                        <span>{c.display_name}</span>
                        <span className="font-mono text-[10px] text-zinc-500">({c.model_id})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.input_token_limit && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            {Math.round(c.input_token_limit / 1000)}k tokens
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isCurrent
                              ? 'bg-violet-500/20 text-violet-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          Score: {c.tier_score}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          {modelStatus?.last_checked && (
            <div className="text-[10px] font-mono text-zinc-500 pt-1">
              Last discovery check:{' '}
              {new Date(modelStatus.last_checked).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/40">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Discovering...' : 'Refresh Discovery'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
