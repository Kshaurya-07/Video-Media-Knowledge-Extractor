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

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

export function getStoredApiKey(): string {
  return localStorage.getItem('vyora_gemini_api_key') || '';
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem('vyora_gemini_api_key', key.trim());
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

export async function checkBackendHealth(): Promise<{ status: string; has_api_key_configured: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return await res.json();
  } catch {
    return { status: 'offline', has_api_key_configured: false };
  }
}

export async function verifyApiKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/verify-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
  return await res.json();
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
