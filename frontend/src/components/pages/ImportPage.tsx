import React, { useState, useRef, useEffect } from 'react';
import { ProcessingCore3D, ProcessingStage } from '../3d/ProcessingCore3D';
import {
  Upload,
  Link as LinkIcon,
  FileCheck,
  AlertCircle,
  ArrowRight,
  Terminal,
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

  // Live mono terminal logs during processing
  const [terminalLogs, setTerminalLogs] = useState<Array<{ time: string; text: string; success?: boolean }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSystemConfig().then(setSystemConfig).catch(() => {});
  }, []);

  // Poll for background job progress
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

        // Add to terminal logs
        const now = new Date();
        const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setTerminalLogs((prev) => {
          const lastLog = prev[prev.length - 1];
          if (lastLog && lastLog.text === job.message) return prev;
          return [...prev.slice(-8), { time: timeStr, text: job.message || `${job.stage} (${job.progress_percent}%)` }];
        });

        if (job.stage === 'COMPLETED') {
          clearInterval(interval);
          setTerminalLogs((prev) => [
            ...prev,
            { time: timeStr, text: 'Knowledge extraction complete. Relocating to workspace...', success: true },
          ]);
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
    setStatusMessage('Checking backend service readiness...');
    setTerminalLogs([
      { time: '00:01', text: 'Initializing VYORA background execution worker...' },
      { time: '00:02', text: 'Resolving multimodal attention engine (Gemini 2.0 Flash)...' },
    ]);

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
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 text-left">
      {/* Header */}
      <div className="space-y-1.5 border-b border-neutral-300 pb-5">
        <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
          [ 01 / MEDIA INGESTION ]
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 font-sans">
          Import video into VYORA
        </h1>
        <p className="text-xs text-neutral-500">
          Upload any lecture, conference talk, or meeting recording to extract source-grounded intelligence.
        </p>
      </div>

      {/* Main Studio Card */}
      <div className="p-6 bg-white border border-neutral-300 rounded-sm space-y-6">
        {!isProcessing ? (
          <>
            {/* Mode Switcher */}
            <div className="flex items-center justify-start border-b border-neutral-200 pb-4">
              <div className="inline-flex p-0.5 rounded-sm bg-neutral-100 border border-neutral-300 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setActiveMode('upload')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-sm font-medium transition-all ${
                    activeMode === 'upload'
                      ? 'bg-neutral-950 text-white shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload file</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('url')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-sm font-medium transition-all ${
                    activeMode === 'url'
                      ? 'bg-neutral-950 text-white shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-950'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Video link</span>
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
                className={`border border-dashed rounded-sm p-8 sm:p-12 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-neutral-950 bg-neutral-100'
                    : selectedFile
                    ? 'border-neutral-950 bg-neutral-50'
                    : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50/40'
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
                  <div className="w-10 h-10 rounded-sm bg-white border border-neutral-300 flex items-center justify-center text-neutral-800">
                    {selectedFile ? <FileCheck className="w-5 h-5 text-neutral-950" /> : <Upload className="w-5 h-5" />}
                  </div>

                  {selectedFile ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-neutral-950 max-w-sm truncate">{selectedFile.name}</p>
                      <p className="text-[11px] font-mono text-neutral-500">
                        {formatFileSize(selectedFile.size)} · Ready for extraction
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-950">
                        Click or drag media file to this area
                      </p>
                      <p className="text-[11px] text-neutral-500 font-mono">
                        MP4, WebM, MOV, MKV, AVI, TS (Up to 500 MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Mode 2: URL Ingestion */
              <div className="space-y-3">
                <label className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider block">
                  Public video URL (YouTube, MP4 Stream)
                </label>
                <div className="relative flex items-center">
                  <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-300 rounded-sm text-xs text-neutral-950 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-950 font-mono"
                  />
                </div>
                <p className="text-[10px] text-neutral-500 font-mono">
                  Direct public media streams and YouTube URLs are verified with SSRF safety and ingested without disk buffering.
                </p>
              </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-sm bg-white border border-rose-300 flex items-center justify-between gap-3 text-xs text-rose-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-2.5 py-1 rounded-sm bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 text-[11px] font-mono shrink-0 transition-colors"
                >
                  Configure key
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <span className="text-xs font-mono text-neutral-500">
                AI Model Engine:{' '}
                <span className="text-neutral-950 font-semibold">
                  {systemConfig?.display_model || 'Gemini 2.0 Flash'}
                </span>
              </span>

              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={activeMode === 'upload' ? !selectedFile : !videoUrl.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-all"
              >
                <span>Start extracting</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Live Mono Progress Log in Dark Terminal Panel */
          <div className="dark-terminal bg-[#0a0a0a] text-white rounded-sm border border-neutral-800 p-6 space-y-6 font-mono text-left">
            {/* Terminal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 text-xs">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-neutral-400" />
                <span className="font-semibold text-neutral-200 uppercase tracking-wider">
                  EXECUTION WORKER · {jobId || 'RUNNING'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ACTIVE</span>
              </div>
            </div>

            {/* 3D Core with Stage Adaptivity */}
            <div className="w-full max-w-sm mx-auto h-52">
              <ProcessingCore3D stage={stage} progressPercent={progressPercent} />
            </div>

            {/* Stage Indicator & Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-200 font-semibold uppercase">{stage}</span>
                <span className="text-emerald-400 font-bold">{Math.round(progressPercent)}%</span>
              </div>

              <div className="w-full h-1.5 rounded-sm bg-neutral-900 overflow-hidden border border-neutral-800">
                <div
                  className="h-full bg-neutral-200 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-xs text-neutral-300 font-normal pt-1">
                {statusMessage || 'Synthesizing knowledge layers...'}
              </p>
            </div>

            {/* Monospaced Log Output Terminal Window */}
            <div className="bg-[#050505] border border-neutral-800 rounded-sm p-3.5 space-y-1.5 text-[11px] text-neutral-400 max-h-40 overflow-y-auto">
              <div className="text-[10px] text-neutral-600 pb-1 border-b border-neutral-900 flex justify-between">
                <span>SYSTEM LOG STREAM</span>
                <span>{systemConfig?.display_model || 'Gemini 2.0 Flash'}</span>
              </div>
              {terminalLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2.5 font-mono">
                  <span className="text-neutral-600 shrink-0">[{log.time}]</span>
                  <span className={log.success ? 'text-emerald-400' : 'text-neutral-300'}>
                    {log.success && <span className="mr-1">✓</span>}
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default ImportPage;
