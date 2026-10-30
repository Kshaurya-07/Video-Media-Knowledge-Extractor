import React, { useState, useEffect } from 'react';
import { VyoraIntelligenceOrbit } from '../3d/VyoraIntelligenceOrbit';
import { VideoPlayer } from '../VideoPlayer';
import {
  ArrowRight,
  Play,
  MessageSquare,
  Link as LinkIcon,
  Clock,
  Cpu,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { fetchModelStatus, ModelStatusResponse } from '../../lib/api';

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
  const [storyStage, setStoryStage] = useState<1 | 2 | 3 | 4>(1);
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);

  // Demo preview video player time state
  const [demoTime, setDemoTime] = useState(0);

  useEffect(() => {
    fetchModelStatus().then(setModelStatus).catch(() => {});
  }, []);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      onImportUrl(videoUrl.trim());
    } else {
      onGetStarted();
    }
  };

  const storytellingStages = [
    {
      num: 1 as const,
      label: 'STAGE 01',
      title: 'RAW MEDIA',
      headline: 'Every insight begins with a frame.',
      description:
        'Videos contain layers of visual artifacts, dialogue, and temporal context waiting to be unpacked.',
      details:
        'Direct streaming ingestion decomposes video container atoms without loading massive 40MB+ buffers into memory.',
    },
    {
      num: 2 as const,
      label: 'STAGE 02',
      title: 'INTELLIGENCE',
      headline: 'AI connects what it sees and hears.',
      description:
        'Visual information and spoken content become synchronized multimodal signal streams in parallel attention space.',
      details:
        'Gemini 2.0 Flash processes interleaved visual frames and acoustic spectrograms across a 1M token context window.',
    },
    {
      num: 3 as const,
      label: 'STAGE 03',
      title: 'KNOWLEDGE EXTRACTION',
      headline: 'Unstructured media becomes structured knowledge.',
      description:
        'The neural engine isolates executive summaries, chronological chapters, verbatim dialogue, and key entities.',
      details:
        'Three-stage schema-validated extraction guarantees deterministic JSON output with zero data truncation.',
    },
    {
      num: 4 as const,
      label: 'STAGE 04',
      title: 'UNDERSTANDING',
      headline: 'Every moment becomes searchable, navigable and understandable.',
      description:
        'Interact with an interconnected knowledge constellation. Seek to exact timestamps and converse with the source.',
      details:
        'Ask deep questions grounded strictly in the source recording, backed by millisecond-accurate timestamp citations.',
    },
  ];

  const capabilities = [
    {
      index: 'F/01',
      tag: 'SYNTHESIS',
      title: 'Video Understanding',
      desc: 'Understand visual content, presentations, slides, demonstrations, and critical inflection points in full multimodal space.',
    },
    {
      index: 'F/02',
      tag: 'INTELLIGENCE',
      title: 'Smart Summarization',
      desc: 'Transform hours of long-form media into structured executive summaries, key takeaways, and actionable next steps.',
    },
    {
      index: 'F/03',
      tag: 'TEMPORAL',
      title: 'Timestamped Chapters',
      desc: 'Break continuous media into logical, chronological chapters with millisecond-accurate seeking and key moment previews.',
    },
    {
      index: 'F/04',
      tag: 'ACOUSTIC',
      title: 'Transcript & Speech',
      desc: 'Extract exact spoken dialogue, speaker turns, and searchable transcripts synchronized with video playback.',
    },
    {
      index: 'F/05',
      tag: 'EXTRACTION',
      title: 'Key Moments & Entities',
      desc: 'Discover critical concepts, people, and technological entities mentioned throughout the video with frequency scoring.',
    },
    {
      index: 'F/06',
      tag: 'REASONING',
      title: 'Source-Grounded Q&A',
      desc: 'Converse with your video. Ask deep architectural or factual questions and receive verifiable answers with timestamp citations.',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'INGEST',
      subtitle: 'Universal Media Streaming',
      desc: 'Upload MP4, WebM, MOV, or paste a public YouTube URL. Streaming architecture streams directly to disk with zero memory spikes.',
    },
    {
      step: '02',
      title: 'ANALYZE',
      subtitle: 'Multimodal Interleaving',
      desc: 'Gemini 2.0 Flash analyzes visual frames, acoustic waveforms, and OCR text simultaneously within a unified attention manifold.',
    },
    {
      step: '03',
      title: 'STRUCTURE',
      subtitle: 'Modular Schema Synthesis',
      desc: 'Three-stage JSON pipeline extracts executive summaries, timestamped chapters, dialogue segments, and conceptual entities.',
    },
    {
      step: '04',
      title: 'EXPLORE',
      subtitle: 'Interactive AI Studio',
      desc: 'Navigate the video, click chapters to seek instantly, search verbatim dialogue, and query the video through grounded AI chat.',
    },
  ];

  const demoChapters = [
    { start: 0, formatted: '00:00', title: 'Opening & Forest Environment', summary: 'Introduction to the meadow wildlife and opening sequence.' },
    { start: 12, formatted: '00:12', title: 'Awakening & Creature Introductions', summary: 'Big Buck wakes up and interacts with birds and animals.' },
    { start: 24, formatted: '00:24', title: 'The Antagonists Emerge', summary: 'The mischievous rodent trio begins disturbing the peace.' },
  ];

  return (
    <div className="min-h-screen bg-[#030304] text-[#FAFAFA] flex flex-col selection:bg-violet-500/20 selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* 1. SOPHISTICATED ORDO-INSPIRED NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-3.5 backdrop-blur-xl bg-[#030304]/80 border-b border-[#1A1A22]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-7 h-7 rounded-lg bg-[#0A0A0E] border border-[#26262E] flex items-center justify-center group-hover:border-violet-500/50 transition-colors">
              <div className="w-2.5 h-2.5 rounded-full border border-violet-400 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-sm tracking-wider text-white font-mono">
                VYORA
              </span>
              <span className="text-[10px] font-mono text-[#71717A]">
                AI
              </span>
            </div>
          </div>

          {/* Minimal Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-mono text-[#A1A1AA]">
            <a href="#capabilities" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#engine" className="hover:text-white transition-colors">
              Intelligence Engine
            </a>
            <a href="#platform" className="hover:text-white transition-colors">
              Platform
            </a>
            <a href="#experience" className="hover:text-white transition-colors">
              Studio Demo
            </a>
          </div>

          {/* Right Action CTAs & Telemetry */}
          <div className="flex items-center gap-3">
            {/* Live Model Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A0A0E] border border-[#202028] text-[10px] font-mono text-[#71717A]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{modelStatus?.display_model || 'Gemini 2.0 Flash'}</span>
            </div>

            <button
              type="button"
              onClick={onSignIn}
              className="hidden sm:inline-block px-3.5 py-1.5 rounded-xl text-xs font-mono text-[#A1A1AA] hover:text-white hover:bg-[#0E0E14] border border-transparent hover:border-[#26262E] transition-all"
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={onGetStarted}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all shadow-xl shadow-white/5 active:scale-95"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO SECTION — ORDO COMPOSITION WITH INTELLIGENCE ORBIT */}
      {/* ------------------------------------------------------------- */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center bg-grid-pattern">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[720px] h-[380px] bg-violet-600/10 rounded-full blur-[160px] pointer-events-none -z-10" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Editorial Left Hero Column */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Section Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#09090D] border border-[#202028] text-[10px] font-mono tracking-widest text-[#A1A1AA] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              <span>VIDEO INTELLIGENCE / VERSION 1.0</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.06] font-sans">
              Turn every video <br />
              <span className="bg-gradient-to-r from-white via-zinc-200 to-violet-300 bg-clip-text text-transparent">
                into intelligence.
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="text-base text-[#A1A1AA] max-w-lg leading-relaxed font-normal">
              Transform hours of video into structured, searchable knowledge with AI-powered video understanding.
              Upload media or paste a public video link to synthesize summaries, chapters, dialogue, and source-grounded answers.
            </p>

            {/* URL & Ingest Input Bar */}
            <form onSubmit={handleUrlSubmit} className="pt-1 max-w-lg">
              <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-2xl bg-[#09090D] border border-[#202028] shadow-2xl focus-within:border-violet-500/60 transition-all">
                <div className="flex items-center gap-2 px-3 flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-[#52525B] shrink-0" />
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste YouTube URL or open workspace..."
                    className="w-full bg-transparent text-xs text-white placeholder:text-[#52525B] focus:outline-none font-mono py-2"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-md shrink-0"
                >
                  <span>Start Analyzing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Dual CTAs & Telemetry Badge */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onLaunchDemo}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0A0E] hover:bg-[#121218] border border-[#202028] hover:border-zinc-700 text-xs font-mono text-[#D4D4D8] transition-all"
              >
                <Play className="w-3.5 h-3.5 text-violet-400 fill-current" />
                <span>Launch Sample Intelligence</span>
              </button>

              <a
                href="#capabilities"
                className="text-xs font-mono text-[#71717A] hover:text-white transition-colors"
              >
                Explore Platform Capabilities ↓
              </a>
            </div>

            {/* Monospaced Telemetry Row */}
            <div className="pt-4 border-t border-[#1A1A22] flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-mono text-[#52525B]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#A1A1AA]">ENGINE:</span>
                <span className="text-violet-400 font-semibold">{modelStatus?.display_model || 'Gemini 2.0 Flash'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#A1A1AA]">CONTEXT:</span>
                <span>1,048,576 TOKENS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#A1A1AA]">STATUS:</span>
                <span className="text-emerald-400 font-semibold">OPERATIONAL</span>
              </div>
            </div>
          </div>

          {/* Central 3D Intelligence Orbit Graphic */}
          <div className="lg:col-span-6 relative h-[440px] sm:h-[500px] w-full flex items-center justify-center">
            <div className="w-full h-full rounded-3xl border border-[#1A1A22] bg-[#050508]/60 backdrop-blur-sm overflow-hidden relative shadow-2xl">
              <VyoraIntelligenceOrbit scale={1.05} stage={storyStage} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. SECTION 02 — CAPABILITIES (ORDO [ 01 / INTELLIGENCE CAPABILITIES ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="capabilities" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-[#1A1A22]">
        <div className="space-y-4 max-w-2xl mb-14 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
            <span>[ 01 / INTELLIGENCE CAPABILITIES ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
            Everything inside your video. <br />
            <span className="text-[#A1A1AA]">Nothing left unexplored.</span>
          </h2>
          <p className="text-sm text-[#71717A] font-normal leading-relaxed">
            One connected intelligence layer for extracting actionable knowledge from raw media.
          </p>
        </div>

        {/* 6 Capability Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap) => (
            <div
              key={cap.index}
              className="p-6 rounded-2xl bg-[#07070A] border border-[#1C1C24] hover:border-zinc-700 transition-all duration-200 space-y-3 group"
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-violet-400 font-bold">{cap.index}</span>
                <span className="text-[#52525B] px-2 py-0.5 rounded bg-[#101015] border border-[#1E1E26]">
                  {cap.tag}
                </span>
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-violet-200 transition-colors">
                {cap.title}
              </h3>
              <p className="text-xs text-[#71717A] leading-relaxed">
                {cap.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. SECTION 03 — CONNECTED WORKFLOW (ORDO [ 02 / CONNECTED FLOW ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="how-it-works" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-[#1A1A22]">
        <div className="space-y-4 max-w-2xl mb-14 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
            <span>[ 02 / CONNECTED FLOW ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
            From raw video to structured knowledge.
          </h2>
          <p className="text-sm text-[#71717A] leading-relaxed">
            Four synchronized intelligence phases built for fidelity, speed, and zero hallucination.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {workflowSteps.map((ws) => (
            <div
              key={ws.step}
              className="p-6 rounded-2xl bg-[#07070A] border border-[#1C1C24] space-y-3 relative group"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold font-mono text-[#26262E] group-hover:text-violet-500/50 transition-colors">
                  {ws.step}
                </span>
                <span className="text-[10px] font-mono text-[#52525B]">PHASE {ws.step}</span>
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                {ws.title}
              </h3>
              <span className="text-[11px] font-semibold text-violet-400 block">
                {ws.subtitle}
              </span>
              <p className="text-xs text-[#71717A] leading-relaxed">
                {ws.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. SECTION 04 — INTELLIGENCE ENGINE (ORDO [ 03 / SYSTEM STORYTELLING ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="engine" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-[#1A1A22]">
        <div className="space-y-4 max-w-2xl mb-12 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
            <span>[ 03 / INTELLIGENCE ENGINE ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
            Every frame. <br />
            <span className="text-[#A1A1AA]">A deeper understanding.</span>
          </h2>
          <p className="text-sm text-[#71717A] leading-relaxed">
            Observe the architectural journey from raw video frames to an interconnected knowledge constellation.
          </p>
        </div>

        {/* Interactive 4-Stage Cinematic Controller */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Stage Controls & Narrative Cards */}
          <div className="lg:col-span-5 space-y-3">
            {storytellingStages.map((stg) => {
              const isSelected = storyStage === stg.num;
              return (
                <div
                  key={stg.num}
                  onClick={() => setStoryStage(stg.num)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-[#0E0E14] border-violet-500/60 shadow-lg'
                      : 'bg-[#060608] border-[#1C1C24] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                    <span className={isSelected ? 'text-violet-400 font-bold' : 'text-[#52525B]'}>
                      {stg.label} · {stg.title}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {stg.headline}
                  </h4>
                  <p className="text-xs text-[#71717A] leading-relaxed">
                    {stg.description}
                  </p>
                  {isSelected && (
                    <p className="text-[11px] font-mono text-[#A1A1AA] pt-2 border-t border-[#1F1F2A] mt-2">
                      {stg.details}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Synchronized 3D Stage Canvas */}
          <div className="lg:col-span-7 h-[420px] sm:h-[480px] rounded-3xl border border-[#1C1C24] bg-[#050508] relative overflow-hidden shadow-2xl">
            <VyoraIntelligenceOrbit stage={storyStage} scale={1.1} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. SECTION 05 — PLATFORM CAPABILITIES (ORDO [ 04 / PLATFORM ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="platform" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-[#1A1A22]">
        <div className="space-y-4 max-w-2xl mb-14 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
            <span>[ 04 / PLATFORM SPECIFICATIONS ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
            Built to understand the media you work with.
          </h2>
          <p className="text-sm text-[#71717A] leading-relaxed">
            Real, deployed capabilities powering the VYORA video intelligence architecture.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="p-6 rounded-2xl bg-[#07070A] border border-[#1C1C24] space-y-3">
            <Globe className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Universal Media Ingestion</h3>
            <p className="text-xs text-[#71717A] leading-relaxed">
              Native support for MP4, WebM, MOV, MKV, AVI, TS files, and public YouTube URLs. Direct byte streaming preserves server memory.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#07070A] border border-[#1C1C24] space-y-3">
            <Cpu className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Intelligent Model Failover</h3>
            <p className="text-xs text-[#71717A] leading-relaxed">
              Official Gemini 2.0 Flash engine with automatic backoff and failover to Gemini 1.5 Flash. Uploaded file state is 100% preserved.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#07070A] border border-[#1C1C24] space-y-3">
            <Clock className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Timestamp Seeking & Sync</h3>
            <p className="text-xs text-[#71717A] leading-relaxed">
              Clickable chapter and key moment seeking. Synchronizes active video playback with transcript dialogue and spatial timeline.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. SECTION 06 — INTERACTIVE STUDIO EXPERIENCE (ORDO [ 05 / EXPERIENCE ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="experience" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-[#1A1A22]">
        <div className="space-y-4 max-w-2xl mb-12 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
            <span>[ 05 / STUDIO EXPERIENCE ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-sans">
            See what your video contains.
          </h2>
          <p className="text-sm text-[#71717A] leading-relaxed">
            Test the live studio interface. Click any chapter below to seek the video player to that timestamp.
          </p>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="p-4 sm:p-6 rounded-3xl bg-[#060609] border border-[#1F1F28] shadow-2xl space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Player Preview (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <VideoPlayer
                src="backend/samples/big_buck_bunny.mp4"
                mediaType="video"
                title="Big Buck Bunny (Sample Analysis)"
                onTimeUpdate={(t) => setDemoTime(t)}
              />
              <div className="p-4 rounded-2xl bg-[#09090D] border border-[#1A1A22] text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-violet-400 uppercase tracking-widest">
                    Live Synthesis Output
                  </span>
                  <span className="text-[10px] font-mono text-[#71717A]">
                    T = {Math.floor(demoTime / 60)}:{String(Math.floor(demoTime % 60)).padStart(2, '0')}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1">Executive Summary</h4>
                <p className="text-xs text-[#71717A] leading-relaxed mt-1">
                  An open-source computer-animated comedy film highlighting visual frame segmentation, character interactions, and acoustic soundtrack dynamics.
                </p>
              </div>
            </div>

            {/* Chapters & Dialogue (5 cols) */}
            <div className="lg:col-span-5 space-y-3 text-left">
              <span className="text-[10px] font-mono text-[#71717A] uppercase tracking-wider block">
                Timestamped Chapters (Click to Seek)
              </span>

              <div className="space-y-2">
                {demoChapters.map((ch, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-[#09090D] border border-[#1C1C24] hover:border-violet-500/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-white">{ch.title}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#13131A] text-violet-300">
                        {ch.formatted}
                      </span>
                    </div>
                    <p className="text-xs text-[#71717A] leading-relaxed">{ch.summary}</p>
                  </div>
                ))}
              </div>

              {/* Grounded Q&A Preview */}
              <div className="p-3.5 rounded-xl bg-[#09090D] border border-[#1C1C24] space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-mono text-violet-400">
                  <MessageSquare className="w-3 h-3" />
                  <span>GROUNDED AI Q&A CITATION</span>
                </div>
                <p className="text-xs text-[#D4D4D8] italic">
                  "At timestamp [00:12], the protagonist wakes up in the meadow and greets the forest wildlife."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. SECTION 07 — FINAL CALL TO ACTION (ORDO CLOSING) */}
      {/* ------------------------------------------------------------- */}
      <section className="py-24 px-6 max-w-5xl mx-auto w-full border-t border-[#1A1A22] text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A0A0E] border border-[#202028] text-[10px] font-mono text-[#A1A1AA] uppercase tracking-widest">
          <span>AI INFRASTRUCTURE</span>
        </div>

        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white font-sans">
          Your videos. <br />
          <span className="text-[#A1A1AA]">Fully understood.</span>
        </h2>

        <p className="text-sm text-[#71717A] max-w-md mx-auto leading-relaxed">
          Turn hours of video into structured knowledge you can explore, search, and understand.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-xl shadow-white/5"
          >
            <span>Start Analyzing</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. SECTION 08 — MINIMAL FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="mt-auto py-12 px-6 border-t border-[#1A1A22] bg-[#020203]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[#52525B] font-mono">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white">VYORA AI</span>
            <span>·</span>
            <span>AI-Powered Video & Media Knowledge Extractor</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/Kshaurya-07/Video-Media-Knowledge-Extractor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>·</span>
            <span>MIT License</span>
            <span>·</span>
            <span className="text-violet-400">Google Gemini 2.0 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
};