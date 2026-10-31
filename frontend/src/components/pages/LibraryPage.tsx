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
  Plus,
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
    <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-300">
        <div>
          <div className="text-[10px] font-mono text-neutral-500 tracking-wider uppercase mb-1">
            [ ARCHIVE / PERSISTENT KNOWLEDGE VAULT ]
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 font-sans">
            Knowledge library
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Synthesized intelligence assets, timestamped chapters, verbatim dialogue, and conceptual topological maps.
          </p>
        </div>

        {/* View Switcher: Grid vs 3D Spatial */}
        <div className="flex items-center gap-1 p-0.5 rounded-sm bg-neutral-100 border border-neutral-300 font-mono text-xs">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-colors ${
              viewMode === 'grid'
                ? 'bg-neutral-950 text-white font-medium shadow-sm'
                : 'text-neutral-600 hover:text-neutral-950'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>GRID VIEW</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-colors ${
              viewMode === '3d'
                ? 'bg-neutral-950 text-white font-medium shadow-sm'
                : 'text-neutral-600 hover:text-neutral-950'
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
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across summaries, chapters, entities..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 font-mono"
          />
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
          <span>{filteredProjects.length} PROCESSED ASSETS</span>
          {onNavigateToImport && (
            <button
              type="button"
              onClick={onNavigateToImport}
              className="flex items-center gap-1.5 text-xs text-neutral-950 font-medium hover:underline transition-all"
            >
              <span>Ingest new media</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === '3d' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
            <span>Click any knowledge node to open the project workspace</span>
            <span>{graphData.nodes.length} nodes · {graphData.links.length} relational edges</span>
          </div>
          <div className="rounded-sm border border-neutral-300 overflow-hidden bg-white">
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
        <div className="py-20 text-center rounded-sm border border-neutral-300 bg-white space-y-4">
          <div className="w-10 h-10 rounded-sm bg-neutral-100 border border-neutral-300 flex items-center justify-center mx-auto text-neutral-600">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-950">No indexed assets found</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'No recordings matched your search query.' : 'Upload or link your first video recording to start generating intelligence.'}
            </p>
          </div>
          {onNavigateToImport && (
            <button
              type="button"
              onClick={onNavigateToImport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import media</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              onClick={() => onOpenProject(p.id)}
              className="p-5 rounded-sm bg-white border border-neutral-300 hover:border-neutral-950 cursor-pointer transition-colors flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-sm border border-neutral-200 text-[10px]">
                    {p.duration_formatted}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
                    INDEXED
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-neutral-950 line-clamp-2">
                    {p.title}
                  </h3>
                  <p className="text-xs text-neutral-500 line-clamp-3 mt-1.5 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-neutral-200 flex items-center justify-between">
                <span className="text-[11px] font-mono text-neutral-500">
                  {p.chapter_count} Chapters
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, p.id)}
                    className="p-1 rounded-sm text-neutral-400 hover:text-rose-600 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-medium text-neutral-950 flex items-center gap-1">
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
