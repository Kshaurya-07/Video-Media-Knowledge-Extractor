import json
import re
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger("vyora.extractor")

from google import genai
from google.genai import types
from fastapi import HTTPException

from app.config import DEFAULT_MODEL, DATA_CACHE_DIR, get_api_key
from app.services.model_discovery_service import (
    get_active_model_selection,
    blacklist_failed_model,
    format_model_display_name,
)
from app.models.schemas import (
    MediaAnalysisResult,
    Chapter,
    TranscriptSegment,
    VisualScene,
    EntityItem,
    ActionItem,
)
from app.services.media_service import get_media_path, get_media_mime_type, format_seconds

# Map to store active file_refs for Q&A: file_id -> gemini_file_uri / name
FILE_REF_REGISTRY: Dict[str, str] = {}

EXTRACTION_SYSTEM_PROMPT = """You are an expert Multimodal Video & Media Knowledge Extractor for VYORA AI.
Your goal is to deeply inspect and extract validated, high-fidelity knowledge from the provided media file.

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

IMPORTANT:
- Respond ONLY with valid, raw JSON matching this structure.
- Do NOT fabricate or invent transcript lines if audio is silent.
- Ensure all start_time and end_time values are strictly non-negative numbers.
"""

def clean_json_text(text: str) -> str:
    """Strip markdown code fence if model returned it."""
    if not text:
        return ""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def sanitize_error_message(err: Exception) -> str:
    """Strip any API keys or sensitive auth tokens from error message."""
    msg = str(err)
    # Redact key=... parameters first
    msg = re.sub(r'key=[0-9A-Za-z_-]+', 'key=[REDACTED]', msg)
    # Redact common Gemini API key pattern (AIzaSy...)
    msg = re.sub(r'AIzaSy[0-9A-Za-z_-]{33}', '[REDACTED_API_KEY]', msg)
    return msg

def map_gemini_error(e: Exception, action: str = "Extraction", model_name: Optional[str] = None) -> HTTPException:
    """Map Google Gemini API exceptions into clear, structured HTTPExceptions with safe messages."""
    clean_err = sanitize_error_message(e)
    err_lower = clean_err.lower()
    target_model = model_name or DEFAULT_MODEL

    if "404" in clean_err or "not_found" in err_lower or "no longer available" in err_lower or "not found" in err_lower:
        return HTTPException(
            status_code=404,
            detail=f"{action} failed: Model '{target_model}' is not found or unavailable to your project. Please verify GEMINI_MODEL or allow automatic selection. (Error: {clean_err})"
        )
    if "401" in clean_err or "api_key_invalid" in err_lower or "api key not valid" in err_lower or "unauthenticated" in err_lower or "invalid api key" in err_lower:
        return HTTPException(
            status_code=401,
            detail="Google Gemini API Key is invalid or unauthenticated. Please verify your key in Settings."
        )
    if "403" in clean_err or "permission_denied" in err_lower or "forbidden" in err_lower:
        return HTTPException(
            status_code=403,
            detail=f"Gemini API permission denied for model '{target_model}'. Please check project permissions and billing status."
        )
    if "429" in clean_err or "resource_exhausted" in err_lower or "quota" in err_lower or "rate limit" in err_lower:
        return HTTPException(
            status_code=429,
            detail="Gemini API rate limit or quota exceeded. Please try again in a few moments."
        )
    if "503" in clean_err or "unavailable" in err_lower:
        return HTTPException(
            status_code=503,
            detail="Google Gemini service is temporarily unavailable. Please retry shortly."
        )
    if "504" in clean_err or "deadline_exceeded" in err_lower or "timed out" in err_lower:
        return HTTPException(
            status_code=504,
            detail=f"{action} timed out contacting Gemini API."
        )

    return HTTPException(status_code=500, detail=f"{action} failed: {clean_err}")

def get_response_text(response: Any) -> str:
    """Extract text from either models.generate_content or interactions.create."""
    if hasattr(response, "text") and response.text:
        return response.text
    if hasattr(response, "output_text") and response.output_text:
        return response.output_text
    return ""

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

