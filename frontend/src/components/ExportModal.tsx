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
    const filename = `${analysis.file_id || 'vyora-knowledge'}.${exportFormat === 'markdown' ? 'md' : 'json'}`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0A0A0E] border border-[#1A1A22] rounded-2xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A1A22]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#14141B] border border-[#22222E] flex items-center justify-center text-white">
              <FileText className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-[#71717A] tracking-wider uppercase">
                [ EXPORT / ARTIFACT COMPILER ]
              </div>
              <h3 className="font-semibold text-white text-sm">Export Structured Intelligence</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#71717A] hover:text-white hover:bg-[#14141B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center justify-between my-4">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-[#060608] border border-[#1A1A22]">
            <button
              onClick={() => setExportFormat('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                exportFormat === 'markdown'
                  ? 'bg-white text-black font-semibold'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>MARKDOWN (.md)</span>
            </button>
            <button
              onClick={() => setExportFormat('json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                exportFormat === 'json'
                  ? 'bg-white text-black font-semibold'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>RAW JSON (.json)</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-[#71717A]">
            {analysis.chapters.length} chapters · {analysis.transcript.length} dialogue segments
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden rounded-xl border border-[#1A1A22] bg-[#050507] p-3.5">
          <textarea
            readOnly
            value={contentToDisplay}
            className="w-full h-full bg-transparent text-xs font-mono text-[#D4D4D8] resize-none focus:outline-none selection:bg-violet-500/30 selection:text-white leading-relaxed"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#1A1A22]">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#14141B] hover:bg-[#1A1A24] border border-[#22222E] text-xs font-mono text-[#D4D4D8] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Copy Content</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-[#71717A] hover:text-white transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Artifact</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExportModal;
