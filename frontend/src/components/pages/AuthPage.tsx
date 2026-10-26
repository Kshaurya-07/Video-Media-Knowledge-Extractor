import React, { useState } from 'react';
import { VyoraKnowledgeCore } from '../3d/VyoraKnowledgeCore';
import { ArrowLeft, Lock, Mail, User, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
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
    }, 800);
  };

  const handleDemoSignIn = () => {
    const demoUser = { email: 'researcher@vyora.ai', name: 'Dr. Sarah Chen' };
    setStoredUser(demoUser);
    onSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#FAFAFA] flex flex-col lg:flex-row relative selection:bg-violet-500/30 selection:text-violet-200">
      {/* Back Button */}
      <button
        onClick={onCancel}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#111111] hover:bg-[#151515] border border-[#27272A] text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Home</span>
      </button>

      {/* Left Column: Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-20 z-10">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111111] border border-[#27272A] text-[11px] font-mono text-violet-400 mb-3">
              <Sparkles className="w-3 h-3" />
              <span>SECURE ACCESS</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              {isSignUp ? 'Create your VYORA account' : 'Welcome back'}
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1.5">
              {isSignUp
                ? 'Unlock full-spectrum multimodal video knowledge extraction'
                : 'Access your saved projects, transcripts, and intelligence maps'}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-medium text-[#D4D4D8] mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kumar Shaurya"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#D4D4D8] mb-1.5">
                Work or Personal Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#D4D4D8] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-lg shadow-white/5 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>{isSignUp ? 'Sign Up' : 'Sign In'}</span>
              )}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="pt-2 border-t border-[#27272A] space-y-3">
            <button
              type="button"
              onClick={handleDemoSignIn}
              className="w-full py-2.5 rounded-xl bg-[#111111] hover:bg-[#151515] border border-[#27272A] hover:border-violet-500/40 text-xs font-medium text-violet-300 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>One-Click Demo Sign In</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-[#71717A] hover:text-white transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: 3D Spatial Environment */}
      <div className="hidden lg:flex w-1/2 bg-[#0A0A0A] border-l border-[#27272A] relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none z-10" />
        <div className="w-[480px] h-[480px] relative">
          <VyoraKnowledgeCore interactive={true} scale={1.2} />
        </div>
        <div className="absolute bottom-12 text-center z-20 max-w-sm px-6">
          <h4 className="text-sm font-bold text-white font-sans">Dimensional Knowledge Engine</h4>
          <p className="text-xs text-[#71717A] mt-1">
            Grounded temporal RAG, audio waveform tokenization, and optical scene understanding.
          </p>
        </div>
      </div>
    </div>
  );
};
