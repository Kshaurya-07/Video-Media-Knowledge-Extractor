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
  probeBackendWithBackoff,
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
  const [cachedUploadedFile, setCachedUploadedFile] = useState<{ file: File; fileId: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSystemConfig().then(setSystemConfig).catch(() => {});
  }, []);

  // Poll for background job progress (2.5s interval to minimize Render Free Tier worker load)
  useEffect(() => {
    if (!jobId || !isProcessing) return;

    let consecutiveFailures = 0;
    const interval = setInterval(async () => {
      try {
        const job = await fetchJobStatus(jobId);
        consecutiveFailures = 0;
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
        consecutiveFailures++;
        console.warn(`Job polling transient hiccup (${consecutiveFailures}/4):`, err);
        if (consecutiveFailures >= 4) {
          clearInterval(interval);
          setIsProcessing(false);
          setErrorMessage('Lost connection to backend during processing. Please refresh or retry.');
        }
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId, isProcessing, projectId, onProcessingFinished]);

  const handleStartProcessing = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setStage('UPLOADING');
    setProgressPercent(10);
    setStatusMessage('Checking Render backend readiness...');

    try {
      const isReady = await probeBackendWithBackoff((_, __, msg) => setStatusMessage(msg), 3);
      if (!isReady) {
        throw new Error('Backend is waking up from cold start. Please wait 15 seconds and try again.');
      }

      let fileId = '';

      if (activeMode === 'upload') {
        if (!selectedFile) {
          throw new Error('Please select a video or audio file to upload.');
        }
        if (cachedUploadedFile && cachedUploadedFile.file === selectedFile && cachedUploadedFile.fileId) {
          fileId = cachedUploadedFile.fileId;
          setStatusMessage('Reusing uploaded video container from server storage (zero upload delay)...');
        } else {
          setStatusMessage('Streaming media directly to backend storage in 64KB chunks...');
          const uploaded = await uploadMedia(selectedFile);
          fileId = uploaded.file_id;
          setCachedUploadedFile({ file: selectedFile, fileId: uploaded.file_id });
        }
      } else {
        if (!videoUrl.trim()) {
          throw new Error('Please provide a valid video URL.');
        }
      }

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
        setErrorMessage(err.message || 'Processing failed. Please check backend connection.');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in text-left">
      {/* Header */}
      <div className="space-y-1.5 border-b border-[#1C1C24] pb-5">
        <span className="text-[10px] font-mono tracking-widest text-[#71717A] uppercase">
          MEDIA INGESTION & SYNTHESIS
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
          Import Video into VYORA
        </h1>
        <p className="text-xs text-[#71717A]">
          Upload any lecture, conference talk, or meeting recording to extract source-grounded intelligence.
        </p>
      </div>

      {/* Main Studio Card */}
      <div className="p-6 rounded-3xl bg-[#070709] border border-[#1A1A22] shadow-2xl space-y-6">
        {!isProcessing ? (
          <>
            {/* Mode Switcher */}
            <div className="flex items-center justify-center">
              <div className="inline-flex p-1 rounded-xl bg-[#0E0E14] border border-[#1F1F28] font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveMode('upload')}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all ${
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
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold transition-all ${
                    activeMode === 'url'
                      ? 'bg-white text-black shadow-md'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Video Link</span>
                </button>
              </div>
            </div>

            {/* Mode 1: File Upload */}
            {activeMode === 'upload' ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-violet-500 bg-violet-950/20'
                    : selectedFile
                    ? 'border-violet-500/50 bg-[#0A0A0F]'
                    : 'border-[#1F1F28] hover:border-zinc-700 bg-[#050507]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*,.mp4,.mkv,.mov,.webm,.avi,.flv,.m4v,.ts"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0E0E14] border border-[#202028] flex items-center justify-center text-violet-400">
                    {selectedFile ? <FileCheck className="w-6 h-6 text-emerald-400" /> : <Upload className="w-6 h-6" />}
                  </div>

                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white max-w-sm truncate">{selectedFile.name}</p>
                      <p className="text-[11px] font-mono text-emerald-400">
                        {formatFileSize(selectedFile.size)} · Ready for Extraction
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white">
                        Click or drag video file to this area
                      </p>
                      <p className="text-[11px] text-[#52525B] font-mono">
                        MP4, WebM, MOV, MKV, AVI, TS (Up to 500MB+)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Mode 2: URL Ingestion */
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-mono text-[#A1A1AA] uppercase tracking-wider block">
                    Public Video URL (YouTube, MP4 Stream)
                  </label>
                  <div className="relative flex items-center">
                    <LinkIcon className="w-4 h-4 text-[#52525B] absolute left-3.5 pointer-events-none" />
                    <input
                      type="url"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full pl-10 pr-4 py-3 bg-[#050507] border border-[#1F1F28] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-violet-500 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-[#52525B] font-mono">
                    Direct public streams and YouTube videos are analyzed without downloading to local disk.
                  </p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-mono shrink-0 transition-colors"
                >
                  Configure Key
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1C1C24]">
              <span className="text-xs font-mono text-[#71717A]">
                AI Model Engine:{' '}
                <span className="text-violet-400">
                  Gemini Auto · {systemConfig?.display_model || 'Gemini 2.0 Flash'}
                </span>
              </span>

              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={activeMode === 'upload' ? !selectedFile : !videoUrl.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-xl shadow-white/5"
              >
                <span>Extract Video Intelligence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Live 3D Pipeline Visualization during actual processing */
          <div className="py-6 space-y-6 text-center">
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

              <div className="w-full h-1.5 rounded-full bg-[#121218] overflow-hidden border border-[#202028]">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 via-purple-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-xs text-[#FAFAFA] font-medium pt-1 font-mono">
                {statusMessage || 'Synthesizing knowledge layers...'}
              </p>
              <p className="text-[10px] font-mono text-[#52525B]">
                Gemini Auto ({systemConfig?.display_model || 'Gemini 2.0 Flash'}) is interleaving visual frames, waveforms, and OCR layers.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};