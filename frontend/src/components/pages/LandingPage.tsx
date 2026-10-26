import React, { useState } from 'react';
import { VyoraKnowledgeCore } from '../3d/VyoraKnowledgeCore';
import {
  ArrowRight,
  Play,
  Search,
  Bookmark,
  MessageSquare,
  Layers,
  FileText,
  Link as LinkIcon,
  Cpu,
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLaunchDemo: () => void;
  onSignIn: () => void;
  onImportUrl: (url: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onLaunchDemo,
  onSignIn,
  onImportUrl,
}) => {
  const [videoUrl, setVideoUrl] = useState('');

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      onImportUrl(videoUrl.trim());
    } else {
      onGetStarted();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#FAFAFA] flex flex-col selection:bg-violet-500/30 selection:text-violet-200">
      {/* 1. Cinematic Floating Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-xl bg-[#050505]/75 border-b border-[#27272A]/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo with geometric core symbol */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-800 to-black border border-zinc-700/80 flex items-center justify-center shadow-lg relative group">
              <div className="absolute inset-0 rounded-xl bg-violet-600/20 blur group-hover:bg-violet-600/40 transition-colors" />
              <div className="relative w-4 h-4 rounded-full border border-violet-400 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
              </div>
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white font-sans">
                VYORA<span className="text-violet-400">.AI</span>
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-[#A1A1AA]">
            <a href="#features" className="hover:text-white transition-colors">
              Platform Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#preview" className="hover:text-white transition-colors">
              Workspace Preview
            </a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Section with 3D Knowledge Core */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 px-6 max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center">
        {/* Ambient Dark Atmospheric Illumination */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Editorial Left Column */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111111] border border-[#27272A] text-xs font-mono text-[#D4D4D8]">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span>AI VIDEO INTELLIGENCE PLATFORM</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#FAFAFA] leading-[1.08]">
              Every Video Holds a{' '}
              <span className="bg-gradient-to-r from-white via-zinc-200 to-violet-400 bg-clip-text text-transparent">
                Universe of Knowledge.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#A1A1AA] max-w-xl font-normal leading-relaxed">
              Transform hours of video into searchable chapters, meaningful insights, and answers
              linked directly to their source.
            </p>

            {/* Quick Action Input Bar */}
            <form onSubmit={handleUrlSubmit} className="pt-2 max-w-xl">
              <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-1.5 rounded-2xl bg-[#111111] border border-[#27272A] shadow-2xl focus-within:border-violet-500/70 transition-all">
                <div className="flex items-center gap-2 px-3 flex-1">
                  <LinkIcon className="w-4 h-4 text-[#71717A] shrink-0" />
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste a supported video link or upload your media..."
                    className="w-full py-2 bg-transparent text-xs text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md shrink-0"
                >
                  <span>Explore Your Knowledge</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Secondary CTA buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                onClick={onLaunchDemo}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#151515] border border-[#27272A] text-xs font-medium text-[#D4D4D8] transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-violet-400 fill-violet-400/20" />
                <span>Launch Interactive Demo Keynote</span>
              </button>
              <a
                href="#how-it-works"
                className="text-xs text-[#71717A] hover:text-[#FAFAFA] font-medium transition-colors"
              >
                See How It Works →
              </a>
            </div>
          </div>

          {/* Signature 3D Knowledge Core Right Column */}
          <div className="lg:col-span-5 flex items-center justify-center relative">
            <div className="w-full max-w-[440px] aspect-square relative flex items-center justify-center">
              <VyoraKnowledgeCore
                className="w-full h-full min-h-[380px]"
                interactive={true}
                scale={1.05}
                glowColor="#8B5CF6"
              />
              <div className="absolute -bottom-2 text-center pointer-events-none">
                <span className="text-[10px] font-mono tracking-widest text-[#71717A] uppercase bg-[#050505]/80 px-3 py-1 rounded-full border border-[#27272A]">
                  Rotate Core • Multimodal Intelligence
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Feature Section Grid */}
      <section id="features" className="py-24 px-6 border-t border-[#27272A]/70 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest text-violet-400">
              System Architecture & Capabilities
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Engineered for Cognitive Clarity
            </h2>
            <p className="text-sm text-[#A1A1AA]">
              Every module is designed to eliminate cognitive friction and convert passive viewing
              into searchable intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-3xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 transition-all group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Intelligent Summaries</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Multi-paragraph executive synthesis highlighting core arguments, conclusions, and
                contextual nuances without information loss.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-3xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 transition-all group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                <Bookmark className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Searchable Chapters</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Autonomous thematic boundary detection dividing long lectures and keynotes into
                exact chronological, seekable segments.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-3xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 transition-all group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Source-Linked Answers</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Conversational RAG assistant grounded directly in the video. Clickable citations
                jump the player directly to the exact millisecond.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-3xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 transition-all group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Timestamped Transcripts</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Sub-second speech-to-text with speaker identification, keyword filtering, and
                continuous playback synchronization.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-3xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 transition-all group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Visual Scene & OCR Analysis</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Recognizes architecture diagrams, IDE code editors, and presentation slides,
                extracting on-screen code and bullet points.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-3xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 transition-all group space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 group-hover:scale-105 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Smart Notes & Bookmarks</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Capture thoughts with timestamp pinning, export reports to clean Markdown or JSON,
                and curate your personal knowledge library.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works (3 Steps) */}
      <section id="how-it-works" className="py-24 px-6 border-t border-[#27272A]/70 bg-[#050505]">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest text-violet-400">
              Pipeline Execution
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Three Steps to Deep Knowledge
            </h2>
            <p className="text-sm text-[#A1A1AA]">
              Effortlessly convert hours of complex media into interactive cognitive maps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-[#27272A] space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-[#151515] border border-zinc-800 flex items-center justify-center text-xs font-mono text-violet-400 font-bold">
                01
              </div>
              <h3 className="text-lg font-bold text-white">Import Your Video</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Upload your MP4, WebM, MOV, or audio recording, or paste any supported video link.
                Files are validated and securely streamed.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-[#27272A] space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-[#151515] border border-zinc-800 flex items-center justify-center text-xs font-mono text-violet-400 font-bold">
                02
              </div>
              <h3 className="text-lg font-bold text-white">Extract Its Intelligence</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Multimodal reasoning analyzes audio, speech patterns, and visual frames in an
                interleaved attention space via Gemini 3.8 Flash.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-[#0A0A0A] border border-[#27272A] space-y-4 relative">
              <div className="w-10 h-10 rounded-xl bg-[#151515] border border-zinc-800 flex items-center justify-center text-xs font-mono text-violet-400 font-bold">
                03
              </div>
              <h3 className="text-lg font-bold text-white">Explore Every Insight</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                Navigate timestamped chapters, search verbatim dialogue, explore 3D knowledge maps,
                and converse with source-grounded citations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Interactive Product Preview */}
      <section id="preview" className="py-24 px-6 border-t border-[#27272A]/70 bg-[#0A0A0A]">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] bg-[#151515] px-2.5 py-1 rounded-full border border-[#27272A]">
                Sample Workspace Preview (Simulated Content)
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-2">
                The AI Video Workspace in Action
              </h2>
            </div>
            <button
              onClick={onLaunchDemo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all shadow-lg shadow-violet-600/25"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Live Interactive Experience</span>
            </button>
          </div>

          {/* Mock Workspace Container */}
          <div className="rounded-3xl bg-[#050505] border border-[#27272A] shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-[#71717A] ml-2">
                  Keynote: Architecting Real-Time Multimodal AI Systems [Sample Preview]
                </span>
              </div>
              <span className="text-xs font-mono text-violet-400">Duration: 00:45</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column Preview */}
              <div className="md:col-span-4 space-y-3">
                <div className="text-xs font-semibold text-[#D4D4D8]">Chapters (4 Detected)</div>
                <div className="p-3 rounded-2xl bg-[#111111] border border-violet-500/40 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">01. Evolution of Multimodal AI</span>
                    <span className="font-mono text-violet-400">00:00</span>
                  </div>
                  <p className="text-[11px] text-[#A1A1AA]">Comparison of cascading ASR/OCR vs. unified models.</p>
                </div>
                <div className="p-3 rounded-2xl bg-[#0A0A0A] border border-[#27272A] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#A1A1AA]">02. Core Architecture</span>
                    <span className="font-mono text-[#71717A]">00:12</span>
                  </div>
                  <p className="text-[11px] text-[#71717A]">Direct video ingestion and tokenization.</p>
                </div>
              </div>

              {/* Center Column Preview */}
              <div className="md:col-span-5 space-y-4">
                <div className="aspect-video rounded-2xl bg-[#111111] border border-[#27272A] flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-3">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                  <p className="text-xs font-semibold text-white">Synchronized Media Player</p>
                  <p className="text-[10px] text-[#71717A] mt-1">HTTP 206 Partial Content Range Streaming</p>
                </div>
              </div>

              {/* Right Column Preview */}
              <div className="md:col-span-3 space-y-3">
                <div className="text-xs font-semibold text-[#D4D4D8]">Ask AI with Citations</div>
                <div className="p-3 rounded-2xl bg-[#111111] border border-[#27272A] text-xs space-y-2">
                  <p className="text-[#A1A1AA]">"What latency drop was achieved?"</p>
                  <div className="p-2 rounded-xl bg-[#050505] border border-zinc-800 text-[11px] text-[#D4D4D8]">
                    Latency dropped from 4.2s to 850ms when caching context.
                    <div className="mt-1.5 inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                      Citation: [00:31]
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Final CTA */}
      <section className="py-24 px-6 border-t border-[#27272A]/70 bg-[#050505] text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-violet-600/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="max-w-3xl mx-auto space-y-6 relative">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Stop Searching Through Hours.
            <br />
            <span className="text-violet-400">Start Finding Answers.</span>
          </h2>
          <p className="text-sm sm:text-base text-[#A1A1AA] max-w-xl mx-auto">
            Experience the intelligence of VYORA AI today. Free to get started with zero complex setup.
          </p>
          <div className="pt-2 flex items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-xl"
            >
              <span>Start Exploring</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onLaunchDemo}
              className="px-6 py-3.5 rounded-2xl bg-[#111111] hover:bg-[#151515] border border-[#27272A] text-xs font-semibold text-[#D4D4D8] transition-colors"
            >
              Launch Demo
            </button>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="py-12 px-6 border-t border-[#27272A] bg-[#050505] text-xs text-[#71717A]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">VYORA AI</span>
            <span>•</span>
            <span>Video & Media Knowledge Intelligence</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/Kshaurya-07/Video-Media-Knowledge-Extractor" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              GitHub Repository
            </a>
            <span className="text-[#27272A]">|</span>
            <span>MIT License</span>
            <span className="text-[#27272A]">|</span>
            <span>Google Gemini 3.8 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