async def extract_media_knowledge(
    file_id: str,
    api_key: Optional[str] = None,
    on_stage: Optional[Callable[[str, float, str], None]] = None,
    selected_model_override: Optional[str] = None,
) -> MediaAnalysisResult:
    # 1. Check cache first
    cached = get_cached_result(file_id)
    if cached:
        return cached

    # 2. Resolve & Validate API Key
    resolved_key = get_api_key(api_key)
    if not resolved_key or not resolved_key.strip():
        raise HTTPException(
            status_code=401,
            detail="Google Gemini API Key is required. Please set GEMINI_API_KEY in environment or configure it in Settings."
        )

    # 3. Locate media file
    try:
        media_path = get_media_path(file_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Media file not found: {str(e)}")

    if not media_path.exists() or media_path.stat().st_size == 0:
        raise HTTPException(status_code=400, detail="Media file is empty or missing on disk.")

    mime_type = get_media_mime_type(media_path)
    is_video = mime_type.startswith("video/")

    # 4. Initialize Google GenAI client
    try:
        client = genai.Client(api_key=resolved_key.strip())
    except Exception as e:
        clean_err = sanitize_error_message(e)
        raise HTTPException(status_code=400, detail=f"Failed to initialize Gemini Client: {clean_err}")

    # 5. Upload file to Gemini Files API
    # Note: google-genai SDK requires passing mime_type via types.UploadFileConfig
    if on_stage:
        on_stage("UPLOADING", 25.0, f"Uploading {media_path.name} to Gemini Files API...")

    try:
        upload_config = types.UploadFileConfig(
            mime_type=mime_type,
            display_name=media_path.name
        )
        uploaded_file = client.files.upload(
            file=str(media_path),
            config=upload_config
        )
        FILE_REF_REGISTRY[file_id] = uploaded_file.name

        # For video/large files, poll file state until ACTIVE
        if is_video:
            max_wait = 360  # up to 6 minutes
            start_wait = time.time()
            if on_stage:
                on_stage("EXTRACTING_AUDIO", 40.0, "Gemini processing video frames & audio tracks...")

            while uploaded_file.state and (
                uploaded_file.state == types.FileState.PROCESSING or
                str(uploaded_file.state).endswith("PROCESSING")
            ):
                if time.time() - start_wait > max_wait:
                    raise HTTPException(status_code=504, detail="Video processing timed out on Gemini Files API")
                time.sleep(3)
                uploaded_file = client.files.get(name=uploaded_file.name)
                if on_stage:
                    elapsed = int(time.time() - start_wait)
                    pct = min(40.0 + (elapsed / max_wait) * 25.0, 65.0)
                    on_stage("TRANSCRIBING", pct, f"Ingesting multimodal temporal features ({elapsed}s)...")

            if uploaded_file.state and (
                uploaded_file.state == types.FileState.FAILED or
                str(uploaded_file.state).endswith("FAILED")
            ):
                err_info = getattr(uploaded_file, 'error', 'Internal error')
                raise HTTPException(status_code=500, detail=f"Gemini failed to process media: {err_info}")

    except HTTPException:
        raise
    except Exception as e:
        raise map_gemini_error(e, action="Media upload")

    # 6. Resolve Model (Automatic Discovery or Configured)
    active_model = selected_model_override
    selection_mode = "automatic"
    if not active_model:
        active_model, selection_mode, _ = get_active_model_selection(resolved_key)

    prompt = (
        f"Analyze this {'video' if is_video else 'audio'} file named '{media_path.name}'. "
        "Extract complete knowledge according to the system prompt instructions."
    )

    max_fallbacks = 3
    fallback_attempts = 0
    fallback_history = []
    response = None

    while True:
        logger.info(f"[VYORA AI] Running multimodal extraction inference with model='{active_model}' for media={media_path.name} (file_id={file_id})")
        if on_stage:
            disp_name = format_model_display_name(active_model)
            on_stage("IDENTIFYING_CHAPTERS", 70.0, f"Synthesizing chapters & knowledge using {disp_name}...")

        try:
            response = client.models.generate_content(
                model=active_model,
                contents=[uploaded_file, prompt],
                config=types.GenerateContentConfig(
                    system_instruction=EXTRACTION_SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.2,
                )
            )
            break
        except Exception as e:
            clean_err = sanitize_error_message(e)
            err_lower = clean_err.lower()

            # 401 unauthenticated or 403 permission denied across project - do not swap models
            if "401" in clean_err or "api_key_invalid" in err_lower or "unauthenticated" in err_lower:
                raise map_gemini_error(e, action="Extraction", model_name=active_model)
            if "403" in clean_err or "permission_denied" in err_lower:
                raise map_gemini_error(e, action="Extraction", model_name=active_model)

            # Model unavailable/deprecated/not found -> Fallback
            is_model_unavailable = (
                "404" in clean_err or
                "not_found" in err_lower or
                "no longer available" in err_lower or
                "not found" in err_lower or
                "unsupported model" in err_lower
            )

            if is_model_unavailable and fallback_attempts < max_fallbacks:
                fallback_attempts += 1
                next_model = blacklist_failed_model(active_model, api_key=resolved_key, reason=clean_err)
                if next_model and next_model != active_model:
                    fallback_history.append({"from": active_model, "to": next_model, "reason": clean_err})
                    logger.warning(f"[VYORA AI] Model '{active_model}' unavailable ({clean_err}). Falling back to '{next_model}' (fallback {fallback_attempts}/{max_fallbacks})")
                    if on_stage:
                        on_stage("IDENTIFYING_CHAPTERS", 72.0, f"Recovering with fallback model '{format_model_display_name(next_model)}'...")
                    active_model = next_model
                    selection_mode = "fallback"
                    continue

            # Transient rate limit or 503
            if ("429" in clean_err or "503" in clean_err or "resource_exhausted" in err_lower) and fallback_attempts < 2:
                fallback_attempts += 1
                backoff = 2.0 * fallback_attempts
                logger.warning(f"[VYORA AI] Transient error from Gemini ({clean_err}). Retrying in {backoff}s...")
                time.sleep(backoff)
                continue

            raise map_gemini_error(e, action="Extraction", model_name=active_model)

    try:
        resp_text = get_response_text(response)
        if not resp_text:
            raise HTTPException(status_code=500, detail="Gemini returned an empty response.")

        raw_text = clean_json_text(resp_text)
        data = json.loads(raw_text)

        # Ensure core fields are populated
        data["file_id"] = file_id
        data["filename"] = media_path.name
        data["media_type"] = "video" if is_video else "audio"
        data["created_at"] = datetime.now().isoformat()
        data["selected_model"] = active_model
        data["model_selection_mode"] = selection_mode
        
        if "duration_seconds" not in data or not data["duration_seconds"]:
            data["duration_seconds"] = 120.0
        if "duration_formatted" not in data or not data["duration_formatted"]:
            data["duration_formatted"] = format_seconds(data["duration_seconds"])

        # Validate chapter timing
        if "chapters" in data and isinstance(data["chapters"], list):
            for ch in data["chapters"]:
                if "start_time" in ch and ("start_time_formatted" not in ch or not ch["start_time_formatted"]):
                    ch["start_time_formatted"] = format_seconds(ch["start_time"])
                if "end_time" in ch and ("end_time_formatted" not in ch or not ch["end_time_formatted"]):
                    ch["end_time_formatted"] = format_seconds(ch["end_time"])

        # Validate transcript timing
        if "transcript" in data and isinstance(data["transcript"], list):
            for tr in data["transcript"]:
                if "start_time" in tr and ("start_time_formatted" not in tr or not tr["start_time_formatted"]):
                    tr["start_time_formatted"] = format_seconds(tr["start_time"])
                if "end_time" in tr and ("end_time_formatted" not in tr or not tr["end_time_formatted"]):
                    tr["end_time_formatted"] = format_seconds(tr["end_time"])

        result = MediaAnalysisResult(**data)
        save_cache_result(result)
        return result

    except json.JSONDecodeError as jde:
        raise HTTPException(status_code=500, detail=f"Failed to parse Gemini JSON response: {str(jde)}")
    except HTTPException:
        raise
    except Exception as e:
        raise map_gemini_error(e, action="Extraction", model_name=active_model)
