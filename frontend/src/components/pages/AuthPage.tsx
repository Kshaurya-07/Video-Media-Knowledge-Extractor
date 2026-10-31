import React, { useState } from 'react';
import { VyoraIntelligenceOrbit } from '../3d/VyoraIntelligenceOrbit';
import { ArrowLeft, Lock, Mail, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
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
    // Authenticate session with local storage persistence
    setTimeout(() => {
      setIsLoading(false);
      const userProfile = {
        email: email.trim(),
        name: isSignUp ? name.trim() : email.split('@')[0],
      };
      setStoredUser(userProfile);
      onSuccess(userProfile);
    }, 500);
  };

  const handleDemoSignIn = () => {
    const demoUser = { email: 'researcher@vyora.ai', name: 'Dr. Sarah Chen' };
    setStoredUser(demoUser);
    onSuccess(demoUser);
  };

  return (
    <div className="min-h-screen bg-[#f1f1ef] text-neutral-950 flex flex-col lg:flex-row relative">
      {/* Return to Portal Button */}
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-600 hover:text-neutral-950 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to portal</span>
      </button>

      {/* Left Column: Light Surface Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-24 z-10">
        <div className="max-w-md w-full mx-auto space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-white border border-neutral-300 text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
              <span>AUTHENTICATION · IDENTITY</span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-950 font-sans">
              {isSignUp ? 'Create account' : 'Sign in to workspace'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed font-normal">
              {isSignUp
                ? 'Access multimodal video knowledge extraction and source-grounded exploration.'
                : 'Access your projects, timestamped chapters, transcripts, and grounded notes.'}
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-sm bg-white border border-rose-300 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 bg-white border border-neutral-300 rounded-sm space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-mono text-neutral-500 uppercase mb-1">
                  Full name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Kumar Shaurya"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono text-neutral-500 uppercase mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@vyora.ai"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-neutral-500 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Create account' : 'Sign in'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access & Toggle */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDemoSignIn}
              className="w-full py-2.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-700 hover:text-neutral-950 transition-all flex items-center justify-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Continue as demo guest (Dr. Sarah Chen)</span>
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs font-mono text-neutral-500 hover:text-neutral-950 transition-colors"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Need a new account? Register"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Dark Panel with 3D Particle Sphere */}
      <div className="hidden lg:flex w-1/2 bg-[#0a0a0a] border-l border-neutral-800 relative flex-col items-center justify-center overflow-hidden p-12 text-white">
        <div className="w-[440px] h-[440px] relative">
          <VyoraIntelligenceOrbit
            shape="sphere"
            theme="dark"
            className="w-full h-full"
            interactive={true}
            showOverlay={false}
          />
        </div>

        <div className="text-center z-20 max-w-sm px-4 mt-4 space-y-1.5">
          <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
            [ ARCHITECTURE / MULTIMODAL CORE ]
          </div>
          <h4 className="text-sm font-semibold text-white font-sans">Deterministic schema synthesis</h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Interleaved frame understanding, temporal alignment, and schema-validated JSON intelligence output.
          </p>
        </div>
      </div>
    </div>
  );
};
export default AuthPage;
