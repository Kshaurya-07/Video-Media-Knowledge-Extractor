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
  Database,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface LibraryPageProps {
  onOpenProject: (projectId: string) => void;
  onNavigateToImport?: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onOpenProject,
  onNavigateToImport,
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
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#1A1A22]">
        <div>
          <div className="text-[11px] font-mono text-[#71717A] tracking-wider uppercase mb-1">
            [ ARCHIVE / PERSISTENT KNOWLEDGE VAULT ]
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-sans">
            Knowledge Library
          </h1>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Synthesized intelligence assets, timestamped chapters, verbatim dialogue, and conceptual topological maps.
          </p>
        </div>

        {/* View Switcher: Grid vs 3D Spatial */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0A0A0E] border border-[#1A1A22]">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-black font-semibold'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>GRID VIEW</span>
          </button>
          <button
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
              viewMode === '3d'
                ? 'bg-white text-black font-semibold'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3D TOPOLOGY</span>
          </button>
        </div>
      </div>

      {/* Search & Metadata Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across summaries, chapters, entities..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0E] border border-[#1A1A22] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-[#71717A]">
          <span>{filteredProjects.length} Processed Assets</span>
          {onNavigateToImport && (
            <button
              onClick={onNavigateToImport}
              className="flex items-center gap-1.5 text-xs text-white hover:text-violet-300 transition-colors"
            >
              <span>Ingest New Media</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === '3d' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-[#71717A]">
            <span>Click any knowledge node to open the project workspace</span>
            <span>{graphData.nodes.length} nodes · {graphData.links.length} relational edges</span>
          </div>
          <div className="rounded-2xl border border-[#1A1A22] overflow-hidden bg-[#0A0A0E]">
            <KnowledgeMap3D
              nodes={graphData.nodes}
              links={graphData.links}
              onSelectNode={(node) => {
                if (node.projectId) onOpenProject(node.projectId);
              }}
              className="w-full h-[520px]"
            />
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-20 text-center rounded-2xl border border-[#1A1A22] bg-[#0A0A0E] space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#14141B] border border-[#22222E] flex items-center justify-center mx-auto text-[#71717A]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">No indexed assets found</h3>
            <p className="text-xs text-[#71717A] mt-1 max-w-sm mx-auto">
              {searchQuery ? 'No recordings matched your search query.' : 'Upload or link your first video recording to start generating intelligence.'}
            </p>
          </div>
          {onNavigateToImport && (
            <button
              onClick={onNavigateToImport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Import Media</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="p-5 rounded-2xl bg-[#0A0A0E] border border-[#1A1A22] hover:border-violet-500/40 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#A1A1AA] bg-[#14141B] px-2.5 py-0.5 rounded-full border border-[#22222E] text-[10px]">
                    {p.duration_formatted}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    INDEXED
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="text-xs text-[#71717A] line-clamp-3 mt-1.5 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#1A1A22] flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#71717A]">
                  {p.chapter_count} Chapters
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="p-1.5 rounded-lg text-[#52525B] hover:text-rose-400 transition-colors"
                    title="Delete project"
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
export default LibraryPage;
