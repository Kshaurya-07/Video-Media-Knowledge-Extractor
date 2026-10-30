import React, { useState, useEffect, useRef } from 'react';
import { MediaAnalysisResult, Note, Bookmark } from '../../lib/types';
import { VideoPlayer, VideoPlayerHandle, formatTimestamp, parseTimestamp } from '../VideoPlayer';
import { SpatialTimeline3D } from '../3d/SpatialTimeline3D';
import {
  fetchNotes,
  createNote,
  fetchBookmarks,
  createBookmark,
  askMediaQuestion,
  getMediaStreamUrl,
} from '../../lib/api';
import {
  Play,
  Search,
  Bookmark as BookmarkIcon,
  Plus,
  Send,
  CheckCircle2,
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

  // Left column active subtab
  const [leftTab, setLeftTab] = useState<'chapters' | 'transcript' | 'entities'>('chapters');
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Right column active subtab
  const [rightTab, setRightTab] = useState<'chat' | 'notes' | 'bookmarks'>('chat');

  // Notes and Bookmarks
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

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

  // Load notes and bookmarks
  useEffect(() => {
    fetchNotes(analysis.file_id).then(setNotes).catch(() => {});
    fetchBookmarks(analysis.file_id).then(setBookmarks).catch(() => {});
  }, [analysis.file_id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

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

  return (
    <div className="space-y-4 animate-fade-in p-4 sm:p-6 max-w-[1720px] mx-auto">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP STUDIO BREADCRUMB & METADATA BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1C1C24]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#09090D] hover:bg-[#14141A] border border-[#202028] text-xs font-mono text-[#A1A1AA] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>
          <div className="h-4 w-[1px] bg-[#26262E]" />
          <div>
            <h2 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md">
              {analysis.title}
            </h2>
            <div className="flex items-center gap-3 text-[10px] font-mono text-[#71717A] mt-0.5">
              <span>{analysis.duration_formatted}</span>
              <span>·</span>
              <span className="uppercase">{analysis.media_type}</span>
              {analysis.selected_model && (
                <>
                  <span>·</span>
                  <span className="text-violet-400 font-semibold">{analysis.selected_model}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0A0A0E] hover:bg-[#14141A] border border-[#202028] text-xs font-mono text-violet-300 transition-colors"
            title="Bookmark Current Video Timestamp"
          >
            <BookmarkIcon className="w-3.5 h-3.5 text-violet-400" />
            <span>Bookmark [{formatTimestamp(currentTime)}]</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FLAGSHIP 3-COLUMN STUDIO LAYOUT */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT COLUMN: Chapters, Transcript & Entities (3.5 cols) ================= */}
        <div className="lg:col-span-4 bg-[#070709] border border-[#1A1A22] rounded-2xl p-4 space-y-4 h-[840px] flex flex-col">
          {/* Subtab Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0E0E14] border border-[#1F1F28] shrink-0 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setLeftTab('chapters')}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                leftTab === 'chapters'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Chapters ({analysis.chapters.length})
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('transcript')}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                leftTab === 'transcript'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Dialogue ({analysis.transcript.length})
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('entities')}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                leftTab === 'entities'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Entities ({analysis.entities.length})
            </button>
          </div>

          {/* Chapters Subtab View */}
          {leftTab === 'chapters' && (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {analysis.chapters.map((ch, idx) => {
                const isActive = currentTime >= ch.start_time && currentTime < ch.end_time;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSeek(ch.start_time)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 text-left ${
                      isActive
                        ? 'bg-[#101016] border-violet-500/80 shadow-md ring-1 ring-violet-500/30'
                        : 'bg-[#0B0B0F] border-[#1C1C24] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#52525B]">
                          CH {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-xs font-bold text-white line-clamp-1">
                          {ch.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 ${
                          isActive
                            ? 'bg-violet-600 text-white font-semibold'
                            : 'bg-[#14141C] text-[#A1A1AA]'
                        }`}
                      >
                        {ch.start_time_formatted || formatTimestamp(ch.start_time)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] line-clamp-2 leading-relaxed">
                      {ch.summary}
                    </p>

                    {/* Key Moments on Chapter */}
                    {ch.key_moments && ch.key_moments.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[#1C1C24] space-y-1">
                        {ch.key_moments.slice(0, 3).map((km, kmIdx) => (
                          <div
                            key={kmIdx}
                            className="flex items-center gap-1.5 text-[10px] text-[#71717A] hover:text-violet-300 transition-colors"
                          >
                            <span className="w-1 h-1 rounded-full bg-violet-400" />
                            <span className="truncate">{km}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Transcript Subtab View */}
          {leftTab === 'transcript' && (
            <div className="flex-1 flex flex-col space-y-3 min-h-0 text-left">
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 text-[#52525B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  placeholder="Filter dialogue by text or speaker..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0A0A0E] border border-[#1C1C24] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredTranscript.length === 0 ? (
                  <p className="text-xs text-[#52525B] text-center pt-8 font-mono">
                    No dialogue matches found.
                  </p>
                ) : (
                  filteredTranscript.map((t, idx) => {
                    const isActive = currentTime >= t.start_time && currentTime <= t.end_time;

                    return (
                      <div
                        key={idx}
                        onClick={() => handleSeek(t.start_time)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                          isActive
                            ? 'bg-[#101016] border-violet-500/80 shadow-sm'
                            : 'bg-[#0B0B0F] border-[#1C1C24] hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                          <span className="text-violet-400 font-semibold">{t.speaker || 'Speaker'}</span>
                          <span className="text-[#52525B]">
                            {t.start_time_formatted || formatTimestamp(t.start_time)}
                          </span>
                        </div>
                        <p className="text-xs text-[#D4D4D8] leading-relaxed">{t.text}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Entities Subtab View */}
          {leftTab === 'entities' && (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-left">
              {analysis.entities.length === 0 ? (
                <p className="text-xs text-[#52525B] text-center pt-8 font-mono">
                  No entities extracted for this media.
                </p>
              ) : (
                analysis.entities.map((ent, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#0B0B0F] border border-[#1C1C24] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{ent.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#13131A] text-violet-300">
                        {ent.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] leading-relaxed">{ent.description}</p>
                    {ent.timestamps && ent.timestamps.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {ent.timestamps.map((ts, tsIdx) => (
                          <button
                            key={tsIdx}
                            type="button"
                            onClick={() => handleSeek(parseTimestamp(ts))}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161622] hover:bg-violet-900/40 text-violet-300 transition-colors"
                          >
                            {ts}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ================= CENTER COLUMN: Player, 3D Spatial Timeline & Summary (5 cols) ================= */}
        <div className="lg:col-span-5 space-y-4 text-left">
          {/* Synchronized Media Player */}
          <VideoPlayer
            ref={playerRef}
            src={analysis.source_url || getMediaStreamUrl(analysis.file_id)}
            mediaType={analysis.media_type}
            title={analysis.title}
            onTimeUpdate={(t) => setCurrentTime(t)}
          />

          {/* 3D Spatial Chapter Timeline */}
          <SpatialTimeline3D
            chapters={analysis.chapters}
            currentTime={currentTime}
            duration={analysis.duration_seconds}
            onSelectChapter={handleSeek}
            className="w-full h-28"
          />

          {/* Executive Summary & Key Insights Card */}
          <div className="bg-[#070709] border border-[#1A1A22] rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400">
                  Multimodal Cognitive Synthesis
                </span>
                {analysis.sentiment_and_tone && (
                  <span className="text-[10px] font-mono text-[#71717A]">
                    TONE: {typeof analysis.sentiment_and_tone === 'object' ? analysis.sentiment_and_tone.overall : 'Analytical'}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white mt-1">Executive Summary</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed mt-2 whitespace-pre-line">
                {analysis.executive_summary || analysis.overview}
              </p>
            </div>

            {/* Key Takeaways */}
            {analysis.key_takeaways && analysis.key_takeaways.length > 0 && (
              <div className="pt-3 border-t border-[#1C1C24] space-y-2">
                <h4 className="text-xs font-semibold text-[#D4D4D8] font-mono uppercase tracking-wider text-[11px]">
                  Key Takeaways
                </h4>
                <div className="space-y-1.5">
                  {analysis.key_takeaways.map((k, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#A1A1AA]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {analysis.action_items && analysis.action_items.length > 0 && (
              <div className="pt-3 border-t border-[#1C1C24] space-y-2">
                <h4 className="text-xs font-semibold text-[#D4D4D8] font-mono uppercase tracking-wider text-[11px]">
                  Action Items & Recommendations
                </h4>
                <div className="space-y-2">
                  {analysis.action_items.map((act, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-[#0B0B0F] border border-[#1C1C24] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{act.task}</span>
                        {act.timestamp && (
                          <button
                            type="button"
                            onClick={() => handleSeek(parseTimestamp(act.timestamp!))}
                            className="text-[10px] font-mono text-violet-400 hover:underline"
                          >
                            {act.timestamp}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#71717A]">{act.context}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: Grounded Q&A, Notes & Bookmarks (3.5 cols) ================= */}
        <div className="lg:col-span-3 bg-[#070709] border border-[#1A1A22] rounded-2xl p-4 space-y-4 h-[840px] flex flex-col text-left">
          {/* Subtab Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0E0E14] border border-[#1F1F28] shrink-0 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setRightTab('chat')}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                rightTab === 'chat'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Ask AI
            </button>
            <button
              type="button"
              onClick={() => setRightTab('notes')}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                rightTab === 'notes'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Notes ({notes.length})
            </button>
            <button
              type="button"
              onClick={() => setRightTab('bookmarks')}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                rightTab === 'bookmarks'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Bookmarks ({bookmarks.length})
            </button>
          </div>

          {/* Grounded AI Chat Subtab */}
          {rightTab === 'chat' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-xl text-xs space-y-1.5 ${
                      m.role === 'user'
                        ? 'bg-[#12121A] border border-[#202028] ml-4'
                        : 'bg-[#0B0B0F] border border-[#1C1C24] mr-2'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#52525B]">
                      <span className={m.role === 'assistant' ? 'text-violet-400 font-semibold' : 'text-[#A1A1AA]'}>
                        {m.role === 'assistant' ? 'VYORA Intelligence' : 'You'}
                      </span>
                      <span>{m.timestamp}</span>
                    </div>
                    <p className="text-[#D4D4D8] leading-relaxed whitespace-pre-line">{m.content}</p>

                    {/* Grounded Citations (Click to Seek Video) */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="pt-2 border-t border-[#1C1C24] flex flex-wrap gap-1.5">
                        {m.citations.map((c, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => handleSeek(c.seconds || parseTimestamp(c.formatted))}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-950/40 hover:bg-violet-900/60 border border-violet-500/30 text-[10px] font-mono text-violet-300 transition-colors"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>[{c.formatted}]</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="p-3 rounded-xl bg-[#0B0B0F] border border-[#1C1C24] text-xs text-[#71717A] flex items-center gap-2 font-mono">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <span>Gemini is synthesizing answer from video...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChatSend();
                }}
                className="pt-2 border-t border-[#1C1C24] relative"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask any question about the video..."
                  className="w-full pl-3 pr-10 py-2.5 bg-[#0B0B0F] border border-[#1C1C24] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* Notes Subtab */}
          {rightTab === 'notes' && (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              <button
                type="button"
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0F0F16] border border-[#202028] hover:border-zinc-700 text-xs font-mono text-[#D4D4D8] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingNote ? 'Cancel Note' : `Add Note at [${formatTimestamp(currentTime)}]`}</span>
              </button>

              {isAddingNote && (
                <form onSubmit={handleSaveNote} className="p-3 rounded-xl bg-[#0B0B0F] border border-[#1C1C24] space-y-2">
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Note headline..."
                    className="w-full px-2.5 py-1.5 bg-[#14141C] border border-[#26262E] rounded-lg text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500 font-mono"
                  />
                  <textarea
                    rows={3}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Observations, citations or thoughts..."
                    className="w-full px-2.5 py-1.5 bg-[#14141C] border border-[#26262E] rounded-lg text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500 resize-none font-mono"
                  />
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all"
                  >
                    Save Note
                  </button>
                </form>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {notes.length === 0 ? (
                  <p className="text-xs text-[#52525B] text-center pt-8 font-mono">
                    No notes recorded yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleSeek(n.timestamp_seconds || 0)}
                      className="p-3 rounded-xl bg-[#0B0B0F] border border-[#1C1C24] hover:border-zinc-700 cursor-pointer space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{n.title}</span>
                        <span className="text-[10px] font-mono text-violet-400">{n.timestamp_formatted}</span>
                      </div>
                      <p className="text-xs text-[#71717A] leading-relaxed">{n.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Bookmarks Subtab */}
          {rightTab === 'bookmarks' && (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {bookmarks.length === 0 ? (
                <p className="text-xs text-[#52525B] text-center pt-8 font-mono">
                  No bookmarks created yet. Use the top bookmark button.
                </p>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    onClick={() => handleSeek(bm.timestamp_seconds)}
                    className="p-3 rounded-xl bg-[#0B0B0F] border border-[#1C1C24] hover:border-zinc-700 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-white truncate max-w-[180px]">{bm.label}</span>
                    <span className="text-[10px] font-mono text-violet-400 px-2 py-0.5 rounded bg-[#13131C]">
                      {bm.timestamp_formatted}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};