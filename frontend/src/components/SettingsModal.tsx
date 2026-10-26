import React, { useState } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Loader2 } from 'lucide-react';
import { verifyApiKey, setStoredApiKey, getStoredApiKey } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved: (key: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleVerifyAndSave = async () => {
    if (!apiKey.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid API key.' });
      return;
    }
    setIsVerifying(true);
    setStatusMessage(null);
    try {
      const res = await verifyApiKey(apiKey.trim());
      if (res.valid) {
        setStoredApiKey(apiKey.trim());
        onKeySaved(apiKey.trim());
        setStatusMessage({ type: 'success', text: 'API Key verified and saved successfully!' });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Key verification failed.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to connect to backend server.' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#111625] border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Gemini API Configuration</h3>
              <p className="text-xs text-slate-400">Power multimodal video understanding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Google Gemini API Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 space-y-2">
            <p>
              Your key is used securely by VYORA AI to automatically discover, validate, and select the optimal Gemini model for video analysis.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <span>Get a free Gemini API Key from Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyAndSave}
              disabled={isVerifying || !apiKey.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Connect</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
