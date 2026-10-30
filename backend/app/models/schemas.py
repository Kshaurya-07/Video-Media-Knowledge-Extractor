from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class Chapter(BaseModel):
    start_time: float = Field(..., description="Start time in seconds")
    start_time_formatted: str = Field(..., description="Formatted timestamp (e.g., 01:23)")
    end_time: float = Field(..., description="End time in seconds")
    end_time_formatted: str = Field(..., description="Formatted timestamp (e.g., 02:45)")
    title: str = Field(..., description="Chapter title")
    summary: str = Field(..., description="Summary of this chapter")
    key_moments: List[str] = Field(default_factory=list, description="Key moments or bullet points")

class TranscriptSegment(BaseModel):
    start_time: float = Field(..., description="Start time in seconds")
    start_time_formatted: str = Field(..., description="Formatted timestamp")
    end_time: float = Field(..., description="End time in seconds")
    end_time_formatted: str = Field(..., description="Formatted timestamp")
    speaker: Optional[str] = Field("Speaker", description="Identified speaker name or ID")
    text: str = Field(..., description="Spoken dialogue or text")

class VisualScene(BaseModel):
    start_time: float = Field(..., description="Start time in seconds")
    start_time_formatted: str = Field(..., description="Formatted timestamp")
    end_time: float = Field(..., description="End time in seconds")
    end_time_formatted: str = Field(..., description="Formatted timestamp")
    description: str = Field(..., description="Visual scene description")
    visual_elements: List[str] = Field(default_factory=list, description="Visual objects, slide types, diagrams")
    detected_text: List[str] = Field(default_factory=list, description="OCR text detected on screen")

class EntityItem(BaseModel):
    name: str = Field(..., description="Entity or concept name")
    category: str = Field(..., description="Category: Person, Technology, Concept, Metric, Tool")
    description: str = Field(..., description="Brief explanation in context")
    mentions_count: int = Field(1, description="Approximate frequency of mention")
    timestamps: List[str] = Field(default_factory=list, description="Associated timestamps")

class ActionItem(BaseModel):
    task: str = Field(..., description="Actionable item, next step, or recommendation")
    assignee_or_speaker: Optional[str] = Field(None, description="Responsible person or speaker")
    context: str = Field(..., description="Context of the task")
    timestamp: Optional[str] = Field(None, description="Timestamp where this was mentioned")

class MediaMetadata(BaseModel):
    file_id: str
    filename: str
    media_type: str  # 'video' or 'audio'
    duration_seconds: float
    duration_formatted: str
    file_size_bytes: int
    source_url: Optional[str] = None

class SentimentAndTone(BaseModel):
    overall: str = Field(default="Informative", description="Overall sentiment: Positive, Analytical, Instructional, Serious, etc.")
    energy_level: str = Field(default="Moderate", description="Energy level: High, Moderate, Calm")
    communication_style: str = Field(default="Conversational", description="Brief description of communication style")

class MediaAnalysisResult(BaseModel):
    file_id: str
    filename: str
    media_type: str
    duration_seconds: float
    duration_formatted: str
    title: str
    overview: str
    executive_summary: str
    key_takeaways: List[str]
    chapters: List[Chapter]
    transcript: List[TranscriptSegment]
    visual_scenes: List[VisualScene]
    entities: List[EntityItem]
    action_items: List[ActionItem]
    sentiment_and_tone: Any = Field(default_factory=dict)
    created_at: str
    selected_model: Optional[str] = Field(None, description="Gemini model selected for analysis")
    model_selection_mode: Optional[str] = Field("automatic", description="Model selection mode (automatic or preferred_override)")
    fallback_history: List[Dict[str, Any]] = Field(default_factory=list, description="Audit trail of model failovers during analysis")
    source_url: Optional[str] = Field(None, description="Optional remote stream/YouTube URL")

class MediaOverviewExtraction(BaseModel):
    title: str = Field(..., description="A concise, descriptive title for the media content")
    duration_seconds: float = Field(default=120.0, description="Estimated total duration in seconds")
    duration_formatted: str = Field(default="02:00", description="Formatted duration string (e.g. '04:15' or '01:23:45')")
    overview: str = Field(..., description="2-3 sentence high-level overview")
    executive_summary: str = Field(..., description="Rich, detailed executive summary covering major themes, arguments, and conclusions")
    key_takeaways: List[str] = Field(default_factory=list, description="4-8 bullet points highlighting key insights")
    action_items: List[ActionItem] = Field(default_factory=list, description="Actionable next steps or takeaways")
    sentiment_and_tone: SentimentAndTone = Field(default_factory=SentimentAndTone, description="Overall tone, energy level, and communication style")

class MediaChaptersExtraction(BaseModel):
    chapters: List[Chapter] = Field(default_factory=list, description="Chronological chapters covering the entire duration with key moments")

class MediaTranscriptAndScenesExtraction(BaseModel):
    transcript: List[TranscriptSegment] = Field(default_factory=list, description="Timestamped spoken dialogue segments")
    visual_scenes: List[VisualScene] = Field(default_factory=list, description="Chronological visual scene descriptions and OCR")
    entities: List[EntityItem] = Field(default_factory=list, description="Key entities and technologies mentioned")

class ExtractionErrorDetail(BaseModel):
    error_code: str = Field(..., description="Machine-readable error code: e.g. GEMINI_RESPONSE_TRUNCATED, GEMINI_TOKEN_LIMIT")
    message: str = Field(..., description="User-safe descriptive message")
    job_id: Optional[str] = None
    stage: Optional[str] = None
    retryable: bool = True

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str

class ChatRequest(BaseModel):
    file_id: str
    message: str
    history: List[ChatMessage] = Field(default_factory=list)
    api_key: Optional[str] = None

class TimestampCitation(BaseModel):
    seconds: float
    formatted: str
    context: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[TimestampCitation] = Field(default_factory=list)

class VerifyKeyRequest(BaseModel):
    api_key: str

class VerifyKeyResponse(BaseModel):
    valid: bool
    message: str
