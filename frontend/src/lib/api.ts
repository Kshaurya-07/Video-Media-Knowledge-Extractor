import {
  MediaAnalysisResult,
  ProjectSummary,
  Note,
  Bookmark,
  TimestampCitation,
  ProcessingJobStatus,
  TranscriptSegment,
} from './types';
import { KnowledgeGraphNode, KnowledgeGraphLink } from '../components/3d/KnowledgeMap3D';

function resolveApiBase(): string {
  let url = import.meta.env.VITE_API_URL;
  if (!url || typeof url !== 'string') return '/api';
  url = url.trim().replace(/\/+$/, '');
  if (!url) return '/api';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      url = `http://${url}`;
    } else {
      url = `https://${url}`;
    }
  }
  // Strip trailing /api to prevent /api/api duplication
  if (url.endsWith('/api')) {
    return url;
  }
  return `${url}/api`;
}

const API_BASE = resolveApiBase();

export function getStoredApiKey(): string {
  return localStorage.getItem('vyora_gemini_api_key') || '';
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem('vyora_gemini_api_key', key.trim());
}

export function clearStoredApiKey(): void {
  localStorage.removeItem('vyora_gemini_api_key');
}

export function getStoredUser(): { email: string; name: string } | null {
  const raw = localStorage.getItem('vyora_user_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUser(user: { email: string; name: string } | null): void {
  if (user) {
    localStorage.setItem('vyora_user_session', JSON.stringify(user));
  } else {
    localStorage.removeItem('vyora_user_session');
  }
}

export type BackendConnectionState = 'checking' | 'waking_up' | 'connected' | 'offline';

export async function probeBackendWithBackoff(
  onStateUpdate?: (state: BackendConnectionState, attempt: number, message: string) => void,
  maxAttempts: number = 6
): Promise<boolean> {
  const delays = [0, 2000, 4000, 8000, 15000, 20000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delay = delays[attempt] || 15000;
    if (delay > 0) {
      if (onStateUpdate) {
        onStateUpdate(
          'waking_up',
          attempt + 1,
          `Render Free Tier container is waking up (attempt ${attempt + 1}/${maxAttempts})...`
        );
      }
      await new Promise((r) => setTimeout(r, delay));
    } else if (onStateUpdate) {
      onStateUpdate('checking', 1, 'Checking backend connection...');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${API_BASE}/ready`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (onStateUpdate) {
          onStateUpdate('connected', attempt + 1, 'Connected to backend.');
        }
        return true;
      }
    } catch {
      // transient failure or timeout during cold start
    }
  }

  if (onStateUpdate) {
    onStateUpdate('offline', maxAttempts, 'Backend unreachable. Click to retry.');
  }
  return false;
}

export interface SystemConfig {
  provider: string;
  configured_model: string;
  display_model: string;
  status: string;
  has_api_key_configured?: boolean;
  server_api_key_configured?: boolean;
  user_api_key_provided?: boolean;
}

export function formatModelDisplay(modelId?: string): string {
  if (!modelId) return 'Gemini 2.0 Flash';
  if (modelId === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
  if (modelId === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';
  if (modelId === 'gemini-1.5-pro') return 'Gemini 1.5 Pro';
  if (modelId === 'gemini-2.5-flash') return 'Gemini 2.5 Flash';
  return modelId
    .replace(/^models\//, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (res.ok) {
      const data = await res.json();
      return {
        provider: data.provider || 'Google Gemini',
        configured_model: data.configured_model || 'gemini-2.0-flash',
        display_model: data.display_model || formatModelDisplay(data.configured_model),
        status: data.status || 'configured',
        has_api_key_configured: Boolean(data.has_api_key_configured),
        server_api_key_configured: Boolean(data.server_api_key_configured),
        user_api_key_provided: Boolean(data.user_api_key_provided),
      };
    }
  } catch {
    // fallback to /health
  }

  try {
    const health = await fetch(`${API_BASE}/health`);
    if (health.ok) {
      const hData = await health.json();
      const model = hData.configured_model || hData.model || 'gemini-2.0-flash';
      return {
        provider: hData.provider || 'Google Gemini',
        configured_model: model,
        display_model: hData.display_model || formatModelDisplay(model),
        status: hData.status || 'healthy',
        has_api_key_configured: Boolean(hData.has_api_key_configured),
        server_api_key_configured: Boolean(hData.has_api_key_configured),
        user_api_key_provided: false,
      };
    }
  } catch {
    // offline fallback
  }

  return {
    provider: 'Google Gemini',
    configured_model: 'gemini-2.0-flash',
    display_model: 'Gemini 2.0 Flash',
    status: 'offline',
    has_api_key_configured: false,
    server_api_key_configured: false,
    user_api_key_provided: false,
  };
}

export interface CandidateModelInfo {
  model_id: string;
  display_name: string;
  tier_score: number;
  input_token_limit?: number;
}

export interface ModelStatusResponse {
  provider: string;
  selection_mode?: 'automatic' | 'preferred_override' | 'fallback';
  selected_model?: string;
  configured_model: string;
  display_model: string;
  status: 'connected' | 'configured' | 'pending_key' | 'offline' | 'error' | 'no_compatible_model';
  has_api_key: boolean;
  server_api_key_configured?: boolean;
  user_api_key_provided?: boolean;
  model_verified: boolean;
  last_checked?: string;
  compatible_models_count?: number;
  candidate_models?: CandidateModelInfo[];
  message?: string;
}

export async function fetchModelStatus(): Promise<ModelStatusResponse> {
  const customKey = getStoredApiKey();
  const headers: Record<string, string> = {};
  if (customKey) {
    headers['X-Gemini-Api-Key'] = customKey;
  }

  try {
    const res = await fetch(`${API_BASE}/system/model-status`, { headers });
    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        has_api_key: Boolean(data.has_api_key),
        server_api_key_configured: Boolean(data.server_api_key_configured),
        user_api_key_provided: Boolean(data.user_api_key_provided || customKey),
      };
    }
  } catch {
    // fallback to /config
  }

  try {
    const res = await fetch(`${API_BASE}/config`, { headers });
    if (res.ok) {
      const data = await res.json();
      return {
        provider: data.provider || 'Google Gemini',
        selection_mode: data.selection_mode || 'automatic',
        selected_model: data.selected_model || data.configured_model || 'gemini-2.0-flash',
        configured_model: data.configured_model || 'gemini-2.0-flash',
        display_model: data.display_model || formatModelDisplay(data.configured_model),
        status: data.status === 'connected' ? 'connected' : data.status === 'configured' ? 'configured' : 'pending_key',
        has_api_key: Boolean(data.has_api_key_configured),
        server_api_key_configured: Boolean(data.server_api_key_configured),
        user_api_key_provided: Boolean(data.user_api_key_provided || customKey),
        model_verified: Boolean(data.has_api_key_configured),
        compatible_models_count: data.compatible_models_count || 1,
      };
    }
  } catch {
    // offline
  }

  return {
    provider: 'Google Gemini',
    selection_mode: 'automatic',
    selected_model: 'gemini-2.0-flash',
    configured_model: 'gemini-2.0-flash',
    display_model: 'Gemini 2.0 Flash',
    status: 'offline',
    has_api_key: Boolean(customKey),
    server_api_key_configured: false,
    user_api_key_provided: Boolean(customKey),
    model_verified: false,
    message: 'Backend service unreachable',
  };
}

export async function refreshModelCache(): Promise<ModelStatusResponse> {
  const customKey = getStoredApiKey();
  const headers: Record<string, string> = {};
  if (customKey) {
    headers['X-Gemini-Api-Key'] = customKey;
  }

  const res = await fetch(`${API_BASE}/system/model-cache/refresh`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    throw new Error('Failed to refresh model discovery cache');
  }
  return res.json();
}

export async function checkBackendHealth(): Promise<{
  status: string;
  has_api_key_configured: boolean;
  model?: string;
  display_model?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'offline', has_api_key_configured: false, model: 'gemini-2.0-flash', display_model: 'Gemini 2.0 Flash' };
  }
}

export async function verifyApiKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/verify-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      return {
        valid: false,
        message: err?.detail || `Verification request failed (${res.status}: ${res.statusText})`,
      };
    }
    return await res.json();
  } catch (err: any) {
    return {
      valid: false,
      message: err.message || 'Network error connecting to backend service.',
    };
  }
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) return [];
  return await res.json();
}

export async function fetchProjectDetails(id: string): Promise<MediaAnalysisResult> {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) {
    throw new Error('Failed to load project details');
  }
  return await res.json();
}

export async function getCachedAnalysis(fileId: string): Promise<MediaAnalysisResult | null> {
  try {
    return await fetchProjectDetails(fileId);
  } catch {
    return null;
  }
}

export async function extractKnowledge(fileId: string): Promise<MediaAnalysisResult> {
  const key = getStoredApiKey();
  const headers: Record<string, string> = {};
  if (key) {
    headers['X-Gemini-Api-Key'] = key;
  }

  const res = await fetch(`${API_BASE}/extract/${fileId}`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Extraction failed' }));
    throw new Error(err.detail || 'Knowledge extraction failed');
  }

  return await res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function uploadMedia(file: File): Promise<{ file_id: string; filename: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(err.detail || 'Upload failed');
  }

  return await res.json();
}

export async function startProcessingJob(
  fileId?: string,
  url?: string,
  title?: string
): Promise<{ job_id: string; project_id: string; stage: string }> {
  const key = getStoredApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['X-Gemini-Api-Key'] = key;

  const res = await fetch(`${API_BASE}/process/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ file_id: fileId, url, title, api_key: key || undefined }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to start processing job' }));
    throw new Error(err.detail || 'Failed to start processing job');
  }

  return await res.json();
}

export async function fetchJobStatus(jobId: string): Promise<ProcessingJobStatus> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error('Job status check failed');
  return await res.json();
}

