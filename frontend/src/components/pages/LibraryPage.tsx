import React, { useState, useEffect } from 'react';
import { ProjectSummary } from '../../lib/types';
import { KnowledgeMap3D, KnowledgeGraphNode, KnowledgeGraphLink } from '../3d/KnowledgeMap3D';
import {
  fetchProjects,
  fetchKnowledgeGraph,
  deleteProject,
} from '../../lib/api';
import {
  Search,
  Layers,
  Grid,
  Trash2,
  Play,
} from 'lucide-react';

interface LibraryPageProps {
  onOpenProject: (projectId: string) => void;
  onNavigateToImport?: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onOpenProject,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | '3d'>('grid');
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [graphData, setGraphData] = useState<{ nodes: KnowledgeGraphNode[]; links: KnowledgeGraphLink[] }>({
    nodes: [],
    links: [],
  });

  const loadData = async () => {
    try {
      const [projs, graph] = await Promise.all([
        fetchProjects(),
        fetchKnowledgeGraph(),
      ]);
      setProjects(projs);
      setGraphData(graph);
    } catch (err) {
      console.error('Error loading library:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this project from your library?')) {
      await deleteProject(id);
      loadData();
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#27272A]">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-violet-400">
            Archive & Knowledge Repository
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans mt-1">
            Personal Knowledge Library
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Curated intelligence from all your processed recordings, seminars, and technical keynotes.
          </p>
        </div>

        {/* View Switcher: Grid vs 3D Spatial */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111111] border border-[#27272A]">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-black font-semibold'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === '3d'
                ? 'bg-white text-black font-semibold'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3D Topology</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search through knowledge library..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
        <div className="text-xs font-mono text-[#71717A]">
          {filteredProjects.length} Processed Assets
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === '3d' ? (
        <div className="space-y-3">
          <div className="text-xs text-[#A1A1AA]">
            Click any node in the 3D space to navigate directly into that project workspace.
          </div>
          <KnowledgeMap3D
            nodes={graphData.nodes}
            links={graphData.links}
            onSelectNode={(node) => {
              if (node.projectId) onOpenProject(node.projectId);
            }}
            className="w-full h-[520px]"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="p-5 rounded-2xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-400 bg-[#151515] px-2.5 py-0.5 rounded-full border border-zinc-800 text-[10px]">
                    {p.duration_formatted}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Indexed
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] line-clamp-3 mt-1 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#27272A] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#71717A]">
                  {p.chapter_count} Chapters
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="p-1.5 rounded-lg text-[#71717A] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-white group-hover:text-violet-300 flex items-center gap-1">
                    <span>Open</span>
                    <Play className="w-3 h-3 fill-current" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
