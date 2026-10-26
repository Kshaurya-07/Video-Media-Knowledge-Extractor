import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../lib/types';
import { askMediaQuestion } from '../lib/api';
import { Send, Bot, User, Sparkles, Loader2, Play, Clock } from 'lucide-react';

interface QAChatTabProps {
  fileId: string;
  onSeek: (seconds: number) => void;
  hasApiKey: boolean;
  onOpenSettings: () => void;
}

export const QAChatTab: React.FC<QAChatTabProps> = ({
  fileId,
  onSeek,
  hasApiKey,
  onOpenSettings,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I have analyzed this media recording. You can ask me any question about the discussion, slides, code, recommendations, or specific moments.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || isLoading) return;

    if (!hasApiKey && fileId !== 'demo_presentation') {
      onOpenSettings();
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await askMediaQuestion(fileId, q, history);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.answer,
        citations: res.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to retrieve response from Gemini. Please verify your API Key.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    'What was the main topic discussed?',
    'Summarize the key architectural decisions',
    'What latency benchmarks were presented?',
    'List all action items mentioned',
  ];

  const renderContentWithClickableTimestamps = (text: string) => {
    // Regex matches [MM:SS] or [HH:MM:SS]
    const regex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const timeStr = match[1];
      const timeParts = timeStr.split(':').map((p) => parseFloat(p));
      const secs =
        timeParts.length === 2
          ? timeParts[0] * 60 + timeParts[1]
          : timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];

      parts.push(
        <button
          key={match.index}
          onClick={() => onSeek(secs)}
          className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[11px] font-mono border border-indigo-500/30 transition-colors"
          title={`Seek to ${timeStr}`}
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{timeStr}</span>
        </button>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  return (
    <div className="flex flex-col h-[650px] bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-100">Grounded Video Q&A Assistant</h3>
            <p className="text-[11px] text-slate-400">Ask any question with sub-second timestamp citations</p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-md ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-indigo-400 border border-slate-700'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-2 ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-line">
                {renderContentWithClickableTimestamps(msg.content)}
              </div>

              {/* Citations Badges */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 mr-1">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>Citations:</span>
                  </span>
                  {msg.citations.map((c, cIdx) => (
                    <button
                      key={cIdx}
                      onClick={() => onSeek(c.seconds)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-800 text-[10px] font-mono transition-colors"
                      title={c.context}
                    >
                      <Play className="w-2 h-2 fill-current" />
                      <span>{c.formatted}</span>
                      {c.context && <span className="opacity-60 max-w-[120px] truncate">({c.context})</span>}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`text-[9px] text-right font-mono ${
                  msg.role === 'user' ? 'text-indigo-200' : 'text-slate-500'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Analyzing media context and synthesizing answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/30 flex flex-wrap gap-1.5">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-300 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-slate-950/70 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this video/audio..."
          className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/30 transition-all shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
