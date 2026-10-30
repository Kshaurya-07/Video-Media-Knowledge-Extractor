import React, { useState, useRef, useEffect } from 'react';
import { ProcessingCore3D, ProcessingStage } from '../3d/ProcessingCore3D';
import {
  Upload,
  Link as LinkIcon,
  FileCheck,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  uploadMedia,
  startProcessingJob,
  fetchJobStatus,
  fetchSystemConfig,
  SystemConfig,
} from '../../lib/api';

interface ImportPageProps {
  onProcessingFinished: (projectId: string) => void;
  onOpenSettings: () => void;
  initialUrl?: string;
}

export const ImportPage: React.FC<ImportPageProps> = ({
  onProcessingFinished,
  onOpenSettings,
  initialUrl = '',
}) => {
  const [activeMode, setActiveMode] = useState<'upload' | 'url'>('upload');
  const [videoUrl, setVideoUrl] = useState(initialUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [stage, setStage] = useState<ProcessingStage>('QUEUED');
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSystemConfig().then(setSystemConfig);
  }, []);

  // Poll for background job progress
  useEffect(() => {
    if (!jobId || !isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const job = await fetchJobStatus(jobId);
        setStage(job.stage);
        setProgressPercent(job.progress_percent);
        setStatusMessage(job.message || '');

        if (job.stage === 'COMPLETED') {
          clearInterval(interval);
          setIsProcessing(false);
          setTimeout(() => {
            onProcessingFinished(job.project_id || projectId || 'demo_presentation');
          }, 1000);
        } else if (job.stage === 'FAILED') {
          clearInterval(interval);
          setIsProcessing(false);
          setErrorMessage(job.error_message || 'Processing pipeline encountered an error.');
        }
      } catch (err: any) {
        console.error('Job polling error:', err);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [jobId, isProcessing, projectId, onProcessingFinished]);

  const handleStartProcessing = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setStage('UPLOADING');
    setProgressPercent(10);
    setStatusMessage('Uploading and verifying media stream...');

    try {
      let fileId = '';

      if (activeMode === 'upload') {
        if (!selectedFile) {
          throw new Error('Please select a video or audio file to upload.');
        }
        // Step 1: Upload file to backend
        const uploaded = await uploadMedia(selectedFile);
        fileId = uploaded.file_id;
      } else {
        if (!videoUrl.trim()) {
          throw new Error('Please provide a valid video URL.');
        }
      }

      // Step 2: Start background extraction job
      const job = await startProcessingJob(
        fileId || undefined,
        activeMode === 'url' ? videoUrl.trim() : undefined,
        selectedFile ? selectedFile.name : 'Web Video Import'
      );

      setJobId(job.job_id);
      setProjectId(job.project_id);
      setStage(job.stage as ProcessingStage);
      setStatusMessage('Queued in VYORA execution pipeline...');
    } catch (err: any) {
      setIsProcessing(false);
      if (err.message && err.message.includes('API Key is required')) {
        setErrorMessage('A Google Gemini API Key is required for new video analysis.');
        onOpenSettings();
      } else {
        setErrorMessage(err.message || 'Failed to start media processing pipeline.');
      }
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 500 * 1024 * 1024) {
        setErrorMessage('File size exceeds the 500MB limit.');
        return;
      }
      setSelectedFile(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <span className="text-xs font-mono uppercase tracking-widest text-violet-400">
          Media Ingestion & Synthesis
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Import Video into VYORA
        </h1>
        <p className="text-xs text-[#A1A1AA]">
          Upload any lecture, conference talk, or meeting recording to extract source-grounded intelligence.
        </p>
      </div>

      {/* Main Dimensional Panel */}
      <div className="rounded-3xl bg-[#0A0A0A] border border-[#27272A] p-6 sm:p-10 shadow-2xl space-y-8">
        {!isProcessing ? (
          <>
            {/* Mode Switcher */}
            <div className="flex items-center justify-center gap-2 max-w-xs mx-auto p-1 rounded-2xl bg-[#111111] border border-[#27272A]">
              <button
                type="button"
                onClick={() => setActiveMode('upload')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeMode === 'upload'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('url')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeMode === 'url'
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#A1A1AA] hover:text-white'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Video Link</span>
              </button>
            </div>

            {/* Upload Zone */}
            {activeMode === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-violet-500 bg-violet-500/10'
                    : selectedFile
                    ? 'border-violet-500/50 bg-[#111111]'
                    : 'border-[#27272A] hover:border-zinc-700 bg-[#050505]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*,.mp4,.mov,.avi,.mkv,.webm,.mpeg,.mpg,.wmv,.3gp,.mp3,.wav,.m4a,.ogg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 500 * 1024 * 1024) {
                        setErrorMessage('File size exceeds the 500MB limit.');
                        return;
                      }
                      setSelectedFile(file);
                    }
                  }}
                />

                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-violet-400 shadow-inner">
                    {selectedFile ? <FileCheck className="w-8 h-8 text-emerald-400" /> : <Upload className="w-8 h-8" />}
                  </div>
                  <div>
                    {selectedFile ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">{selectedFile.name}</p>
                        <p className="text-xs font-mono text-[#A1A1AA]">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Extraction
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">
                          Drag and drop your media file, or <span className="text-violet-400 underline underline-offset-4">browse</span>
                        </p>
                        <p className="text-xs text-[#71717A]">
                          MP4, MOV, AVI, MKV, WebM, MPEG, WMV, 3GP, MP3, WAV up to 500MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* URL Input Box */
              <div className="p-8 rounded-3xl bg-[#050505] border border-[#27272A] space-y-4 text-left">
                <label className="block text-xs font-medium text-[#D4D4D8]">
                  Online Video Link or Media Stream URL
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://example.com/lecture.mp4"
                    className="w-full pl-10 pr-4 py-3 bg-[#111111] border border-[#27272A] rounded-xl text-xs text-white placeholder:text-[#71717A] focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-[#71717A]">
                  Supports YouTube videos, public conference lectures, and direct MP4/WebM/audio media streams (protected by SSRF defense).
                </p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-semibold transition-colors"
                >
                  Configure Key
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono text-[#71717A]">
                AI Model Engine: <span className="text-violet-400">Gemini Auto · {systemConfig?.display_model || 'Gemini 3.8 Flash'}</span>
              </span>

              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={activeMode === 'upload' ? !selectedFile : !videoUrl.trim()}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-xl shadow-white/5"
              >
                <span>Extract Video Intelligence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Live 3D Pipeline Visualization during actual processing */
          <div className="py-4 space-y-6 text-center">
            {/* 3D Core with Stage Adaptivity */}
            <div className="w-full max-w-sm mx-auto h-64">
              <ProcessingCore3D stage={stage} progressPercent={progressPercent} />
            </div>

            {/* Stage Indicator & Progress Bar */}
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-violet-400 font-semibold uppercase">{stage}</span>
                <span className="text-[#A1A1AA]">{Math.round(progressPercent)}%</span>
              </div>

              <div className="w-full h-2 rounded-full bg-[#151515] overflow-hidden border border-[#27272A]">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 via-purple-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-xs text-[#FAFAFA] font-medium pt-1">
                {statusMessage || 'Synthesizing knowledge layers...'}
              </p>
              <p className="text-[11px] text-[#71717A]">
                Gemini Auto ({systemConfig?.display_model || 'Gemini 3.8 Flash'}) is interleaving visual frames, waveforms, and OCR layers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
