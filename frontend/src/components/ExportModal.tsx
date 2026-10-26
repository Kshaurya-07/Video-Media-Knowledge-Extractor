import React, { useState } from 'react';
import { MediaAnalysisResult } from '../lib/types';
import { X, FileText, Download, Check, Copy, Code } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: MediaAnalysisResult;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  analysis,
}) => {
  const [copied, setCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'markdown' | 'json'>('markdown');

  if (!isOpen) return null;

  const generateMarkdown = (): string => {
    let md = `# ${analysis.title}\n\n`;
    md += `**Duration:** ${analysis.duration_formatted} | **Media Type:** ${analysis.media_type} | **Processed:** ${analysis.created_at}\n\n`;
    md += `## High-Level Overview\n\n${analysis.overview}\n\n`;
    md += `## Executive Summary\n\n${analysis.executive_summary}\n\n`;
    
    md += `## Key Takeaways\n\n`;
    analysis.key_takeaways.forEach((k) => {
      md += `- ${k}\n`;
    });
    md += `\n`;

    md += `## Timestamped Chapters\n\n`;
    analysis.chapters.forEach((ch) => {
      md += `### [${ch.start_time_formatted} - ${ch.end_time_formatted}] ${ch.title}\n`;
      md += `${ch.summary}\n\n`;
      if (ch.key_moments && ch.key_moments.length > 0) {
        md += `*Key Moments:*\n`;
        ch.key_moments.forEach((km) => (md += `- ${km}\n`));
        md += `\n`;
      }
    });

    if (analysis.visual_scenes && analysis.visual_scenes.length > 0) {
      md += `## Visual Scenes & OCR\n\n`;
      analysis.visual_scenes.forEach((sc) => {
        md += `- **[${sc.start_time_formatted} - ${sc.end_time_formatted}]** ${sc.description}\n`;
        if (sc.detected_text && sc.detected_text.length > 0) {
          md += `  - *Detected Text:* \`${sc.detected_text.join(' | ')}\`\n`;
        }
      });
      md += `\n`;
    }

    if (analysis.action_items && analysis.action_items.length > 0) {
      md += `## Action Items & Recommendations\n\n`;
      analysis.action_items.forEach((act) => {
        md += `- [ ] **${act.task}** (${act.context}) ${act.timestamp ? `*[${act.timestamp}]*` : ''}\n`;
      });
      md += `\n`;
    }

    md += `## Full Transcript\n\n`;
    analysis.transcript.forEach((t) => {
      md += `**[${t.start_time_formatted}] ${t.speaker || 'Speaker'}:** ${t.text}\n\n`;
    });

    return md;
  };

  const contentToDisplay =
    exportFormat === 'markdown'
      ? generateMarkdown()
      : JSON.stringify(analysis, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToDisplay);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename = `${analysis.file_id || 'knowledge'}.${exportFormat === 'markdown' ? 'md' : 'json'}`;
    const blob = new Blob([contentToDisplay], {
      type: exportFormat === 'markdown' ? 'text/markdown;charset=utf-8;' : 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#111625] border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Export Extracted Knowledge</h3>
              <p className="text-xs text-slate-400">Download formatted Markdown or raw JSON</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-2 my-4">
          <button
            onClick={() => setExportFormat('markdown')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              exportFormat === 'markdown'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Markdown (.md)</span>
          </button>
          <button
            onClick={() => setExportFormat('json')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              exportFormat === 'json'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>JSON (.json)</span>
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <textarea
            readOnly
            value={contentToDisplay}
            className="w-full h-full bg-transparent text-xs font-mono text-slate-300 resize-none focus:outline-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard' : 'Copy'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
