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
    <div className="space-y-8 p-4 sm:p-6 max-w-7xl mx-auto text-left">
      {/* 1. Header & Quick Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-300">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
            <span>KNOWLEDGE COMMAND DESK / ACTIVE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 font-sans">
            Intelligence overview
          </h1>
          <p className="text-xs text-neutral-500 max-w-md">
            Welcome, {userName}. Synthesized media archives, concept graph topology, and extraction telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToImport}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Import new media</span>
          </button>
        </div>
      </div>

      {/* 2. Telemetry Ribbon (Grid of bordered cells) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-neutral-300 rounded-sm space-y-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">REPOSITORIES</span>
          <p className="text-2xl font-bold font-mono text-neutral-950">{projects.length}</p>
          <span className="text-[10px] font-mono text-neutral-500">Video archives</span>
        </div>
        <div className="p-4 bg-white border border-neutral-300 rounded-sm space-y-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">INDEXED CHAPTERS</span>
          <p className="text-2xl font-bold font-mono text-neutral-950">{totalChapters}</p>
          <span className="text-[10px] font-mono text-neutral-500">Navigable timecodes</span>
        </div>
        <div className="p-4 bg-white border border-neutral-300 rounded-sm space-y-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">DIALOGUE SEGMENTS</span>
          <p className="text-2xl font-bold font-mono text-neutral-950">{totalDialogues}</p>
          <span className="text-[10px] font-mono text-neutral-500">Verbatim lines</span>
        </div>
        <div className="p-4 bg-white border border-neutral-300 rounded-sm space-y-1">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">TOPOLOGY NODES</span>
          <p className="text-2xl font-bold font-mono text-neutral-950">{graphData.nodes.length}</p>
          <span className="text-[10px] font-mono text-neutral-500">Concept relations</span>
        </div>
      </div>

      {/* 3. Interactive 3D Knowledge Topology */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">[ 01 / TOPOLOGY ]</span>
            <h2 className="text-xs font-bold text-neutral-950 uppercase tracking-wider font-mono">
              Global concept graph
            </h2>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">
            {graphData.nodes.length} Interconnected nodes
          </span>
        </div>

        {graphData.nodes.length > 0 ? (
          <div className="rounded-sm border border-neutral-300 bg-white overflow-hidden relative">
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
          <div className="w-full h-64 rounded-sm bg-white border border-neutral-300 flex flex-col items-center justify-center text-center p-6 space-y-2">
            <Layers className="w-8 h-8 text-neutral-400" />
            <p className="text-xs text-neutral-600 font-mono">No knowledge nodes in topology yet.</p>
            <p className="text-[11px] text-neutral-400 font-mono">
              Import a video to generate an interactive 3D concept graph.
            </p>
          </div>
        )}
      </div>

      {/* 4. Media Archive List & Search */}
      <div className="space-y-4 pt-4 border-t border-neutral-300">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search extractions by title or theme..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 font-mono"
            />
          </div>

          <div className="text-[11px] text-neutral-500 font-mono self-end sm:self-auto">
            SHOWING {filteredProjects.length} OF {projects.length} ARCHIVES
          </div>
        </div>

        {/* Project Cells Grid (Not floating cards) */}
        {filteredProjects.length === 0 ? (
          <div className="rounded-sm bg-white border border-neutral-300 p-12 text-center space-y-4">
            <div className="w-10 h-10 rounded-sm bg-neutral-100 border border-neutral-300 flex items-center justify-center text-neutral-600 mx-auto">
              <Video className="w-5 h-5" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-neutral-950">No media records found</h3>
              <p className="text-xs text-neutral-500">
                {searchQuery
                  ? `No extractions match "${searchQuery}". Clear your search query to see all archives.`
                  : 'Import your first lecture, presentation, or meeting recording to begin.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToImport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Import your first video</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => onOpenProject(p.id)}
                className="group p-5 rounded-sm bg-white border border-neutral-300 hover:border-neutral-950 cursor-pointer transition-colors flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Status & Duration */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-neutral-100 border border-neutral-200 text-[10px] font-mono text-neutral-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-950" />
                      <span>{p.status}</span>
                    </span>
                    <span className="font-mono text-xs text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      <span>{p.duration_formatted}</span>
                    </span>
                  </div>

                  {/* Title & Overview */}
                  <div>
                    <h3 className="text-sm font-bold text-neutral-950 line-clamp-2">
                      {p.title}
                    </h3>
                    <p className="text-xs text-neutral-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {p.description || 'Synthesized multimodal intelligence report.'}
                    </p>
                  </div>
                </div>

                {/* Bottom Metadata & Delete Action */}
                <div className="mt-5 pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                    <span>{p.chapter_count} CH</span>
                    <span>·</span>
                    <span>{p.transcript_count} DIALOGUES</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, p.id)}
                      className="p-1 rounded-sm text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 transition-colors"
                      title="Delete archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1 text-neutral-400 group-hover:text-neutral-950 transition-colors">
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
export default DashboardPage;
