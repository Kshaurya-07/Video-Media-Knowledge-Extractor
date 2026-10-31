import React, { useState, useEffect, useRef } from 'react';
import { VyoraIntelligenceOrbit } from '../3d/VyoraIntelligenceOrbit';
import { ScrollParticlePhases } from '../ScrollParticlePhases';
import { LatencyChart } from '../LatencyChart';
import { VideoPlayer } from '../VideoPlayer';
import {
  ArrowRight,
  Play,
  MessageSquare,
  Link as LinkIcon,
  Clock,
  Globe,
  ExternalLink,
  ShieldCheck,
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
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);
  const [activeFlowStep, setActiveFlowStep] = useState<number>(0);
  const flowSectionRef = useRef<HTMLDivElement>(null);

  // Demo preview video player time state
  const [demoTime, setDemoTime] = useState(0);

  useEffect(() => {
    fetchModelStatus().then(setModelStatus).catch(() => {});
  }, []);

  // Advance flow section on scroll through flow section
  useEffect(() => {
    const handleScroll = () => {
      const el = flowSectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      if (rect.top < windowHeight * 0.7 && rect.bottom > 0) {
        const progress = Math.max(0, Math.min(1, (windowHeight * 0.7 - rect.top) / rect.height));
        const step = Math.min(3, Math.floor(progress * 4));
        setActiveFlowStep(step);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (videoUrl.trim()) {
      onImportUrl(videoUrl.trim());
    } else {
      onGetStarted();
    }
  };

  const capabilities = [
    {
      index: '01',
      tag: 'SYNTHESIS',
      title: 'Video understanding',
      desc: 'Process visual frames, demonstrations, and presentations with native multimodal transformer attention.',
    },
    {
      index: '02',
      tag: 'INTELLIGENCE',
      title: 'Structured summaries',
      desc: 'Synthesize comprehensive executive summaries, core takeaways, and actionable next steps.',
    },
    {
      index: '03',
      tag: 'TEMPORAL',
      title: 'Timestamped chapters',
      desc: 'Segment long media into logical chapters with start and end boundaries and key moment previews.',
    },
    {
      index: '04',
      tag: 'ACOUSTIC',
      title: 'Verbatim transcript',
      desc: 'Extract synchronized dialogue, speaker labels, and searchable text mapped to video playback.',
    },
    {
      index: '05',
      tag: 'EXTRACTION',
      title: 'Entities and concepts',
      desc: 'Index key technologies, people, organizations, and concepts mentioned across the video.',
    },
    {
      index: '06',
      tag: 'REASONING',
      title: 'Source-grounded Q&A',
      desc: 'Converse with your video. Ask deep architectural questions and receive answers cited with timestamps.',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Ingest',
      shape: 'knot' as const,
      subtitle: 'Universal media streaming',
      desc: 'Upload files up to 500 MB (MP4, WebM, MOV) or supply a public URL. Streams direct to disk with zero memory spikes.',
    },
    {
      step: '02',
      title: 'Analyze',
      shape: 'cloud' as const,
      subtitle: 'Multimodal interleaving',
      desc: 'Gemini 2.0 Flash processes visual frames and acoustic spectrograms in parallel across a 1M token context window.',
    },
    {
      step: '03',
      title: 'Structure',
      shape: 'sphere' as const,
      subtitle: 'Modular schema extraction',
      desc: 'Three-stage schema validation isolates summaries, chronological chapters, transcripts, and semantic entities.',
    },
    {
      step: '04',
      title: 'Explore',
      shape: 'torus' as const,
      subtitle: 'Interactive intelligence studio',
      desc: 'Navigate timestamped chapters, search verbatim dialogue, explore spatial timelines, and query with grounded Q&A.',
    },
  ];

  const demoChapters = [
    { start: 0, formatted: '00:00', title: 'Opening & forest environment', summary: 'Introduction to the meadow wildlife and opening sequence.' },
    { start: 12, formatted: '00:12', title: 'Creature introductions', summary: 'Big Buck wakes up and interacts with forest birds.' },
    { start: 24, formatted: '00:24', title: 'The antagonists emerge', summary: 'The mischievous rodent trio disturbs the peaceful meadow.' },
  ];

  return (
    <div className="min-h-screen bg-[#f1f1ef] text-neutral-950 flex flex-col font-sans selection:bg-neutral-950 selection:text-white">
      {/* ------------------------------------------------------------- */}
      {/* 1. MINIMAL HAIRLINE NAVIGATION */}
      {/* ------------------------------------------------------------- */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-3.5 backdrop-blur-md bg-[#f1f1ef]/85 border-b border-neutral-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Mark */}
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-5 h-5 rounded-full border border-neutral-950 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-sm tracking-wider text-neutral-950">
                VYORA
              </span>
              <span className="font-mono text-[10px] text-neutral-400">
                AI
              </span>
            </div>
          </div>

          {/* Minimal Nav Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-mono text-neutral-600">
            <a href="#capabilities" className="hover:text-neutral-950 transition-colors">
              Capabilities
            </a>
            <a href="#flow" className="hover:text-neutral-950 transition-colors">
              Flow
            </a>
            <a href="#architecture" className="hover:text-neutral-950 transition-colors">
              Architecture
            </a>
            <a href="#latency" className="hover:text-neutral-950 transition-colors">
              Latency
            </a>
            <a href="#demo" className="hover:text-neutral-950 transition-colors">
              Studio demo
            </a>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Live Model Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white border border-neutral-300 text-[10px] font-mono text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
              <span>{modelStatus?.display_model || 'Gemini 2.0 Flash'}</span>
            </div>

            <button
              type="button"
              onClick={onSignIn}
              className="hidden sm:inline-block px-3 py-1.5 rounded-sm text-xs font-mono text-neutral-600 hover:text-neutral-950 hover:bg-white border border-transparent hover:border-neutral-300 transition-all"
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={onGetStarted}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-neutral-950 text-white hover:bg-neutral-800 transition-all"
            >
              <span>Open workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------- */}
      {/* 2. HERO SECTION — ORDO COMPOSITION WITH MONOCHROME PARTICLE KNOT */}
      {/* ------------------------------------------------------------- */}
      <section className="relative pt-32 pb-16 md:pt-40 md:pb-24 px-6 max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center grid-paper-light">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Editorial Left Hero Column */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Section Tag */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-white border border-neutral-300 text-[10px] font-mono tracking-widest text-neutral-600 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
              <span>VIDEO INTELLIGENCE / 1.0</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-950 leading-[1.06] font-sans">
              Turn every video <br />
              <span className="font-mono font-normal text-neutral-400">
                into structured intelligence.
              </span>
            </h1>

            {/* Supporting Description */}
            <p className="text-base text-neutral-600 max-w-lg leading-relaxed font-normal">
              Transform hours of video into structured, searchable knowledge with native multimodal understanding.
              Upload media or paste a public video link to extract summaries, chapters, dialogue, and timestamped answers.
            </p>

            {/* URL Input Bar (Full Pill) */}
            <form onSubmit={handleUrlSubmit} className="pt-1 max-w-lg">
              <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 rounded-full bg-white border border-neutral-300 focus-within:border-neutral-950 transition-all">
                <div className="flex items-center gap-2 px-3 flex-1">
                  <LinkIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste YouTube or media URL..."
                    className="w-full bg-transparent text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none font-mono py-2"
                  />
                </div>
                <button
                  type="submit"
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium transition-all shrink-0"
                >
                  <span>Start extracting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Dual Actions & Quick Sample Link */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={onLaunchDemo}
                className="flex items-center gap-2 px-4 py-2 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-800 transition-all"
              >
                <Play className="w-3.5 h-3.5 text-neutral-950 fill-current" />
                <span>Launch sample intelligence</span>
              </button>

              <a
                href="#capabilities"
                className="text-xs font-mono text-neutral-500 hover:text-neutral-950 transition-colors"
              >
                Explore capabilities ↓
              </a>
            </div>

            {/* Monospaced Fact Telemetry */}
            <div className="pt-4 border-t border-neutral-300 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-mono text-neutral-500">
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400">ENGINE:</span>
                <span className="text-neutral-950 font-semibold">{modelStatus?.display_model || 'Gemini 2.0 Flash'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400">CONTEXT:</span>
                <span className="text-neutral-950 font-semibold">1,048,576 TOKENS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400">LIMIT:</span>
                <span className="text-neutral-950 font-semibold">500 MB STREAMING</span>
              </div>
            </div>
          </div>

          {/* Central 3D Particle Knot Graphic (Cursor Responsive & Click Morph) */}
          <div className="lg:col-span-6 relative h-[420px] sm:h-[480px] w-full flex items-center justify-center">
            <div className="w-full h-full rounded-sm border border-neutral-300 bg-white overflow-hidden relative">
              <VyoraIntelligenceOrbit
                scale={1.05}
                theme="light"
                interactive={true}
                showOverlay={true}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. CAPABILITIES GRID ([ 01 / INTELLIGENCE CAPABILITIES ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="capabilities" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-neutral-300">
        <div className="space-y-3 max-w-2xl mb-14 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            <span>[ 01 / INTELLIGENCE CAPABILITIES ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 font-sans">
            Everything inside your video. <br />
            <span className="font-mono font-normal text-neutral-400">Nothing left unexplored.</span>
          </h2>
          <p className="text-sm text-neutral-600 font-normal leading-relaxed">
            One connected intelligence layer for extracting actionable knowledge from raw media.
          </p>
        </div>

        {/* 6 Bento Grid Cells (White panels, hairline borders, sharp corners) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap) => (
            <div
              key={cap.index}
              className="p-6 rounded-sm bg-white border border-neutral-300 hover:border-neutral-500 transition-colors text-left space-y-3"
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-neutral-950 font-bold">{cap.index}</span>
                <span className="text-neutral-500 px-2 py-0.5 rounded-sm bg-neutral-100 border border-neutral-200">
                  {cap.tag}
                </span>
              </div>
              <h3 className="text-base font-bold text-neutral-950">
                {cap.title}
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                {cap.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. CONNECTED FLOW ([ 02 / CONNECTED FLOW ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="flow" ref={flowSectionRef} className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-neutral-300">
        <div className="space-y-3 max-w-2xl mb-14 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            <span>[ 02 / CONNECTED FLOW ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 font-sans">
            From raw video to structured knowledge.
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Four synchronized intelligence phases built for fidelity, speed, and zero hallucination. Advances as you scroll or click.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {workflowSteps.map((ws, idx) => {
            const isSelected = activeFlowStep === idx;
            return (
              <div
                key={ws.step}
                onClick={() => setActiveFlowStep(idx)}
                className={`p-6 rounded-sm border cursor-pointer transition-all text-left flex flex-col justify-between relative overflow-hidden min-h-[220px] ${
                  isSelected
                    ? 'bg-white border-neutral-950 ring-1 ring-neutral-950'
                    : 'bg-white border-neutral-300 hover:border-neutral-400'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold font-mono text-neutral-950">
                      {ws.step}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400">PHASE {ws.step}</span>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-950 font-mono">
                    {ws.title}
                  </h3>
                  <span className="text-[11px] font-semibold text-neutral-600 block">
                    {ws.subtitle}
                  </span>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    {ws.desc}
                  </p>
                </div>

                {/* Bottom-right interactive 3D particle wireframe for each stage */}
                <div className="absolute bottom-2 right-2 w-16 h-16 pointer-events-none opacity-80">
                  <VyoraIntelligenceOrbit
                    shape={ws.shape}
                    interactive={false}
                    showOverlay={false}
                    theme="light"
                    scale={0.7}
                    className="w-full h-full min-h-0"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. STICKY 300VH SCROLL PARTICLE STORY ([ 03 / SYSTEM STORYTELLING ]) */}
      {/* ------------------------------------------------------------- */}
      <div id="architecture">
        <ScrollParticlePhases />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. LATENCY & PROOF SECTION ([ 04 / PLATFORM VERIFICATION ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="latency" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-neutral-300">
        <div className="space-y-3 max-w-2xl mb-12 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            <span>[ 04 / PLATFORM SPECIFICATIONS ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 font-sans">
            Built to understand the media you work with.
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Real architectural facts verified against the repository implementation. Explore benchmark metrics over time below.
          </p>
        </div>

        {/* Interactive Latency-Style Chart Component */}
        <div className="space-y-6">
          <LatencyChart />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-6 rounded-sm bg-white border border-neutral-300 space-y-3">
              <Globe className="w-5 h-5 text-neutral-950" />
              <h3 className="text-sm font-bold text-neutral-950">Universal media ingestion</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Native streaming support for MP4, WebM, MOV, MKV, AVI, TS containers, and YouTube streams. Direct 64KB disk chunking prevents memory spikes.
              </p>
            </div>

            <div className="p-6 rounded-sm bg-white border border-neutral-300 space-y-3">
              <ShieldCheck className="w-5 h-5 text-neutral-950" />
              <h3 className="text-sm font-bold text-neutral-950">SSRF & network safety</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Strict peer IP verification, private IP rejection, metadata endpoint guards, and maximum 3 redirect hops keep your worker infrastructure secure.
              </p>
            </div>

            <div className="p-6 rounded-sm bg-white border border-neutral-300 space-y-3">
              <Clock className="w-5 h-5 text-neutral-950" />
              <h3 className="text-sm font-bold text-neutral-950">Millisecond timestamp sync</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Every chapter, key moment, dialogue segment, and AI citation links directly to non-negative [MM:SS] timestamps for instant seek and verification.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. INTERACTIVE STUDIO DEMO ([ 05 / STUDIO DEMO ]) */}
      {/* ------------------------------------------------------------- */}
      <section id="demo" className="py-24 px-6 max-w-7xl mx-auto w-full border-t border-neutral-300">
        <div className="space-y-3 max-w-2xl mb-12 text-left">
          <div className="inline-flex items-center gap-2 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            <span>[ 05 / STUDIO DEMO ]</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 font-sans">
            See what your video contains.
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Test the live studio interface. Click any chapter below to seek the video player to that timestamp.
          </p>
        </div>

        {/* Live Interactive Preview Box */}
        <div className="p-4 sm:p-6 rounded-sm bg-white border border-neutral-300 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Player Preview (7 cols) */}
            <div className="lg:col-span-7 space-y-3">
              <VideoPlayer
                src="backend/samples/big_buck_bunny.mp4"
                mediaType="video"
                title="Big Buck Bunny (Sample Analysis)"
                onTimeUpdate={(t) => setDemoTime(t)}
              />
              <div className="p-4 rounded-sm bg-neutral-50 border border-neutral-200 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-950 uppercase tracking-widest font-semibold">
                    Live synthesis output
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    T = {Math.floor(demoTime / 60)}:{String(Math.floor(demoTime % 60)).padStart(2, '0')}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-neutral-950 mt-1">Executive summary</h4>
                <p className="text-xs text-neutral-600 leading-relaxed mt-1">
                  An open-source computer-animated comedy film highlighting visual frame segmentation, character interactions, and acoustic soundtrack dynamics.
                </p>
              </div>
            </div>

            {/* Chapters & Dialogue (5 cols) */}
            <div className="lg:col-span-5 space-y-3 text-left">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">
                Timestamped chapters (Click to seek)
              </span>

              <div className="space-y-2">
                {demoChapters.map((ch, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      // Seek player if available
                      const videoEl = document.querySelector('video');
                      if (videoEl) videoEl.currentTime = ch.start;
                    }}
                    className="p-3.5 rounded-sm bg-white border border-neutral-300 hover:border-neutral-950 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-neutral-950">{ch.title}</span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-neutral-100 text-neutral-950 font-semibold border border-neutral-200">
                        {ch.formatted}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">{ch.summary}</p>
                  </div>
                ))}
              </div>

              {/* Grounded Q&A Preview */}
              <div className="p-3.5 rounded-sm bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-950 font-semibold">
                  <MessageSquare className="w-3 h-3 text-neutral-950" />
                  <span>GROUNDED AI Q&A CITATION</span>
                </div>
                <p className="text-xs text-neutral-700 italic">
                  "At timestamp [00:12], the protagonist wakes up in the meadow and greets the forest wildlife."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. CLOSING CALL TO ACTION */}
      {/* ------------------------------------------------------------- */}
      <section className="py-24 px-6 max-w-5xl mx-auto w-full border-t border-neutral-300 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-white border border-neutral-300 text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
          <span>AI INFRASTRUCTURE</span>
        </div>

        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-neutral-950 font-sans">
          Your videos. <br />
          <span className="font-mono font-normal text-neutral-400">Fully understood.</span>
        </h2>

        <p className="text-sm text-neutral-600 max-w-md mx-auto leading-relaxed">
          Turn hours of video into structured knowledge you can explore, search, and understand.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium transition-all"
          >
            <span>Start extracting</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. MINIMAL FOOTER */}
      {/* ------------------------------------------------------------- */}
      <footer className="mt-auto py-12 px-6 border-t border-neutral-300 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-neutral-500 font-mono">
          <div className="flex items-center gap-3">
            <span className="font-bold text-neutral-950">VYORA AI</span>
            <span>·</span>
            <span>AI-Powered Video & Media Knowledge Extractor</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/Kshaurya-07/Video-Media-Knowledge-Extractor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-neutral-950 transition-colors flex items-center gap-1"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span>·</span>
            <span>MIT License</span>
            <span>·</span>
            <span className="text-neutral-950 font-semibold">Gemini 2.0 Flash</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
