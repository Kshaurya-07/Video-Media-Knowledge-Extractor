import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/pages/LandingPage';
import { AuthPage } from './components/pages/AuthPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { ImportPage } from './components/pages/ImportPage';
import { WorkspacePage } from './components/pages/WorkspacePage';
import { LibraryPage } from './components/pages/LibraryPage';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';

import { MediaAnalysisResult } from './lib/types';
import {
  getStoredApiKey,
  getStoredUser,
  setStoredUser,
  checkBackendHealth,
  fetchProjectDetails,
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
  Key,
  CheckCircle,
  AlertCircle,
  Compass,
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
  const [hasApiKey, setHasApiKey] = useState(false);

  // Initial session & key hydration
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) setUser(storedUser);

    const storedKey = getStoredApiKey();
    if (storedKey) {
      setHasApiKey(true);
    } else {
      checkBackendHealth().then((h) => {
        if (h.has_api_key_configured) setHasApiKey(true);
      });
    }
  }, []);

  const handleOpenProject = async (projectId: string) => {
    try {
      const proj = await fetchProjectDetails(projectId);
      setActiveAnalysis(proj);
      setCurrentPage('workspace');
    } catch (err) {
      console.error('Failed to open project:', err);
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
    <div className="min-h-screen bg-[#050505] text-[#FAFAFA] flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
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
            className={`transition-all duration-300 bg-[#0A0A0A] border-r border-[#27272A] flex flex-col justify-between shrink-0 z-30 ${
              isSidebarCollapsed ? 'w-20' : 'w-64'
            }`}
          >
            {/* Top Logo & Toggle */}
            <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
              <div
                className="flex items-center gap-3 cursor-pointer overflow-hidden"
                onClick={() => setCurrentPage('landing')}
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-800 to-black border border-zinc-700 flex items-center justify-center shrink-0">
                  <div className="w-3.5 h-3.5 rounded-full border border-violet-400 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-white" />
                  </div>
                </div>
                {!isSidebarCollapsed && (
                  <span className="font-bold text-sm tracking-tight text-white whitespace-nowrap">
                    VYORA<span className="text-violet-400">.AI</span>
                  </span>
                )}
              </div>

              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-[#151515] transition-colors"
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
            <div className="p-3 space-y-1.5 flex-1">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentPage === 'dashboard'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111111]'
                }`}
                title="Overview"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Overview</span>}
              </button>

              <button
                onClick={() => setCurrentPage('import')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentPage === 'import'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111111]'
                }`}
                title="Import Media"
              >
                <Video className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Import Video</span>}
              </button>

              <button
                onClick={() => {
                  if (activeAnalysis) {
                    setCurrentPage('workspace');
                  } else {
                    handleLaunchDemo();
                  }
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentPage === 'workspace'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111111]'
                }`}
                title="AI Workspace"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-violet-400" />
                {!isSidebarCollapsed && <span>AI Workspace</span>}
              </button>

              <button
                onClick={() => setCurrentPage('library')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  currentPage === 'library'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#111111]'
                }`}
                title="Knowledge Library"
              >
                <Layers className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Knowledge Library</span>}
              </button>
            </div>

            {/* Sidebar Bottom Controls */}
            <div className="p-3 border-t border-[#27272A] space-y-1.5">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white hover:bg-[#111111] transition-colors"
                title="Settings & API Key"
              >
                <Settings className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Settings</span>}
              </button>

              <button
                onClick={() => setCurrentPage('landing')}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-[#A1A1AA] hover:text-white hover:bg-[#111111] transition-colors"
                title="Landing Page"
              >
                <Compass className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Landing Portal</span>}
              </button>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-[#71717A] hover:text-red-400 hover:bg-[#111111] transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>Sign Out</span>}
              </button>
            </div>
          </aside>

          {/* Main App Canvas */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Top Workspace Header Bar */}
            <header className="px-6 py-3.5 border-b border-[#27272A] bg-[#050505]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">
                  VYORA AI •{' '}
                  <span className="text-white capitalize">{currentPage}</span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                {activeAnalysis && currentPage === 'workspace' && (
                  <button
                    onClick={() => setIsExportOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111111] hover:bg-[#151515] border border-[#27272A] text-xs font-medium text-white transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                    <span>Export</span>
                  </button>
                )}

                {/* API Key Status Pill */}
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                    hasApiKey
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                  }`}
                >
                  <Key className="w-3 h-3" />
                  <span>{hasApiKey ? 'Gemini 2.5 Active' : 'Enter API Key'}</span>
                  {hasApiKey ? (
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                  )}
                </button>
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
        onKeySaved={() => setHasApiKey(true)}
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
