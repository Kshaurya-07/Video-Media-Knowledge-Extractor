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
  Sparkles,
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
  userName = 'Researcher',
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
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(projectId);
      loadDashboardData();
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Welcome & Stats Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-violet-400 mb-1">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span>KNOWLEDGE COMMAND CENTER</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
            Welcome back, {userName}
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Manage your synthesized media libraries, inspect connected concepts, and trigger new extractions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateToImport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all shadow-lg shadow-white/5"
          >
            <Plus className="w-4 h-4" />
            <span>Import Media</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive 3D Knowledge Map Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Global Knowledge Topology</h2>
          </div>
          <span className="text-[11px] font-mono text-[#71717A]">
            {graphData.nodes.length} Connected Nodes
          </span>
        </div>

        {graphData.nodes.length > 0 ? (
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
        ) : (
          <div className="w-full h-64 rounded-2xl bg-[#0A0A0A] border border-[#27272A] flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Layers className="w-8 h-8 text-[#71717A]" />
            <p className="text-xs text-[#A1A1AA]">No knowledge nodes in topology yet.</p>
            <p className="text-[11px] text-[#71717A]">Import your first video to generate the 3D concept graph.</p>
          </div>
        )}
      </div>

      {/* 3. Project Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title or concept..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        <div className="text-xs text-[#71717A] font-mono self-end sm:self-auto">
          Showing {filteredProjects.length} of {projects.length} Projects
        </div>
      </div>

      {/* 4. Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-3xl bg-[#0A0A0A] border border-[#27272A] p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-[#27272A] flex items-center justify-center text-violet-400 mx-auto">
            <Video className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-white">No media projects found</h3>
            <p className="text-xs text-[#A1A1AA]">
              {searchQuery
                ? `No projects match "${searchQuery}". Clear your search query to view all projects.`
                : 'Import your first lecture, presentation, or meeting recording to begin.'}
            </p>
          </div>
          <button
            onClick={onNavigateToImport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import Your First Video</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="group p-5 rounded-2xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 cursor-pointer transition-all duration-200 flex flex-col justify-between hover:shadow-xl hover:shadow-violet-950/20"
            >
              <div className="space-y-3">
                {/* Top Badge & Duration */}
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#151515] border border-zinc-800 text-[10px] font-mono text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{p.status}</span>
                  </span>
                  <span className="font-mono text-xs text-[#A1A1AA] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#71717A]" />
                    <span>{p.duration_formatted}</span>
                  </span>
                </div>

                {/* Title & Overview */}
                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-2 group-hover:text-violet-300 transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] line-clamp-2 mt-1.5 leading-relaxed">
                    {p.description || 'Synthesized multimodal intelligence report.'}
                  </p>
                </div>
              </div>

              {/* Bottom Metadata & Delete Action */}
              <div className="mt-5 pt-3.5 border-t border-[#27272A] flex items-center justify-between">
                <div className="flex items-center gap-3 text-[11px] font-mono text-[#71717A]">
                  <span>{p.chapter_count} Chapters</span>
                  <span>•</span>
                  <span>{p.transcript_count} Dialogues</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="p-1.5 rounded-lg text-[#71717A] hover:text-red-400 hover:bg-[#151515] transition-colors"
                    title="Delete project"
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
  );
};
