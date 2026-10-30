import React, { useState, useEffect } from 'react';
import { ProjectSummary } from '../../lib/types';
import { KnowledgeMap3D, KnowledgeGraphNode, KnowledgeGraphLink } from '../3d/KnowledgeMap3D';
import {
  fetchProjects,
  deleteProject,
  fetchKnowledgeGraph,
} from '../../lib/api';
import {
  Plus,
  Trash2,
  Clock,
  Layers,
  Search,
  Video,
  ChevronRight,
} from 'lucide-react';

interface DashboardPageProps {
  onOpenProject: (projectId: string) => void;
  onNavigateToImport: () => void;
  onOpenSettings?: () => void;
  userName?: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenProject,
  onNavigateToImport,
  userName = 'Operator',
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [graphData, setGraphData] = useState<{ nodes: KnowledgeGraphNode[]; links: KnowledgeGraphLink[] }>({
    nodes: [],
    links: [],
  });

  const loadDashboardData = async () => {
    try {
      const [projs, graph] = await Promise.all([
        fetchProjects(),
        fetchKnowledgeGraph(),
      ]);
      setProjects(projs);
      setGraphData(graph);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this media intelligence record?')) {
      await deleteProject(projectId);
      loadDashboardData();
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalChapters = projects.reduce((acc, p) => acc + (p.chapter_count || 0), 0);
  const totalDialogues = projects.reduce((acc, p) => acc + (p.transcript_count || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in p-4 sm:p-6 max-w-7xl mx-auto text-left">
      {/* ------------------------------------------------------------- */}
      {/* 1. WELCOME & STATS TELEMETRY */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1C1C24]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span>KNOWLEDGE COMMAND DESK / ACTIVE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
            Intelligence Overview
          </h1>
          <p className="text-xs text-[#71717A] max-w-md">
            Welcome, {userName}. Synthesized media archives, concept graph topology, and real-time extraction telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToImport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-xl shadow-white/5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import New Media</span>
          </button>
        </div>
      </div>

      {/* 2. Telemetry Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#07070A] border border-[#1A1A22] space-y-1">
          <span className="text-[10px] font-mono text-[#52525B] uppercase block">REPOSITORIES</span>
          <p className="text-xl font-bold font-mono text-white">{projects.length}</p>
          <span className="text-[10px] font-mono text-[#71717A]">Video Archives</span>
        </div>
        <div className="p-4 rounded-xl bg-[#07070A] border border-[#1A1A22] space-y-1">
          <span className="text-[10px] font-mono text-[#52525B] uppercase block">INDEXED CHAPTERS</span>
          <p className="text-xl font-bold font-mono text-violet-400">{totalChapters}</p>
          <span className="text-[10px] font-mono text-[#71717A]">Navigable Timecodes</span>
        </div>
        <div className="p-4 rounded-xl bg-[#07070A] border border-[#1A1A22] space-y-1">
          <span className="text-[10px] font-mono text-[#52525B] uppercase block">DIALOGUE SEGMENTS</span>
          <p className="text-xl font-bold font-mono text-white">{totalDialogues}</p>
          <span className="text-[10px] font-mono text-[#71717A]">Verbatim Transcripts</span>
        </div>
        <div className="p-4 rounded-xl bg-[#07070A] border border-[#1A1A22] space-y-1">
          <span className="text-[10px] font-mono text-[#52525B] uppercase block">TOPOLOGY NODES</span>
          <p className="text-xl font-bold font-mono text-emerald-400">{graphData.nodes.length}</p>
          <span className="text-[10px] font-mono text-[#71717A]">Concept Relations</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. INTERACTIVE 3D KNOWLEDGE TOPOLOGY */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-violet-400 uppercase tracking-widest">[ 01 / TOPOLOGY ]</span>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Global Concept Graph
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#52525B]">
            {graphData.nodes.length} Interconnected Nodes
          </span>
        </div>

        {graphData.nodes.length > 0 ? (
          <div className="rounded-2xl border border-[#1A1A22] bg-[#050508] overflow-hidden relative shadow-2xl">
            <KnowledgeMap3D
              nodes={graphData.nodes}
              links={graphData.links}
              onSelectNode={(node) => {
                if (node.projectId) {
                  onOpenProject(node.projectId);
                }
              }}
              className="w-full h-80"
            />
          </div>
        ) : (
          <div className="w-full h-64 rounded-2xl bg-[#07070A] border border-[#1A1A22] flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Layers className="w-8 h-8 text-[#52525B]" />
            <p className="text-xs text-[#A1A1AA] font-mono">No knowledge nodes in topology yet.</p>
            <p className="text-[11px] text-[#52525B] font-mono">
              Import a video to generate an interactive 3D concept graph.
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MEDIA ARCHIVE LIST & SEARCH */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#52525B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search extractions by title or theme..."
              className="w-full pl-9 pr-4 py-2 bg-[#07070A] border border-[#1A1A22] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500 font-mono"
            />
          </div>

          <div className="text-[11px] text-[#52525B] font-mono self-end sm:self-auto">
            SHOWING {filteredProjects.length} OF {projects.length} ARCHIVES
          </div>
        </div>

        {/* Project Cards Grid */}
        {filteredProjects.length === 0 ? (
          <div className="rounded-3xl bg-[#07070A] border border-[#1A1A22] p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0E0E14] border border-[#202028] flex items-center justify-center text-violet-400 mx-auto">
              <Video className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-white">No media records found</h3>
              <p className="text-xs text-[#71717A]">
                {searchQuery
                  ? `No extractions match "${searchQuery}". Clear your search to view all archives.`
                  : 'Import your first lecture, presentation, or meeting recording to begin.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import Your First Video</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => onOpenProject(p.id)}
                className="group p-5 rounded-2xl bg-[#07070A] border border-[#1A1A22] hover:border-violet-500/50 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-xl hover:shadow-violet-950/20"
              >
                <div className="space-y-3">
                  {/* Top Badge & Duration */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0E0E14] border border-[#202028] text-[10px] font-mono text-zinc-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{p.status}</span>
                    </span>
                    <span className="font-mono text-xs text-[#A1A1AA] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#52525B]" />
                      <span>{p.duration_formatted}</span>
                    </span>
                  </div>

                  {/* Title & Overview */}
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-violet-200 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-xs text-[#71717A] line-clamp-2 mt-1.5 leading-relaxed">
                      {p.description || 'Synthesized multimodal intelligence report.'}
                    </p>
                  </div>
                </div>

                {/* Bottom Metadata & Delete Action */}
                <div className="mt-5 pt-3.5 border-t border-[#1C1C24] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#52525B]">
                    <span>{p.chapter_count} CH</span>
                    <span>·</span>
                    <span>{p.transcript_count} DIALOGUES</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, p.id)}
                      className="p-1.5 rounded-lg text-[#52525B] hover:text-red-400 hover:bg-[#14141C] transition-colors"
                      title="Delete archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1.5 rounded-lg text-violet-400 group-hover:translate-x-0.5 transition-transform">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};