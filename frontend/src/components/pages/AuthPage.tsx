import React, { useState } from 'react';
import { VyoraIntelligenceOrbit } from '../3d/VyoraIntelligenceOrbit';
import { ArrowLeft, Lock, Mail, User, Sparkles, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { setStoredUser } from '../../lib/api';

interface AuthPageProps {
  onSuccess: (user: { email: string; name: string }) => void;
  onCancel: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess, onCancel }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }
    if (isSignUp && !name) {
      setErrorMessage('Please provide your name.');
      return;
    }

    setIsLoading(true);
    // Simulate Supabase authentication with local persistence
    setTimeout(() => {
      setIsLoading(false);
      const userProfile = {
        email: email.trim(),
        name: isSignUp ? name.trim() : email.split('@')[0],
      };
      setStoredUser(userProfile);
      onSuccess(userProfile);
    }, 600);
  };

  const handleDemoSignIn = () => {
    const demoUser = { email: 'researcher@vyora.ai', name: 'Dr. Sarah Chen' };
    setStoredUser(demoUser);
    onSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-[#030304] text-[#FAFAFA] flex flex-col lg:flex-row relative selection:bg-violet-500/30 selection:text-violet-200">
      {/* Return to Portal Button */}
      <button
        onClick={onCancel}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0A0A0E] hover:bg-[#14141B] border border-[#1A1A22] text-xs font-mono text-[#A1A1AA] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>[ RETURN TO PORTAL ]</span>
      </button>

      {/* Left Column: Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-20 z-10">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0A0E] border border-[#1A1A22] text-[11px] font-mono text-[#71717A] mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span>AUTHENTICATION · IDENTITY GATEWAY</span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-white font-sans">
              {isSignUp ? 'Create Researcher Account' : 'Authenticate Session'}
            </h2>
            <p className="text-xs text-[#71717A] mt-2 leading-relaxed">
              {isSignUp
                ? 'Unlock full-spectrum multimodal video knowledge extraction and topological reasoning.'
                : 'Access your persistent intelligence repositories, timestamped chapters, and extracted artifacts.'}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-mono text-[#A1A1AA] uppercase mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kumar Shaurya"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0E] border border-[#1A1A22] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono text-[#A1A1AA] uppercase mb-1.5">
                Work or Academic Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@vyora.ai"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0E] border border-[#1A1A22] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-[#A1A1AA] uppercase mb-1.5">
                Access Token / Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0E] border border-[#1A1A22] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Initialize Account' : 'Authenticate Session'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="pt-2 border-t border-[#1A1A22] space-y-3">
            <button
              type="button"
              onClick={handleDemoSignIn}
              className="w-full py-2.5 rounded-xl bg-[#0A0A0E] hover:bg-[#14141B] border border-[#1A1A22] hover:border-violet-500/30 text-xs font-mono text-[#A1A1AA] hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>One-Click Demo Authentication (Dr. Sarah Chen)</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-mono text-[#71717A] hover:text-white transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Need a new account? Register"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: 3D Intelligence Orbit Visualization */}
      <div className="hidden lg:flex w-1/2 bg-[#050507] border-l border-[#1A1A22] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#030304] via-transparent to-transparent pointer-events-none z-10" />
        <div className="w-[500px] h-[500px] relative">
          <VyoraIntelligenceOrbit
            stage={2}
            className="w-full h-full"
            interactive={true}
          />
        </div>
        <div className="absolute bottom-12 text-center z-20 max-w-sm px-6">
          <div className="text-[10px] font-mono text-[#71717A] uppercase tracking-wider mb-1">
            [ ARCHITECTURE / MULTIMODAL CORE ]
          </div>
          <h4 className="text-sm font-semibold text-white font-sans">Multimodal Perception Engine</h4>
          <p className="text-xs text-[#71717A] mt-1 leading-relaxed">
            Native visual frame perception, temporal grounding, audio waveform alignment, and synthesized structured knowledge.
          </p>
        </div>
      </div>
    </div>
  );
};
export default AuthPage;
