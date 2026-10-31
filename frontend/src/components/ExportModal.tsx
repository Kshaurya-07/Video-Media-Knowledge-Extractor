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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/40 backdrop-blur-sm animate-fade-in text-left">
      <div className="relative w-full max-w-2xl bg-white border border-neutral-300 rounded-sm p-6 shadow-xl flex flex-col max-h-[85vh] space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-950">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-500 tracking-wider uppercase">
                [ EXPORT / ARTIFACT COMPILER ]
              </div>
              <h3 className="font-bold text-neutral-950 text-sm">Export structured intelligence</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-neutral-400 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center justify-between">
          <div className="inline-flex p-0.5 rounded-sm bg-neutral-100 border border-neutral-300 font-mono text-xs">
            <button
              type="button"
              onClick={() => setExportFormat('markdown')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-all ${
                exportFormat === 'markdown'
                  ? 'bg-neutral-950 text-white font-medium shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>MARKDOWN (.md)</span>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('json')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm transition-all ${
                exportFormat === 'json'
                  ? 'bg-neutral-950 text-white font-medium shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-950'
              }`}
            >
              <Code className="w-3 h-3" />
              <span>RAW JSON (.json)</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-neutral-500">
            {analysis.chapters.length} chapters · {analysis.transcript.length} dialogue segments
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden rounded-sm border border-neutral-300 bg-neutral-50 p-3">
          <textarea
            readOnly
            value={contentToDisplay}
            className="w-full h-full bg-transparent text-xs font-mono text-neutral-900 resize-none focus:outline-none leading-relaxed"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white hover:bg-neutral-100 border border-neutral-300 text-xs font-mono text-neutral-800 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied to clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span>Copy content</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-sm text-xs font-mono text-neutral-600 hover:text-neutral-950 transition-colors"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-1.5 rounded-sm bg-neutral-950 text-white hover:bg-neutral-800 text-xs font-medium font-mono transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download artifact</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ExportModal;