export async function fetchKnowledgeGraph(
  projectId?: string
): Promise<{ nodes: KnowledgeGraphNode[]; links: KnowledgeGraphLink[] }> {
  const url = projectId
    ? `${API_BASE}/knowledge-graph?project_id=${encodeURIComponent(projectId)}`
    : `${API_BASE}/knowledge-graph`;
  const res = await fetch(url);
  if (!res.ok) return { nodes: [], links: [] };
  return await res.json();
}

export async function fetchNotes(projectId: string): Promise<Note[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/notes`);
  if (!res.ok) return [];
  return await res.json();
}

export async function createNote(
  projectId: string,
  title: string,
  content: string,
  timestampSeconds?: number,
  timestampFormatted?: string
): Promise<Note> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      timestamp_seconds: timestampSeconds,
      timestamp_formatted: timestampFormatted,
    }),
  });
  if (!res.ok) throw new Error('Failed to create note');
  return await res.json();
}

export async function deleteNote(noteId: string): Promise<void> {
  await fetch(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
}

export async function fetchBookmarks(projectId: string): Promise<Bookmark[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/bookmarks`);
  if (!res.ok) return [];
  return await res.json();
}

export async function createBookmark(
  projectId: string,
  label: string,
  timestampSeconds: number,
  timestampFormatted: string
): Promise<Bookmark> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label,
      timestamp_seconds: timestampSeconds,
      timestamp_formatted: timestampFormatted,
    }),
  });
  if (!res.ok) throw new Error('Failed to create bookmark');
  return await res.json();
}

export async function deleteBookmark(bmId: string): Promise<void> {
  await fetch(`${API_BASE}/bookmarks/${bmId}`, { method: 'DELETE' });
}

export async function searchTranscript(
  projectId: string,
  query: string
): Promise<{ query: string; count: number; matches: TranscriptSegment[] }> {
  const res = await fetch(
    `${API_BASE}/projects/${projectId}/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) return { query, count: 0, matches: [] };
  return await res.json();
}

export async function askMediaQuestion(
  fileId: string,
  message: string,
  history: { role: string; content: string }[]
): Promise<{ answer: string; citations: TimestampCitation[] }> {
  const key = getStoredApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['X-Gemini-Api-Key'] = key;

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      file_id: fileId,
      message,
      history,
      api_key: key || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat query failed' }));
    throw new Error(err.detail || 'Chat query failed');
  }

  return await res.json();
}

export function getMediaStreamUrl(fileId: string): string {
  return `${API_BASE}/media/${fileId}`;
}
