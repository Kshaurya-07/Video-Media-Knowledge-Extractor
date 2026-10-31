import React, { useState } from 'react';
import { ModelStatusResponse, refreshModelCache } from '../lib/api';
import {
  X,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-sm animate-fade-in text-left">
      <div className="w-full max-w-lg bg-white border border-neutral-300 rounded-sm shadow-xl overflow-hidden flex flex-col space-y-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-sm bg-neutral-100 border border-neutral-200 text-neutral-950">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-950 flex items-center gap-2 font-sans">
                <span>Model intelligence & discovery</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-neutral-100 text-neutral-700 border border-neutral-200">
                  {isFallback ? 'Fallback active' : isAutomatic ? 'Auto selection' : 'Override'}
                </span>
              </h3>
              <p className="text-[11px] text-neutral-500 font-mono">
                Multimodal capability detection and automatic failover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-neutral-400 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-sm bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active Model Card */}
          <div className="p-4 rounded-sm bg-neutral-50 border border-neutral-300 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
                  Active selected model
                </span>
                <div className="text-base font-bold text-neutral-950 mt-0.5 flex items-center gap-2">
                  <span>{modelStatus?.display_model || 'Gemini 2.0 Flash'}</span>
                  {isConnected ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <span className="text-xs font-mono text-neutral-600">
                  {modelStatus?.selected_model || modelStatus?.configured_model || 'gemini-2.0-flash'}
                </span>
              </div>

              <div className="px-2.5 py-1 rounded-sm text-[10px] font-mono border bg-white border-neutral-300 text-neutral-800">
                {modelStatus?.status === 'connected'
                  ? 'Verified active'
                  : modelStatus?.status === 'configured'
                  ? 'Configured'
                  : modelStatus?.status === 'pending_key'
                  ? 'Key required'
                  : 'Offline'}
              </div>
            </div>

            <div className="text-xs text-neutral-600 leading-relaxed border-t border-neutral-200 pt-2 font-mono text-[11px]">
              {modelStatus?.message ||
                'Automatically discovered and verified via Google Gemini API model listing.'}
            </div>
          </div>

          {/* Selection Policy Details */}
          <div className="grid grid-cols-2 gap-2.5 text-left">
            <div className="p-3 rounded-sm bg-neutral-50 border border-neutral-200">
              <span className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-neutral-950" /> Policy
              </span>
              <span className="text-xs font-bold text-neutral-950 mt-1 block">
                Multimodal & speed
              </span>
              <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">
                Favors 1M context Flash models
              </span>
            </div>

            <div className="p-3 rounded-sm bg-neutral-50 border border-neutral-200">
              <span className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-neutral-950" /> Protection
              </span>
              <span className="text-xs font-bold text-neutral-950 mt-1 block">
                Intelligent failover
              </span>
              <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">
                Blacklists 503 / 404 models
              </span>
            </div>
          </div>

          {/* Candidate Models Pool */}
          {modelStatus?.candidate_models && modelStatus.candidate_models.length > 0 && (
            <div className="space-y-2 text-left">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-neutral-950" /> Compatible models (
                {modelStatus.candidate_models.length})
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {modelStatus.candidate_models.map((c) => {
                  const isCurrent =
                    c.model_id === (modelStatus.selected_model || modelStatus.configured_model);
                  return (
                    <div
                      key={c.model_id}
                      className={`px-3 py-2 rounded-sm text-xs flex items-center justify-between border transition-colors ${
                        isCurrent
                          ? 'bg-neutral-100 border-neutral-950 text-neutral-950 font-medium'
                          : 'bg-white border-neutral-200 text-neutral-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{c.display_name}</span>
                        <span className="font-mono text-[10px] text-neutral-400">({c.model_id})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.input_token_limit && c.input_token_limit > 0 ? (
                          <span className="text-[10px] font-mono text-neutral-400">
                            {Math.round(c.input_token_limit / 1000)}k tokens
                          </span>
                        ) : null}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-neutral-100 border border-neutral-200 text-neutral-700">
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
            <div className="text-[10px] font-mono text-neutral-400 pt-1">
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
        <div className="px-6 py-3.5 border-t border-neutral-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-xs font-mono text-neutral-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Discovering...' : 'Refresh models'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-sm bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium font-mono transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
export default ModelStatusModal;
