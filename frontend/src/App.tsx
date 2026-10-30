import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/pages/LandingPage';
import { AuthPage } from './components/pages/AuthPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { ImportPage } from './components/pages/ImportPage';
import { WorkspacePage } from './components/pages/WorkspacePage';
import { LibraryPage } from './components/pages/LibraryPage';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { ModelStatusModal } from './components/ModelStatusModal';

import { MediaAnalysisResult } from './lib/types';
import {
  getStoredApiKey,
  getStoredUser,
  setStoredUser,
  fetchProjectDetails,
  fetchSystemConfig,
  fetchModelStatus,
  probeBackendWithBackoff,
  SystemConfig,
  ModelStatusResponse,
  BackendConnectionState,
} from './lib/api';

import {
  LayoutDashboard,
  Video,
  Layers,
  FileText,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Compass,
  Cpu,
  RefreshCw,
} from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & Page routing
  const [currentPage, setCurrentPage] = useState<
    'landing' | 'auth' | 'dashboard' | 'import' | 'workspace' | 'library'
  >('landing');

  // User session
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  // Active Project for Workspace
  const [activeAnalysis, setActiveAnalysis] = useState<MediaAnalysisResult | null>(null);

  // Sidebar collapsed state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [serverKeyConfigured, setServerKeyConfigured] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [connectionState, setConnectionState] = useState<BackendConnectionState>('checking');
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatusResponse | null>(null);

  const refreshStatus = () => {
    const storedKey = getStoredApiKey();
    if (storedKey) {
      setHasApiKey(true);
    }

    fetchModelStatus().then((ms) => {
      setModelStatus(ms);
      if (ms.status !== 'offline') {
        setConnectionState('connected');
      }
      if (ms.server_api_key_configured) {
        setServerKeyConfigured(true);
        setHasApiKey(true);
      } else if (ms.has_api_key || storedKey) {
        setHasApiKey(true);
      }
    });

    fetchSystemConfig().then((cfg) => {
      setSystemConfig(cfg);
      if (cfg.status !== 'offline') {
        setConnectionState('connected');
      }
      if (cfg.server_api_key_configured) {
        setServerKeyConfigured(true);
        setHasApiKey(true);
      } else if (cfg.has_api_key_configured || storedKey) {
        setHasApiKey(true);
      }
    });
  };

  // Initial session & key hydration with Render Free Tier cold-start awareness
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);

    const storedKey = getStoredApiKey();
    if (storedKey) setHasApiKey(true);

    probeBackendWithBackoff((state) => {
      setConnectionState(state);
    }).then((isAvailable) => {
      if (isAvailable) {
        setConnectionState('connected');
        refreshStatus();
      } else {
        setConnectionState('offline');
      }
    });

    // Support query parameter routing for direct navigation and preview
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam === 'workspace' || params.get('demo') === 'true') {
      handleOpenProject('demo_presentation');
    } else if (pageParam && ['landing', 'auth', 'dashboard', 'import', 'library'].includes(pageParam)) {
      setCurrentPage(pageParam as any);
    }
  }, []);

  const DEFAULT_DEMO_PROJECT: MediaAnalysisResult = {
    file_id: 'demo_presentation',
    filename: 'multimodal_foundation_models.mp4',
    title: 'Multimodal Foundation Models & Temporal Perception',
    duration_seconds: 482,
    duration_formatted: '08:02',
    media_type: 'video',
    overview: 'A deep-dive technical symposium exploring native audio-visual tokenization, cross-attention mechanics, and temporal grounding in frontier models.',
    executive_summary: 'The transition from cascaded pipeline architectures (ASR -> LLM) to unified multimodal models enables end-to-end reasoning over visual frames, audio waveforms, and textual semantic layers with sub-second latency.',
    key_takeaways: [
      'Native multimodal tokens retain prosody, intonation, and visual spatial context lost in pipeline cascaded models.',
      'Temporal cross-attention allows pinpointing events to exact millisecond intervals without external diarization.',
      'Streaming frame ingestion enables long-context processing with minimal memory footprint on free-tier containers.'
    ],
    chapters: [
      {
        title: 'Architectural Evolution & Direct Multimodal Ingestion',
        start_time: 0,
        end_time: 114,
        start_time_formatted: '00:00',
        end_time_formatted: '01:54',
        summary: 'Analysis of classical cascaded pipeline bottlenecks and modern unified multimodal token representation.',
        key_moments: ['00:15 - Historical breakdown of ASR cascade errors', '01:02 - Unified attention architecture']
      },
      {
        title: 'Temporal Grounding & Frame-to-Waveform Alignment',
        start_time: 114,
        end_time: 258,
        start_time_formatted: '01:54',
        end_time_formatted: '04:18',
        summary: 'Demonstration of timestamp alignment across 1 fps video sampling and 16kHz audio waveforms.',
        key_moments: ['02:30 - Interleaved frame tokenization', '03:45 - Spatial-temporal feature maps']
      },
      {
        title: 'Optical Character Recognition & Blackboard Scene Understanding',
        start_time: 258,
        end_time: 395,
        start_time_formatted: '04:18',
        end_time_formatted: '06:35',
        summary: 'Evaluating high-density slide OCR extraction and mathematical formula synthesis directly from video.',
        key_moments: ['04:50 - Mathematical notation parsing', '05:40 - Slide transition boundary detection']
      },
      {
        title: 'Enterprise Synthesis, Q&A Verification & Export',
        start_time: 395,
        end_time: 482,
        start_time_formatted: '06:35',
        end_time_formatted: '08:02',
        summary: 'Compiling structured artifacts, executing grounded question-answering with timestamp citations.',
        key_moments: ['07:10 - Grounded citation verification', '07:55 - Markdown and JSON serialization']
      }
    ],
    transcript: [
      { start_time: 2, end_time: 18, start_time_formatted: '00:02', end_time_formatted: '00:18', speaker: 'Dr. Sarah Chen', text: 'Welcome everyone. Today we are discussing the fundamental mechanics of native multimodal perception in frontier foundation models.' },
      { start_time: 19, end_time: 45, start_time_formatted: '00:19', end_time_formatted: '00:45', speaker: 'Dr. Sarah Chen', text: 'In traditional video extraction systems, you had three disconnected pipelines: speech-to-text, visual frame OCR, and downstream text summarization.' },
      { start_time: 46, end_time: 98, start_time_formatted: '00:46', end_time_formatted: '01:38', speaker: 'Dr. Sarah Chen', text: 'With Gemini 2.0 Flash, video frames and audio waveforms are projected directly into the transformer latent space, preserving rich temporal context.' },
      { start_time: 115, end_time: 165, start_time_formatted: '01:55', end_time_formatted: '02:45', speaker: 'Marcus Vance', text: 'How does the model maintain synchronization between rapid visual slide transitions and speaker intonation?' },
      { start_time: 166, end_time: 220, start_time_formatted: '02:46', end_time_formatted: '03:40', speaker: 'Dr. Sarah Chen', text: 'Cross-attention masks interleave time-coded visual tokens with continuous audio embeddings, allowing exact millisecond grounding.' },
      { start_time: 396, end_time: 440, start_time_formatted: '06:36', end_time_formatted: '07:20', speaker: 'Dr. Sarah Chen', text: 'This guarantees that when the system cites a timestamp, the user can verify the claim directly against the source visual frame.' }
    ],
    visual_scenes: [
      { start_time: 15, end_time: 110, start_time_formatted: '00:15', end_time_formatted: '01:50', description: 'Slide 1: Pipeline Cascade vs Unified Multimodal Embedding Diagram', visual_elements: ['Architecture Box', 'Data Flow Arrows'], detected_text: ['ASR Pipeline', 'Transformer Core', 'Latent Space'] },
      { start_time: 260, end_time: 380, start_time_formatted: '04:20', end_time_formatted: '06:20', description: 'Slide 4: Loss Functions and Cross-Entropy Formulation for Temporal Grounding', visual_elements: ['Mathematical Equations', 'Attention Heatmap'], detected_text: ['L_temporal', 'Attention Matrix', 'Timecode Theta'] }
    ],
    action_items: [
      { task: 'Benchmark cross-modal attention latency under 1080p60 inputs', context: 'Architecture Evaluation', timestamp: '03:15' },
      { task: 'Integrate streaming 64KB direct-to-disk chunking for Render Free Tier', context: 'Production Deployment', timestamp: '05:40' },
      { task: 'Validate grounded timestamp citations with confidence score thresholding', context: 'Evaluation Harness', timestamp: '07:25' }
    ],
    entities: [
      { name: 'Gemini 2.0 Flash', category: 'Technology', description: 'Frontier native multimodal foundational model', mentions_count: 18, timestamps: ['00:46', '02:46', '06:36'] },
      { name: 'Temporal Cross-Attention', category: 'Methodology', description: 'Mechanism for aligning video frames with spoken audio tokens', mentions_count: 12, timestamps: ['01:02', '02:30', '03:45'] },
      { name: 'Dr. Sarah Chen', category: 'Speaker', description: 'Principal AI Systems Researcher', mentions_count: 8, timestamps: ['00:02', '01:55', '06:36'] },
      { name: 'Multimodal Latent Space', category: 'Concept', description: 'Unified projection embedding representation for audio and visual tokens', mentions_count: 9, timestamps: ['00:46', '04:50', '07:10'] }
    ],
    sentiment_and_tone: {
      overall: 'Analytical & Academic',
      energy_level: 'High Focus',
      communication_style: 'Measured, technical presentation'
    },
    created_at: new Date().toISOString()
  };

  const handleOpenProject = async (projectId: string) => {
    try {
      const proj = await fetchProjectDetails(projectId);
      setActiveAnalysis(proj);
      setCurrentPage('workspace');
    } catch (err) {
      console.warn('Backend project fetch failed, falling back to demo project:', err);
      if (projectId === 'demo_presentation' || !activeAnalysis) {
        setActiveAnalysis(DEFAULT_DEMO_PROJECT);
        setCurrentPage('workspace');
      }
    }
  };

  const handleLaunchDemo = async () => {
    await handleOpenProject('demo_presentation');
  };

  const handleSignOut = () => {
    setStoredUser(null);
    setUser(null);
    setCurrentPage('landing');
  };

  return (
    <div className="min-h-screen bg-[#030304] text-[#FAFAFA] flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      {/* 1. If on Landing or Auth, render full-screen immersive view */}
      {currentPage === 'landing' ? (
        <LandingPage
          onGetStarted={() => setCurrentPage(user ? 'dashboard' : 'dashboard')}
          onLaunchDemo={handleLaunchDemo}
          onSignIn={() => setCurrentPage('auth')}
          onImportUrl={() => {
            setCurrentPage('import');
          }}
        />
      ) : currentPage === 'auth' ? (
        <AuthPage
          onSuccess={(u) => {
            setUser(u);
            setCurrentPage('dashboard');
          }}
          onCancel={() => setCurrentPage('landing')}
        />
      ) : (
        /* 2. Main Authenticated Application Layout with Collapsible Sidebar */
        <div className="flex-1 flex overflow-hidden min-h-screen">
          {/* Collapsible Sidebar */}
          <aside
            className={`transition-all duration-300 bg-[#07070A] border-r border-[#1A1A22] flex flex-col justify-between shrink-0 z-30 ${
              isSidebarCollapsed ? 'w-20' : 'w-64'
            }`}
          >
            {/* Top Brand Logo & Toggle */}
            <div className="p-4 border-b border-[#1A1A22] flex items-center justify-between">
              <div
                className="flex items-center gap-3 cursor-pointer overflow-hidden"
                onClick={() => setCurrentPage('landing')}
              >
                <div className="w-8 h-8 rounded-xl bg-[#14141B] border border-[#22222E] flex items-center justify-center shrink-0">
                  <div className="w-3.5 h-3.5 rounded-full border border-violet-400 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                </div>
                {!isSidebarCollapsed && (
                  <span className="font-semibold text-xs tracking-wider font-mono text-white whitespace-nowrap">
                    VYORA<span className="text-violet-400">.AI</span>
                  </span>
                )}
              </div>

              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-[#14141B] transition-colors"
                title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Navigation Links */}
            <div className="p-3 space-y-1 flex-1">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                  currentPage === 'dashboard'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111116]'
                }`}
                title="Overview"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>OVERVIEW</span>}
              </button>

              <button
                onClick={() => setCurrentPage('import')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                  currentPage === 'import'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111116]'
                }`}
                title="Import Media"
              >
                <Video className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>IMPORT MEDIA</span>}
              </button>

              <button
                onClick={() => {
                  if (activeAnalysis) {
                    setCurrentPage('workspace');
                  } else {
                    handleLaunchDemo();
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                  currentPage === 'workspace'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111116]'
                }`}
                title="AI Studio Workspace"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-violet-400" />
                {!isSidebarCollapsed && <span>AI STUDIO</span>}
              </button>

              <button
                onClick={() => setCurrentPage('library')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                  currentPage === 'library'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111116]'
                }`}
                title="Knowledge Library"
              >
                <Layers className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>KNOWLEDGE VAULT</span>}
              </button>
            </div>

            {/* Sidebar Bottom Controls */}
            <div className="p-3 border-t border-[#1A1A22] space-y-1">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-mono text-[#A1A1AA] hover:text-white hover:bg-[#111116] transition-colors"
                title="Settings & API Key"
              >
                <Settings className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>SETTINGS</span>}
              </button>

              <button
                onClick={() => setCurrentPage('landing')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-mono text-[#A1A1AA] hover:text-white hover:bg-[#111116] transition-colors"
                title="Landing Portal"
              >
                <Compass className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>PUBLIC PORTAL</span>}
              </button>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-mono text-[#71717A] hover:text-rose-400 hover:bg-[#111116] transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>SIGN OUT</span>}
              </button>
            </div>
          </aside>

          {/* Main App Canvas */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#030304]">
            {/* Render Free Tier Cold-Start Indicator Banner */}
            {connectionState === 'waking_up' && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                <span>
                  <strong>Render Free Plan Cold Start:</strong> Backend container is waking up from sleep (~30–50s). Requests will connect automatically once booted.
                </span>
              </div>
            )}

            {/* Top Workspace Header Bar */}
            <header className="px-6 py-3 border-b border-[#1A1A22] bg-[#07070A]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-[#71717A] uppercase tracking-wider">
                  [ VYORA AI / <span className="text-white">{currentPage}</span> ]
                </span>
              </div>

              <div className="flex items-center gap-3">
                {activeAnalysis && currentPage === 'workspace' && (
                  <button
                    onClick={() => setIsExportOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141B] hover:bg-[#1A1A24] border border-[#22222E] text-xs font-mono text-white transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                    <span>EXPORT ARTIFACT</span>
                  </button>
                )}

                {/* Dynamic Gemini Auto Model Status Pill */}
                {connectionState === 'waking_up' ? (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse cursor-wait"
                    title="Render Free Tier instance is spinning up (~30-50s)"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    <span>Render Waking Up (~30s)</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!hasApiKey) {
                        setIsSettingsOpen(true);
                      } else {
                        setIsModelModalOpen(true);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      connectionState === 'offline' || modelStatus?.status === 'offline'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : serverKeyConfigured
                        ? 'bg-[#14141B] border-[#22222E] text-[#D4D4D8] hover:border-violet-500/40'
                        : hasApiKey
                        ? 'bg-[#14141B] border-[#22222E] text-[#D4D4D8] hover:border-violet-500/40'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                    }`}
                    title={
                      connectionState === 'offline' || modelStatus?.status === 'offline'
                        ? 'Backend service is offline or unreachable'
                        : serverKeyConfigured
                        ? 'Server-side Gemini API key active and ready. All users can extract video intelligence.'
                        : hasApiKey
                        ? 'Custom personal Gemini API key active and verified.'
                        : 'No Gemini API key detected. Click to configure in Settings.'
                    }
                  >
                    <Cpu className="w-3.5 h-3.5 text-violet-400" />
                    <span>
                      {connectionState === 'offline' || modelStatus?.status === 'offline'
                        ? 'API Offline'
                        : serverKeyConfigured
                        ? `Server Key Active · ${modelStatus?.display_model || systemConfig?.display_model || 'Gemini 2.0 Flash'}`
                        : hasApiKey
                        ? `User Key Active · ${modelStatus?.display_model || systemConfig?.display_model || 'Gemini 2.0 Flash'}`
                        : 'Configure API Key'}
                    </span>
                    {connectionState === 'offline' || modelStatus?.status === 'offline' ? (
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                    ) : hasApiKey ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                    )}
                  </button>
                )}
              </div>
            </header>

            {/* Page Content View Router */}
            <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
              {currentPage === 'dashboard' && (
                <DashboardPage
                  onOpenProject={handleOpenProject}
                  onNavigateToImport={() => setCurrentPage('import')}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  userName={user?.name || 'Researcher'}
                />
              )}

              {currentPage === 'import' && (
                <ImportPage
                  onProcessingFinished={(id) => handleOpenProject(id)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              )}

              {currentPage === 'workspace' && activeAnalysis && (
                <WorkspacePage
                  analysis={activeAnalysis}
                  onBack={() => setCurrentPage('dashboard')}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  hasApiKey={hasApiKey}
                />
              )}

              {currentPage === 'library' && (
                <LibraryPage
                  onOpenProject={handleOpenProject}
                  onNavigateToImport={() => setCurrentPage('import')}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        serverKeyConfigured={serverKeyConfigured}
        onKeySaved={() => {
          setHasApiKey(true);
          refreshStatus();
        }}
        onKeyCleared={() => {
          refreshStatus();
        }}
      />

      <ModelStatusModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        modelStatus={modelStatus}
        onRefresh={(refreshed) => setModelStatus(refreshed)}
      />

      {activeAnalysis && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          analysis={activeAnalysis}
        />
      )}
    </div>
  );
};

export default App;
