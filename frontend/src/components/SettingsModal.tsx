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
    setStatusMessage({ type: 'success', text: 'Custom personal key removed. Reverting to server default.' });
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
        setStatusMessage({ type: 'success', text: res.message || 'API Key verified and saved successfully!' });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-left">
      <div className="relative w-full max-w-md bg-[#0A0A0E] border border-[#202028] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#1C1C24]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#12121A] text-violet-400 border border-[#202028]">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-sans">Gemini API Credentials</h3>
              <p className="text-[11px] text-[#71717A] font-mono">Multimodal Intelligence Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#71717A] hover:text-white hover:bg-[#14141C] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Server Key Status Banner */}
          {serverKeyConfigured ? (
            <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
              <div>
                <p className="font-bold text-emerald-200">Server API Key Active</p>
                <p className="text-emerald-300/80 mt-0.5 text-[11px] leading-relaxed">
                  A system-wide Google Gemini API Key is configured in backend environment variables. You can process media without entering a personal key.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
              <div>
                <p className="font-bold text-amber-200">Personal Key Required</p>
                <p className="text-amber-300/80 mt-0.5 text-[11px] leading-relaxed">
                  Enter your Google AI Studio key below to analyze videos and run grounded Q&A.
                </p>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                {serverKeyConfigured ? 'Custom Key (Optional Override)' : 'Google AI Studio Key'}
              </label>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="text-[10px] font-mono text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Key</span>
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={serverKeyConfigured ? 'Optional override (AIzaSy...)' : 'AIzaSy...'}
                className="w-full px-3.5 py-2.5 bg-[#050508] border border-[#202028] rounded-xl text-white placeholder:text-[#52525B] text-xs focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/20 border border-red-500/30 text-red-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <Check className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span className="font-mono text-[11px]">{statusMessage.text}</span>
            </div>
          )}

          <div className="bg-[#050508] border border-[#1A1A22] rounded-2xl p-3.5 text-xs text-[#71717A] space-y-2">
            <p className="leading-relaxed">
              Your key is transmitted over TLS to authenticate with Google Gemini Developer API.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-violet-400 hover:text-violet-300 font-mono text-[11px]"
            >
              <span>Get a free key from Google AI Studio</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1C1C24]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-[#71717A] hover:text-white hover:bg-[#121218] transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleVerifyAndSave}
              disabled={isVerifying || !apiKey.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg transition-all"
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