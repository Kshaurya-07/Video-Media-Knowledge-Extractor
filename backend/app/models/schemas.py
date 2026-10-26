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
    sentiment_and_tone: Dict[str, Any] = Field(default_factory=dict)
    created_at: str

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
