import React, { useState, useEffect, useRef } from 'react';
import { MediaAnalysisResult, Note, Bookmark } from '../../lib/types';
import { VideoPlayer, VideoPlayerHandle } from '../VideoPlayer';
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
  Sparkles,
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
  const [leftTab, setLeftTab] = useState<'chapters' | 'transcript'>('chapters');
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
        'I have analyzed this entire recording. You can ask me any question about the methodology, architecture, slides, numbers, or specific statements.',
      timestamp: '00:00',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load notes and bookmarks
  useEffect(() => {
    fetchNotes(analysis.file_id).then(setNotes);
    fetchBookmarks(analysis.file_id).then(setBookmarks);
  }, [analysis.file_id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatLoading]);

  const handleSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setCurrentTime(seconds);
  };

  const handleSaveBookmark = async () => {
    const currentChapter = analysis.chapters.find(
      (c) => currentTime >= c.start_time && currentTime <= c.end_time
    );
    const label = currentChapter ? currentChapter.title : `Bookmark at ${formatSeconds(currentTime)}`;
    try {
      const bm = await createBookmark(analysis.file_id, label, currentTime, formatSeconds(currentTime));
      setBookmarks((prev) => [...prev, bm]);
    } catch (err) {
      console.error(err);
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
        formatSeconds(currentTime)
      );
      setNotes((prev) => [note, ...prev]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setIsAddingNote(false);
    } catch (err) {
      console.error(err);
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
      timestamp: formatSeconds(currentTime),
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
        timestamp: formatSeconds(currentTime),
      };

      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: `Error: ${err.message || 'Unable to retrieve answer. Check Gemini API key.'}`,
        timestamp: formatSeconds(currentTime),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredTranscript = transcriptSearch.trim()
    ? analysis.transcript.filter((t) =>
        t.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
        t.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
      )
    : analysis.transcript;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#151515] border border-[#27272A] text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>
          <div className="h-4 w-[1px] bg-[#27272A]" />
          <h2 className="text-xs font-bold text-white truncate max-w-md">
            {analysis.title}
          </h2>
          {analysis.selected_model && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[11px] font-mono text-violet-300">
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span>
                {analysis.model_selection_mode === 'fallback' ? 'Fallback: ' : 'Gemini Auto: '}
                {analysis.selected_model}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveBookmark}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#151515] border border-[#27272A] text-xs font-medium text-violet-300 transition-colors"
            title="Bookmark Current Video Timestamp"
          >
            <BookmarkIcon className="w-3.5 h-3.5" />
            <span>Bookmark [{formatSeconds(currentTime)}]</span>
          </button>
        </div>
      </div>

      {/* Flagship 3-Column Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= LEFT COLUMN: Chapters & Transcript (3.5 cols) ================= */}
        <div className="lg:col-span-4 bg-[#0A0A0A] border border-[#27272A] rounded-2xl p-4 space-y-4 h-[780px] flex flex-col">
          {/* Subtab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111111] border border-[#27272A] shrink-0">
            <button
              onClick={() => setLeftTab('chapters')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                leftTab === 'chapters'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Chapters ({analysis.chapters.length})
            </button>
            <button
              onClick={() => setLeftTab('transcript')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                leftTab === 'transcript'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Transcript
            </button>
          </div>

          {leftTab === 'chapters' ? (
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {analysis.chapters.map((ch, idx) => {
                const isActive =
                  currentTime >= ch.start_time && currentTime <= ch.end_time;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSeek(ch.start_time)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-[#151515] border-violet-500/80 shadow-md ring-1 ring-violet-500/30'
                        : 'bg-[#111111] border-[#27272A] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white line-clamp-1">
                        {ch.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isActive
                            ? 'bg-violet-600 text-white font-semibold'
                            : 'bg-[#151515] text-[#A1A1AA]'
                        }`}
                      >
                        {ch.start_time_formatted}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A1A1AA] line-clamp-2 leading-relaxed">
                      {ch.summary}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-3 min-h-0">
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  placeholder="Filter dialogue by text..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredTranscript.map((t, idx) => {
                  const isActive =
                    currentTime >= t.start_time && currentTime <= t.end_time;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleSeek(t.start_time)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[#151515] border-violet-500/80 ring-1 ring-violet-500/30'
                          : 'bg-[#111111] border-[#27272A] hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="text-violet-400 font-semibold">{t.speaker}</span>
                        <span className="text-[#71717A]">{t.start_time_formatted}</span>
                      </div>
                      <p className="text-xs text-[#D4D4D8] leading-relaxed">{t.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================= CENTER COLUMN: Player, 3D Spatial Timeline & Summary (5 cols) ================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* Synchronized Media Player */}
          <VideoPlayer
            ref={playerRef}
            src={getMediaStreamUrl(analysis.file_id)}
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
            className="w-full h-32"
          />

          {/* Executive Summary & Key Insights */}
          <div className="bg-[#0A0A0A] border border-[#27272A] rounded-2xl p-5 space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400">
                Cognitive Synthesis
              </span>
              <h3 className="text-sm font-bold text-white mt-1">Executive Summary</h3>
              <p className="text-xs text-[#A1A1AA] leading-relaxed mt-2 whitespace-pre-line">
                {analysis.executive_summary}
              </p>
            </div>

            {/* Key Takeaways */}
            <div className="pt-3 border-t border-[#27272A] space-y-2">
              <h4 className="text-xs font-semibold text-[#D4D4D8]">Key Takeaways</h4>
              <div className="space-y-1.5">
                {analysis.key_takeaways.map((k, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-[#A1A1AA]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                    <span>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: Ask AI, Notes & Bookmarks (3.5 cols) ================= */}
        <div className="lg:col-span-3 bg-[#0A0A0A] border border-[#27272A] rounded-2xl p-4 space-y-4 h-[780px] flex flex-col">
          {/* Subtab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#111111] border border-[#27272A] shrink-0">
            <button
              onClick={() => setRightTab('chat')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rightTab === 'chat'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Ask AI
            </button>
            <button
              onClick={() => setRightTab('notes')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rightTab === 'notes'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Notes ({notes.length})
            </button>
            <button
              onClick={() => setRightTab('bookmarks')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                rightTab === 'bookmarks'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              Marks ({bookmarks.length})
            </button>
          </div>

          {rightTab === 'chat' ? (
            /* Grounded AI Chat with Citations */
            <div className="flex-1 flex flex-col justify-between min-h-0 space-y-3">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-xl border text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#151515] border-[#27272A] text-white ml-3'
                        : 'bg-[#111111] border-[#27272A] text-[#D4D4D8] mr-3'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#71717A] mb-1">
                      <span>{msg.role === 'user' ? 'You' : 'VYORA Assistant'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-line">{msg.content}</div>

                    {/* Clickable Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-800 flex flex-wrap gap-1">
                        <span className="text-[10px] text-[#71717A] mr-1">Sources:</span>
                        {msg.citations.map((c: any, cIdx: number) => (
                          <button
                            key={cIdx}
                            onClick={() => handleSeek(c.seconds)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/20 hover:bg-violet-600 text-violet-300 hover:text-white text-[10px] font-mono border border-violet-500/30 transition-colors"
                          >
                            <Play className="w-2 h-2 fill-current" />
                            <span>{c.formatted}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isChatLoading && (
                  <div className="p-3 rounded-xl bg-[#111111] border border-[#27272A] text-xs text-[#A1A1AA] flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    <span>Searching transcript and synthesizing grounded answer...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChatSend();
                }}
                className="flex items-center gap-2 pt-2 border-t border-[#27272A] shrink-0"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask anything about the video..."
                  className="flex-1 px-3 py-2 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 transition-all shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : rightTab === 'notes' ? (
            /* User Notes with Timestamp Pinning */
            <div className="flex-1 flex flex-col justify-between min-h-0 space-y-3">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-white">Saved Research Notes</span>
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Note</span>
                </button>
              </div>

              {isAddingNote && (
                <form onSubmit={handleSaveNote} className="p-3 rounded-xl bg-[#111111] border border-[#27272A] space-y-2 shrink-0">
                  <div className="text-[10px] font-mono text-violet-400">
                    Pinned to timestamp: [{formatSeconds(currentTime)}]
                  </div>
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Note headline..."
                    className="w-full px-2.5 py-1.5 bg-[#050505] border border-zinc-800 rounded-lg text-xs text-white placeholder:text-[#71717A] focus:outline-none"
                  />
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Observation or insight..."
                    className="w-full px-2.5 py-1.5 bg-[#050505] border border-zinc-800 rounded-lg text-xs text-white placeholder:text-[#71717A] focus:outline-none resize-none h-16"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNote(false)}
                      className="px-2.5 py-1 rounded-lg text-xs text-[#71717A]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 rounded-lg bg-white text-black font-semibold text-xs"
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-xl bg-[#111111] border border-[#27272A] space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{n.title}</span>
                      {n.timestamp_seconds !== undefined && (
                        <button
                          onClick={() => handleSeek(n.timestamp_seconds!)}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-violet-300 hover:bg-violet-600 hover:text-white"
                        >
                          {n.timestamp_formatted || '00:00'}
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[#A1A1AA]">{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Bookmarks List */
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  onClick={() => handleSeek(bm.timestamp_seconds)}
                  className="p-3 rounded-xl bg-[#111111] border border-[#27272A] hover:border-violet-500/50 cursor-pointer transition-all flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-white line-clamp-1">{bm.label}</span>
                  <span className="font-mono text-[10px] text-violet-400 bg-[#151515] px-2 py-0.5 rounded border border-zinc-800 shrink-0">
                    {bm.timestamp_formatted}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
