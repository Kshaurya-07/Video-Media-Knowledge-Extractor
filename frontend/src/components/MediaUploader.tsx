import React, { useState, useRef } from 'react';
import { Upload, Video, Sparkles, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { uploadMedia, extractKnowledge, getCachedAnalysis } from '../lib/api';
import { MediaAnalysisResult } from '../lib/types';

interface MediaUploaderProps {
  onAnalysisComplete: (result: MediaAnalysisResult) => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onAnalysisComplete,
  onOpenSettings,
  hasApiKey,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setStatusText(`Uploading ${file.name}...`);

    try {
      // 1. Upload to backend
      const meta = await uploadMedia(file);
      
      // 2. Extract knowledge using Gemini
      setStatusText('Multimodal AI extraction in progress with Gemini 3.8 Flash...');
      const result = await extractKnowledge(meta.file_id);
      
      setStatusText('Knowledge graph & transcript synthesized!');
      onAnalysisComplete(result);
    } catch (err: any) {
      if (err.message && err.message.includes('API Key is required')) {
        setErrorMessage('A Google Gemini API Key is required to analyze new videos.');
        onOpenSettings();
      } else {
        setErrorMessage(err.message || 'Processing failed. Please check backend server.');
      }
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDemoLoad = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setStatusText('Loading interactive demo presentation...');
    try {
      const demoResult = await getCachedAnalysis('demo_presentation');
      if (demoResult) {
        onAnalysisComplete(demoResult);
      } else {
        setErrorMessage('Demo data could not be loaded. Please ensure the backend is running.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load demo.');
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Hero Badge */}
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Multimodal Intelligence Platform</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Extract Deep Knowledge from Video & Audio
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Transform lectures, meetings, tutorials, and podcasts into structured chapters,
          searchable transcripts, visual scene insights, and interactive Q&A citations.
        </p>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              processFile(e.target.files[0]);
            }
          }}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">{statusText}</p>
              <p className="text-xs text-slate-400 mt-1">
                Gemini is synthesizing chapters, OCR text, and semantic entities...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-105 transition-transform">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-200">
                Drag and drop your media file, or <span className="text-indigo-400 underline underline-offset-4">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1.5">
                Supports MP4, WebM, MOV, MP3, WAV, M4A up to 500MB
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
          {!hasApiKey && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 font-medium text-xs transition-colors shrink-0"
            >
              Configure Key
            </button>
          )}
        </div>
      )}

      {/* Demo Section */}
      <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/30 rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Video className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-200">
              Instant Demo: "Architecting Real-Time Multimodal AI"
            </p>
            <p className="text-[11px] text-slate-400">
              Explore timestamped chapters, OCR extraction, and grounded Q&A with zero setup
            </p>
          </div>
        </div>

        <button
          onClick={handleDemoLoad}
          disabled={isProcessing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all w-full sm:w-auto justify-center shrink-0"
        >
          <span>Launch Demo</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
