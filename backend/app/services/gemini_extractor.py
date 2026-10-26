import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from google import genai
from google.genai import types
from fastapi import HTTPException

from app.config import DEFAULT_MODEL, DATA_CACHE_DIR, get_api_key
from app.models.schemas import MediaAnalysisResult
from app.services.media_service import get_media_path, get_media_mime_type, format_seconds

# Map to store active file_refs for Q&A: file_id -> gemini_file_uri / name
FILE_REF_REGISTRY: Dict[str, str] = {}

EXTRACTION_SYSTEM_PROMPT = """You are an expert Multimodal Video & Media Knowledge Extractor.
Your goal is to deeply inspect and extract all information from the provided audio/video media file.

You must generate a comprehensive, highly accurate JSON response with the following keys:
1. "title": A concise, descriptive title for the media content.
2. "duration_seconds": Total duration in seconds (estimate accurately from the media).
3. "duration_formatted": Formatted duration string (e.g. "04:15" or "01:23:45").
4. "overview": A 2-3 sentence high-level overview.
5. "executive_summary": A rich, detailed executive summary (2-4 paragraphs) covering all major themes, arguments, data, and conclusions.
6. "key_takeaways": A list of 4-8 bullet points highlighting the most important insights.
7. "chapters": A chronological list of logical chapters/sections throughout the media. Each chapter must have:
   - "start_time": float (seconds)
   - "start_time_formatted": "MM:SS" (e.g. "00:00", "01:30")
   - "end_time": float (seconds)
   - "end_time_formatted": "MM:SS"
   - "title": Chapter title
   - "summary": Summary of this segment
   - "key_moments": List of 2-4 key events or discussion points in this chapter
8. "transcript": A structured timestamped transcript of the spoken dialogue. Each entry must have:
   - "start_time": float (seconds)
   - "start_time_formatted": "MM:SS"
   - "end_time": float (seconds)
   - "end_time_formatted": "MM:SS"
   - "speaker": Name or label of the speaker (e.g., "Speaker 1", "Presenter", "Interviewer")
   - "text": Exact or cleaned spoken speech
9. "visual_scenes": For videos, extract chronological visual scenes, slides, screen captures, or diagrams. For audio-only, describe audio cues/phases. Each scene must have:
   - "start_time": float (seconds)
   - "start_time_formatted": "MM:SS"
   - "end_time": float (seconds)
   - "end_time_formatted": "MM:SS"
   - "description": Detailed description of what is visible or occurring
   - "visual_elements": List of visual tags (e.g. ["Code Editor", "Architecture Diagram", "Slide Presentation", "Webcam"])
   - "detected_text": OCR text visible on screen (slide titles, code lines, captions)
10. "entities": Key entities, technologies, metrics, concepts, and people mentioned. Each item:
    - "name": Entity name
    - "category": Category ("Technology", "Concept", "Person", "Metric", "Tool", "Company")
    - "description": Explanation in context
    - "mentions_count": Approximate frequency
    - "timestamps": List of timestamp strings where mentioned
11. "action_items": Actionable next steps, recommendations, homework, or takeaways explicitly stated or implied. Each item:
    - "task": Description of task
    - "assignee_or_speaker": Who should do it or who proposed it
    - "context": Context or why it matters
    - "timestamp": Timestamp string
12. "sentiment_and_tone": Object with:
    - "overall": "Positive", "Analytical", "Instructional", "Urgent", etc.
    - "energy_level": "High", "Moderate", "Calm"
    - "communication_style": Brief description

IMPORTANT: Respond ONLY with valid, raw JSON matching this structure. Do not include markdown code block formatting (e.g. ```json ... ```).
"""

def clean_json_text(text: str) -> str:
    """Strip markdown code fence if model returned it."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def get_cached_result(file_id: str) -> Optional[MediaAnalysisResult]:
    cache_file = DATA_CACHE_DIR / f"{file_id}.json"
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return MediaAnalysisResult(**data)
        except Exception:
            return None
    return None

def save_cache_result(result: MediaAnalysisResult):
    cache_file = DATA_CACHE_DIR / f"{result.file_id}.json"
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(result.model_dump(), f, indent=2)

async def extract_media_knowledge(file_id: str, api_key: Optional[str] = None) -> MediaAnalysisResult:
    # 1. Check cache first
    cached = get_cached_result(file_id)
    if cached:
        return cached

    # 2. Get API Key
    resolved_key = get_api_key(api_key)
    if not resolved_key:
        raise HTTPException(
            status_code=401,
            detail="Google Gemini API Key is required. Please set GEMINI_API_KEY or configure it in Settings."
        )

    # 3. Locate media file
    media_path = get_media_path(file_id)
    mime_type = get_media_mime_type(media_path)
    is_video = mime_type.startswith("video/")

    # 4. Initialize Google GenAI client
    try:
        client = genai.Client(api_key=resolved_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to initialize Gemini Client: {str(e)}")

    # 5. Upload file to Gemini Files API
    try:
        uploaded_file = client.files.upload(file=str(media_path), mime_type=mime_type)
        FILE_REF_REGISTRY[file_id] = uploaded_file.name

        # For video files, wait until processing finishes
        if is_video:
            max_wait = 300  # up to 5 minutes
            start_wait = time.time()
            while uploaded_file.state.name == "PROCESSING":
                if time.time() - start_wait > max_wait:
                    raise HTTPException(status_code=504, detail="Video processing timed out on Gemini API")
                time.sleep(3)
                uploaded_file = client.files.get(name=uploaded_file.name)

            if uploaded_file.state.name == "FAILED":
                raise HTTPException(status_code=500, detail="Gemini failed to process the uploaded video")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload to Gemini failed: {str(e)}")

    # 6. Extract knowledge using Gemini
    try:
        prompt = (
            f"Analyze this {'video' if is_video else 'audio'} file named '{media_path.name}'. "
            "Extract complete knowledge according to the system prompt instructions."
        )

        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                system_instruction=EXTRACTION_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2,
            )
        )

        raw_text = clean_json_text(response.text)
        data = json.loads(raw_text)

        # Ensure core fields are populated
        data["file_id"] = file_id
        data["filename"] = media_path.name
        data["media_type"] = "video" if is_video else "audio"
        data["created_at"] = datetime.now().isoformat()
        
        if "duration_seconds" not in data or not data["duration_seconds"]:
            data["duration_seconds"] = 120.0
        if "duration_formatted" not in data or not data["duration_formatted"]:
            data["duration_formatted"] = format_seconds(data["duration_seconds"])

        result = MediaAnalysisResult(**data)
        save_cache_result(result)
        return result

    except json.JSONDecodeError as jde:
        raise HTTPException(status_code=500, detail=f"Failed to parse Gemini JSON response: {str(jde)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
