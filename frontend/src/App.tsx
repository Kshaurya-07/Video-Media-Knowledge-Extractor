import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MediaUploader } from './components/MediaUploader';
import { VideoPlayer, VideoPlayerHandle } from './components/VideoPlayer';
import { OverviewTab } from './components/OverviewTab';
import { ChaptersTab } from './components/ChaptersTab';
import { TranscriptTab } from './components/TranscriptTab';
import { VisualInsightsTab } from './components/VisualInsightsTab';
import { EntitiesTab } from './components/EntitiesTab';
import { QAChatTab } from './components/QAChatTab';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { MediaAnalysisResult } from './lib/types';
import {
  getStoredApiKey,
  checkBackendHealth,
  getMediaStreamUrl,
} from './lib/api';
import {
  FileText,
  Bookmark,
  MessageSquare,
  Eye,
  Layers,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

export const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [analysis, setAnalysis] = useState<MediaAnalysisResult | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'chapters' | 'transcript' | 'visuals' | 'entities' | 'qa'
  >('overview');

  const playerRef = useRef<VideoPlayerHandle>(null);

  useEffect(() => {
    // Initial key & health check
    const stored = getStoredApiKey();
    if (stored) {
      setHasApiKey(true);
    } else {
      checkBackendHealth().then((health) => {
        if (health.has_api_key_configured) {
          setHasApiKey(true);
        }
      });
    }
  }, []);

  const handleSeek = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setCurrentTime(0);
    setActiveTab('overview');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header */}
      <Header
        hasKey={hasApiKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        hasAnalysis={!!analysis}
        mediaTitle={analysis?.title}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {!analysis ? (
          <MediaUploader
            onAnalysisComplete={(res) => setAnalysis(res)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            hasApiKey={hasApiKey}
          />
        ) : (
          <div className="space-y-6">
            {/* Top Bar Navigation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Analyze Another Media</span>
              </button>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-slate-300">{analysis.filename}</span>
                <span>•</span>
                <span className="capitalize">{analysis.media_type}</span>
                <span>•</span>
                <span className="font-mono text-indigo-400">{analysis.duration_formatted}</span>
              </div>
            </div>

            {/* Split Grid: Left Video Player & Right Knowledge Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Player & Quick Info (5 cols) */}
              <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
                <VideoPlayer
                  ref={playerRef}
                  src={getMediaStreamUrl(analysis.file_id)}
                  mediaType={analysis.media_type}
                  title={analysis.title}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                />

                {/* Media Title Card */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <h2 className="text-base font-bold text-slate-100 leading-snug">
                    {analysis.title}
                  </h2>
                  <p className="text-xs text-slate-400 line-clamp-3">
                    {analysis.overview}
                  </p>
                </div>
              </div>

              {/* Right Column: Tabbed Knowledge Engine (7 cols) */}
              <div className="lg:col-span-7 bg-slate-950/40 border border-slate-800/80 rounded-3xl p-5 shadow-2xl space-y-5">
                {/* Modern Navigation Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === 'overview'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Overview</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('chapters')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === 'chapters'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Chapters</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono">
                      {analysis.chapters.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === 'transcript'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Transcript</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('visuals')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === 'visuals'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visuals & OCR</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('entities')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === 'entities'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Entities</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('qa')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeTab === 'qa'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Q&A Chat</span>
                  </button>
                </div>

                {/* Tab Content Panes */}
                <div className="pt-2">
                  {activeTab === 'overview' && (
                    <OverviewTab analysis={analysis} onSeek={handleSeek} />
                  )}
                  {activeTab === 'chapters' && (
                    <ChaptersTab
                      chapters={analysis.chapters}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                    />
                  )}
                  {activeTab === 'transcript' && (
                    <TranscriptTab
                      transcript={analysis.transcript}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                    />
                  )}
                  {activeTab === 'visuals' && (
                    <VisualInsightsTab
                      scenes={analysis.visual_scenes}
                      currentTime={currentTime}
                      onSeek={handleSeek}
                    />
                  )}
                  {activeTab === 'entities' && (
                    <EntitiesTab
                      entities={analysis.entities}
                      actionItems={analysis.action_items}
                      onSeek={handleSeek}
                    />
                  )}
                  {activeTab === 'qa' && (
                    <QAChatTab
                      fileId={analysis.file_id}
                      onSeek={handleSeek}
                      hasApiKey={hasApiKey}
                      onOpenSettings={() => setIsSettingsOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-4 px-6 text-center text-xs text-slate-500">
        <p>VYORA AI — Video & Media Knowledge Extractor • Built with Gemini 2.5, FastAPI & React</p>
      </footer>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onKeySaved={() => {
          setHasApiKey(true);
        }}
      />

      {analysis && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          analysis={analysis}
        />
      )}
    </div>
  );
};
export default App;
