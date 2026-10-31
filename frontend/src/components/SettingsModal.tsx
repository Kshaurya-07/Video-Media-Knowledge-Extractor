import React, { useState } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { verifyApiKey, setStoredApiKey, getStoredApiKey, clearStoredApiKey } from '../lib/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverKeyConfigured?: boolean;
  onKeySaved: (key: string) => void;
  onKeyCleared?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  serverKeyConfigured = false,
  onKeySaved,
  onKeyCleared,
}) => {
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleClearKey = () => {
    clearStoredApiKey();
    setApiKey('');
    setStatusMessage({ type: 'success', text: 'Custom key removed. Reverting to server default.' });
    if (onKeyCleared) onKeyCleared();
  };

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
        setStatusMessage({ type: 'success', text: res.message || 'API Key verified and saved successfully.' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-sm animate-fade-in text-left">
      <div className="relative w-full max-w-md bg-white border border-neutral-300 rounded-sm p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-sm bg-neutral-100 text-neutral-950 border border-neutral-200">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-950 text-sm font-sans">Gemini API credentials</h3>
              <p className="text-[11px] text-neutral-500 font-mono">Multimodal Intelligence Engine</p>
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

        {/* Content */}
        <div className="space-y-4">
          {/* Server Key Status Banner */}
          {serverKeyConfigured ? (
            <div className="p-3.5 rounded-sm bg-neutral-50 border border-neutral-300 text-neutral-800 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-neutral-950">Server API key active</p>
                <p className="text-neutral-600 mt-0.5 text-[11px] leading-relaxed">
                  A system-wide Google Gemini API Key is configured in backend environment variables. You can process media without entering a personal key.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-sm bg-neutral-50 border border-neutral-300 text-neutral-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold text-neutral-950">Personal key required</p>
                <p className="text-neutral-600 mt-0.5 text-[11px] leading-relaxed">
                  Enter your Google AI Studio key below to analyze videos and run grounded Q&A.
                </p>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                {serverKeyConfigured ? 'Custom key (optional override)' : 'Google AI Studio key'}
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="text-[10px] font-mono text-rose-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear key</span>
                </button>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={serverKeyConfigured ? 'Optional override (AIzaSy...)' : 'AIzaSy...'}
              className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-sm text-neutral-950 placeholder:text-neutral-400 text-xs focus:outline-none focus:border-neutral-950 font-mono"
            />
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-sm text-xs flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-neutral-50 border border-neutral-300 text-neutral-800'
                  : 'bg-rose-50 border border-rose-300 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              )}
              <span className="font-mono text-[11px]">{statusMessage.text}</span>
            </div>
          )}

          <div className="bg-neutral-50 border border-neutral-200 rounded-sm p-3 text-xs text-neutral-600 space-y-1.5">
            <p className="leading-relaxed">
              Your key is transmitted over TLS to authenticate with Google Gemini Developer API.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-neutral-950 font-mono text-[11px] hover:underline"
            >
              <span>Get a free key from Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-sm text-xs font-mono text-neutral-600 hover:text-neutral-950 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerifyAndSave}
              disabled={isVerifying || !apiKey.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-xs font-medium bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-mono"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save credentials</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsModal;
