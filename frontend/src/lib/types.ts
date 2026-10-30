export interface Chapter {
  start_time: number;
  start_time_formatted: string;
  end_time: number;
  end_time_formatted: string;
  title: string;
  summary: string;
  key_moments: string[];
}

export interface TranscriptSegment {
  start_time: number;
  start_time_formatted: string;
  end_time: number;
  end_time_formatted: string;
  speaker: string;
  text: string;
}

export interface VisualScene {
  start_time: number;
  start_time_formatted: string;
  end_time: number;
  end_time_formatted: string;
  description: string;
  visual_elements: string[];
  detected_text: string[];
}

export interface EntityItem {
  name: string;
  category: string;
  description: string;
  mentions_count: number;
  timestamps: string[];
}

export interface ActionItem {
  task: string;
  assignee_or_speaker?: string;
  context: string;
  timestamp?: string;
}

export interface SentimentAndTone {
  overall?: string;
  energy_level?: string;
  communication_style?: string;
}

export interface MediaAnalysisResult {
  file_id: string;
  filename: string;
  media_type: 'video' | 'audio';
  duration_seconds: number;
  duration_formatted: string;
  title: string;
  overview: string;
  executive_summary: string;
  key_takeaways: string[];
  chapters: Chapter[];
  transcript: TranscriptSegment[];
  visual_scenes: VisualScene[];
  entities: EntityItem[];
  action_items: ActionItem[];
  sentiment_and_tone: SentimentAndTone;
  created_at: string;
  selected_model?: string;
  model_selection_mode?: 'automatic' | 'preferred_override' | 'fallback';
  source_url?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  description: string;
  media_type: 'video' | 'audio';
  filename: string;
  source_url?: string;
  duration_seconds: number;
  duration_formatted: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  chapter_count: number;
  transcript_count: number;
  created_at: string;
}

export interface Note {
  id: string;
  project_id: string;
  user_id: string;
  timestamp_seconds?: number;
  timestamp_formatted?: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  project_id: string;
  user_id: string;
  timestamp_seconds: number;
  timestamp_formatted: string;
  label: string;
  created_at: string;
}

export interface TimestampCitation {
  seconds: number;
  formatted: string;
  context: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: TimestampCitation[];
  timestamp: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
}

export type ProcessingStage =
  | 'QUEUED'
  | 'UPLOADING'
  | 'VALIDATING'
  | 'EXTRACTING_MEDIA'
  | 'SENDING_TO_AI'
  | 'ANALYZING_VIDEO'
  | 'GENERATING_CHAPTERS'
  | 'SAVING_RESULTS'
  | 'EXTRACTING_AUDIO'
  | 'TRANSCRIBING'
  | 'IDENTIFYING_CHAPTERS'
  | 'INDEXING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED';

export interface ProcessingJobStatus {
  job_id: string;
  project_id?: string;
  stage: ProcessingStage;
  progress_percent: number;
  message: string;
  error_message?: string;
  selected_model?: string;
  model_selection_mode?: string;
  fallback_history?: string;
}
