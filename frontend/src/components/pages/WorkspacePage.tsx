import React, { useState, useEffect, useRef } from 'react';
import { MediaAnalysisResult, Note, Bookmark } from '../../lib/types';
import { VideoPlayer, VideoPlayerHandle, formatTimestamp, parseTimestamp } from '../VideoPlayer';
import { SpatialTimeline3D } from '../3d/SpatialTimeline3D';
import { KnowledgeMap3D, KnowledgeGraphNode, KnowledgeGraphLink } from '../3d/KnowledgeMap3D';
import {
  fetchNotes,
  createNote,
  fetchBookmarks,
  createBookmark,
  askMediaQuestion,
  getMediaStreamUrl,
  fetchKnowledgeGraph,
} from '../../lib/api';
import {
  Play,
  Search,
  Bookmark as BookmarkIcon,
  Plus,
  ArrowLeft,
} from 'lucide-react';

interface WorkspacePageProps {
  analysis: MediaAnalysisResult;
  onBack: () => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({
  analysis,
  onBack,
  onOpenSettings,
  hasApiKey,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<VideoPlayerHandle>(null);

  // Active underlined text tab: Chapters | Transcript | Q&A | Map | Notes
  const [activeTab, setActiveTab] = useState<'chapters' | 'transcript' | 'qa' | 'map' | 'notes'>('chapters');
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Notes and Bookmarks
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // 3D Knowledge Graph
  const [graphData, setGraphData] = useState<{ nodes: KnowledgeGraphNode[]; links: KnowledgeGraphLink[] }>({
    nodes: [],
    links: [],
  });

  // Chat state
  const [chatMessages, setChatMessages] = useState<
    { id: string; role: 'user' | 'assistant'; content: string; citations?: any[]; timestamp: string }[]
  >([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'I have analyzed this recording with Gemini 2.0 Flash. You can ask any question about the methodology, arguments, slides, or statements, and I will cite exact timestamps.',
      timestamp: '00:00',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load notes, bookmarks, and graph
  useEffect(() => {
    fetchNotes(analysis.file_id).then(setNotes).catch(() => {});
    fetchBookmarks(analysis.file_id).then(setBookmarks).catch(() => {});
    fetchKnowledgeGraph().then(setGraphData).catch(() => {});
  }, [analysis.file_id]);

  useEffect(() => {
    if (activeTab === 'qa') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading, activeTab]);

  // Synchronized seek handler
  const handleSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setCurrentTime(seconds);
  };

  const handleSaveBookmark = async () => {
    const currentChapter = analysis.chapters.find(
      (c) => currentTime >= c.start_time && currentTime <= c.end_time
    );
    const label = currentChapter ? currentChapter.title : `Bookmark at ${formatTimestamp(currentTime)}`;
    try {
      const bm = await createBookmark(analysis.file_id, label, currentTime, formatTimestamp(currentTime));
      setBookmarks((prev) => [...prev, bm]);
    } catch (err) {
      console.error('Failed to create bookmark:', err);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    try {
      const note = await createNote(
        analysis.file_id,
        newNoteTitle.trim(),
        newNoteContent.trim(),
        currentTime,
        formatTimestamp(currentTime)
      );
      setNotes((prev) => [note, ...prev]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setIsAddingNote(false);
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  const handleChatSend = async (queryText?: string) => {
    const q = (queryText || chatInput).trim();
    if (!q || isChatLoading) return;

    if (!hasApiKey && analysis.file_id !== 'demo_presentation') {
      onOpenSettings();
      return;
    }

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: q,
      timestamp: formatTimestamp(currentTime),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const history = chatMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await askMediaQuestion(analysis.file_id, q, history);

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: res.answer,
        citations: res.citations || [],
        timestamp: formatTimestamp(currentTime),
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `Error: ${err.message || 'Unable to retrieve answer. Check Gemini API key.'}`,
        timestamp: formatTimestamp(currentTime),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const filteredTranscript = transcriptSearch.trim()
    ? analysis.transcript.filter(
        (t) =>
          t.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
          (t.speaker && t.speaker.toLowerCase().includes(transcriptSearch.toLowerCase()))
      )
    : analysis.transcript;

  const tabs = [
    { id: 'chapters' as const, label: `Chapters (${analysis.chapters.length})` },
    { id: 'transcript' as const, label: `Transcript (${analysis.transcript.length})` },
    { id: 'qa' as const, label: 'Q&A' },
    { id: 'map' as const, label: '3D Map' },
    { id: 'notes' as const, label: `Notes (${notes.length + bookmarks.length})` },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto text-left">
      {/* 1. Top Breadcrumb & Metadata Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-300">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-600 hover:text-neutral-950 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>
          <div className="h-4 w-[1px] bg-neutral-300" />
          <div>
            <h2 className="text-sm font-bold text-neutral-950 truncate max-w-sm sm:max-w-md">
              {analysis.title}
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-500 mt-0.5">
              <span>{analysis.duration_formatted}</span>
              <span>·</span>
              <span className="uppercase">{analysis.media_type}</span>
              {analysis.selected_model && (
                <>
                  <span>·</span>
                  <span className="text-neutral-950 font-semibold">{analysis.selected_model}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-950 transition-colors"
            title="Bookmark Current Video Timestamp"
          >
            <BookmarkIcon className="w-3.5 h-3.5 text-neutral-950" />
            <span>Bookmark [{formatTimestamp(currentTime)}]</span>
          </button>
        </div>
      </div>

      {/* 2. Video Player in a Bordered Frame */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Bordered Frame for Video Player */}
          <div className="p-3 bg-white border border-neutral-300 rounded-sm">
            <VideoPlayer
              ref={playerRef}
              src={analysis.source_url || getMediaStreamUrl(analysis.file_id)}
              mediaType={analysis.media_type}
              title={analysis.title}
              onTimeUpdate={(t) => setCurrentTime(t)}
            />
          </div>

          {/* 3D Spatial Timeline */}
          <SpatialTimeline3D
            chapters={analysis.chapters}
            currentTime={currentTime}
            duration={analysis.duration_seconds}
            onSelectChapter={handleSeek}
            className="w-full h-28"
          />

          {/* Underlined Text Tabs Header */}
          <div className="flex items-center gap-6 border-b border-neutral-300 font-mono text-xs pt-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`pb-2.5 font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === t.id
                    ? 'border-neutral-950 text-neutral-950 font-semibold'
                    : 'border-transparent text-neutral-500 hover:text-neutral-950'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Underlined Text Tab Panels */}
          <div className="p-6 bg-white border border-neutral-300 rounded-sm min-h-[360px]">
            {/* Tab 1: Chapters */}
            {activeTab === 'chapters' && (
              <div className="space-y-3">
                {analysis.chapters.map((ch, idx) => {
                  const isActive = currentTime >= ch.start_time && currentTime < ch.end_time;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSeek(ch.start_time)}
                      className={`p-4 rounded-sm border cursor-pointer transition-colors ${
                        isActive
                          ? 'border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950'
                          : 'border-neutral-200 hover:border-neutral-400 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-neutral-400">
                            CH {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-xs font-bold text-neutral-950 line-clamp-1">
                            {ch.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeek(ch.start_time);
                          }}
                          className={`font-mono text-[11px] px-2 py-0.5 rounded-sm border ${
                            isActive
                              ? 'bg-neutral-950 text-white border-neutral-950 font-medium'
                              : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:border-neutral-950'
                          }`}
                        >
                          [{ch.start_time_formatted || formatTimestamp(ch.start_time)}]
                        </button>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        {ch.summary}
                      </p>

                      {ch.key_moments && ch.key_moments.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-neutral-200 flex flex-wrap gap-2 text-[10px] font-mono text-neutral-500">
                          {ch.key_moments.map((km, kmIdx) => (
                            <span key={kmIdx} className="bg-neutral-50 px-2 py-0.5 rounded-sm border border-neutral-200">
                              • {km}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 2: Transcript */}
            {activeTab === 'transcript' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={transcriptSearch}
                    onChange={(e) => setTranscriptSearch(e.target.value)}
                    placeholder="Filter dialogue by text or speaker..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 font-mono"
                  />
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {filteredTranscript.length === 0 ? (
                    <p className="text-xs text-neutral-500 text-center py-8 font-mono">
                      No dialogue segments match search query.
                    </p>
                  ) : (
                    filteredTranscript.map((t, idx) => {
                      const isActive = currentTime >= t.start_time && currentTime <= t.end_time;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleSeek(t.start_time)}
                          className={`p-3 rounded-sm border cursor-pointer transition-colors ${
                            isActive
                              ? 'border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950'
                              : 'border-neutral-200 hover:border-neutral-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                            <span className="text-neutral-950 font-semibold">{t.speaker || 'Speaker'}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSeek(t.start_time);
                              }}
                              className="text-neutral-700 hover:text-neutral-950 font-mono text-[10px] hover:underline"
                            >
                              [{t.start_time_formatted || formatTimestamp(t.start_time)}]
                            </button>
                          </div>
                          <p className="text-xs text-neutral-800 leading-relaxed font-sans">{t.text}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Q&A */}
            {activeTab === 'qa' && (
              <div className="space-y-4">
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3.5 rounded-sm text-xs space-y-1.5 ${
                        m.role === 'user'
                          ? 'bg-neutral-100 border border-neutral-300 ml-6'
                          : 'bg-neutral-50 border border-neutral-200 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                        <span className="font-semibold text-neutral-950">
                          {m.role === 'assistant' ? 'VYORA Intelligence' : 'You'}
                        </span>
                        <span>{m.timestamp}</span>
                      </div>
                      <p className="text-neutral-900 leading-relaxed whitespace-pre-line">{m.content}</p>

                      {/* Clickable Citations [MM:SS] */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="pt-2 border-t border-neutral-200 flex flex-wrap gap-1.5">
                          {m.citations.map((c, cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => handleSeek(c.seconds || parseTimestamp(c.formatted))}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-[10px] font-mono text-neutral-900 transition-colors"
                            >
                              <Play className="w-2.5 h-2.5 fill-current text-neutral-950" />
                              <span>[{c.formatted}]</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="p-3 rounded-sm bg-neutral-50 border border-neutral-200 text-xs text-neutral-500 flex items-center gap-2 font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-950 animate-pulse" />
                      <span>Synthesizing answer from media context...</span>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleChatSend();
                  }}
                  className="pt-2 border-t border-neutral-200 relative flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask any question about the recording..."
                    className="flex-1 px-3 py-2 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="px-4 py-2 rounded-sm bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-mono font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}

            {/* Tab 4: 3D Map */}
            {activeTab === 'map' && (
              <div className="space-y-3">
                <div className="text-xs font-mono text-neutral-500 flex justify-between">
                  <span>Interactive knowledge topology manifold</span>
                  <span>{graphData.nodes.length} nodes · {graphData.links.length} relational links</span>
                </div>
                <div className="rounded-sm border border-neutral-300 overflow-hidden bg-white">
                  <KnowledgeMap3D
                    nodes={graphData.nodes}
                    links={graphData.links}
                    onSelectNode={(node) => {
                      if (node.timestamp) handleSeek(parseTimestamp(node.timestamp));
                    }}
                    className="w-full h-[440px]"
                  />
                </div>
              </div>
            )}

            {/* Tab 5: Notes & Bookmarks */}
            {activeTab === 'notes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
                  <span className="text-xs font-mono font-semibold text-neutral-950">
                    NOTES & BOOKMARKS
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(!isAddingNote)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-950 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingNote ? 'Cancel' : `Add note at [${formatTimestamp(currentTime)}]`}</span>
                  </button>
                </div>

                {isAddingNote && (
                  <form onSubmit={handleSaveNote} className="p-4 rounded-sm bg-neutral-50 border border-neutral-300 space-y-3">
                    <input
                      type="text"
                      value={newNoteTitle}
                      onChange={(e) => setNewNoteTitle(e.target.value)}
                      placeholder="Note headline..."
                      className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 font-mono"
                    />
                    <textarea
                      rows={3}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Observations, citations or thoughts..."
                      className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 resize-none font-mono"
                    />
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-sm bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium font-mono transition-all"
                    >
                      Save note
                    </button>
                  </form>
                )}

                {/* Notes List */}
                <div className="space-y-3">
                  <div className="text-xs font-mono font-medium text-neutral-500 uppercase tracking-wider">
                    Recorded notes ({notes.length})
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-xs text-neutral-400 font-mono">No notes recorded yet.</p>
                  ) : (
                    notes.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleSeek(n.timestamp_seconds || 0)}
                        className="p-3 rounded-sm bg-white border border-neutral-300 hover:border-neutral-950 cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-neutral-950">{n.title}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeek(n.timestamp_seconds || 0);
                            }}
                            className="text-[11px] font-mono text-neutral-700 hover:underline"
                          >
                            [{n.timestamp_formatted}]
                          </button>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Bookmarks List */}
                <div className="space-y-3 pt-4 border-t border-neutral-200">
                  <div className="text-xs font-mono font-medium text-neutral-500 uppercase tracking-wider">
                    Timestamp bookmarks ({bookmarks.length})
                  </div>
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-neutral-400 font-mono">No bookmarks added yet.</p>
                  ) : (
                    bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        onClick={() => handleSeek(bm.timestamp_seconds)}
                        className="p-3 rounded-sm bg-white border border-neutral-300 hover:border-neutral-950 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-neutral-950 truncate max-w-[240px]">{bm.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeek(bm.timestamp_seconds);
                          }}
                          className="font-mono text-[11px] text-neutral-700 hover:underline px-2 py-0.5 rounded-sm bg-neutral-100 border border-neutral-200"
                        >
                          [{bm.timestamp_formatted}]
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Executive Summary & Action Items Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-neutral-300 rounded-sm p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  COGNITIVE SYNTHESIS
                </span>
                {analysis.sentiment_and_tone && (
                  <span className="text-[10px] font-mono text-neutral-400">
                    TONE: {typeof analysis.sentiment_and_tone === 'object' ? analysis.sentiment_and_tone.overall : 'Analytical'}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-neutral-950 mt-1 font-sans">Executive summary</h3>
              <p className="text-xs text-neutral-600 leading-relaxed mt-2 whitespace-pre-line font-normal">
                {analysis.executive_summary || analysis.overview}
              </p>
            </div>

            {/* Key Takeaways */}
            {analysis.key_takeaways && analysis.key_takeaways.length > 0 && (
              <div className="pt-4 border-t border-neutral-200 space-y-2.5">
                <h4 className="text-[11px] font-mono font-semibold text-neutral-950 uppercase tracking-wider">
                  Key takeaways
                </h4>
                <div className="space-y-1.5">
                  {analysis.key_takeaways.map((k, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-neutral-700">
                      <span className="font-mono text-neutral-400 shrink-0">•</span>
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {analysis.action_items && analysis.action_items.length > 0 && (
              <div className="pt-4 border-t border-neutral-200 space-y-2.5">
                <h4 className="text-[11px] font-mono font-semibold text-neutral-950 uppercase tracking-wider">
                  Action items
                </h4>
                <div className="space-y-2">
                  {analysis.action_items.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-sm bg-neutral-50 border border-neutral-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-neutral-950">{act.task}</span>
                        {act.timestamp && (
                          <button
                            type="button"
                            onClick={() => handleSeek(parseTimestamp(act.timestamp!))}
                            className="font-mono text-[10px] text-neutral-700 hover:underline"
                          >
                            [{act.timestamp}]
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500">{act.context}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default WorkspacePage;
