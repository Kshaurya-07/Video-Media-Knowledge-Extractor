import json
import re
import time
import random
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger("vyora.extractor")

from google import genai
from google.genai import types
from fastapi import HTTPException

from app.config import DEFAULT_MODEL, DATA_CACHE_DIR, get_api_key
from app.database import get_db
from app.services.diagnostic_logger import log_diagnostic
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
    MediaOverviewExtraction,
    MediaChaptersExtraction,
    MediaTranscriptAndScenesExtraction,
    ExtractionErrorDetail,
    SentimentAndTone,
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

STANDARD_SAFETY_SETTINGS = [
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    types.SafetySetting(
        category=types.HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        threshold=types.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
]

def clean_json_text(text: str) -> str:
    """Strip markdown code fence and extract valid JSON."""
    if not text:
        return ""
    clean = text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()

    if clean.startswith("{") and clean.endswith("}"):
        return clean

    # Look for outer JSON object if wrapped in thoughts or explanation
    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        return match.group(1).strip()

    # If starts with opening brace but was cut off mid-stream, strip leading non-JSON text
    first_brace = clean.find("{")
    if first_brace != -1:
        return clean[first_brace:]

    return clean

def repair_truncated_json(raw: str) -> str:
    """
    Attempts to repair a truncated JSON string caused by output token limits
    by closing unclosed strings, removing dangling commas/colons, and closing
    open brackets and braces in proper reverse-stack order.
    """
    if not raw or not raw.strip():
        return "{}"
    text = clean_json_text(raw)
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    in_string = False
    escape = False
    stack = []
    for ch in text:
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch in ('{', '['):
                stack.append(ch)
            elif ch == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
            elif ch == ']':
                if stack and stack[-1] == '[':
                    stack.pop()

    repaired = text
    if in_string:
        repaired += '"'
    repaired = repaired.rstrip()
    while repaired and repaired[-1] in (',', ':', ' '):
        repaired = repaired[:-1].rstrip()
    while stack:
        opener = stack.pop()
        if opener == '{':
            repaired += '}'
        elif opener == '[':
            repaired += ']'
    return repaired

def sanitize_schema_for_gemini_api(schema_input: Any) -> Any:
    """
    Validates and sanitizes a schema for Gemini Developer API mode.
    Converts Pydantic models or dicts to types.Schema and recursively strips
    unsupported keywords like 'additional_properties' / 'additionalProperties'
    which cause 400 'additionalProperties is only supported in Gemini Enterprise Agent Platform mode'.
    """
    from google.genai._transformers import t_schema
    
    try:
        schema_obj = t_schema(None, schema_input)
    except Exception as e:
        logger.warning(f"[VYORA AI] Schema transformation via t_schema failed: {e}. Passing raw schema.")
        return schema_input

    def _strip_recursively(node: Any):
        if node is None:
            return
        if hasattr(node, "additional_properties"):
            node.additional_properties = None
        if hasattr(node, "properties") and node.properties:
            for child in node.properties.values():
                _strip_recursively(child)
        if hasattr(node, "items") and node.items:
            _strip_recursively(node.items)
        if hasattr(node, "any_of") and node.any_of:
            for child in node.any_of:
                _strip_recursively(child)

    _strip_recursively(schema_obj)
    return schema_obj

def validate_schema_compatibility(schema_obj: Any) -> tuple[bool, str]:
    """
    Inspects a transformed schema to ensure zero occurrences of 'additional_properties=True'
    or 'additionalProperties' before transmitting to Google Gemini Developer API.
    """
    schema_str = str(schema_obj)
    if "additional_properties=True" in schema_str or "additionalProperties" in schema_str:
        return False, "Detected unsupported 'additionalProperties' in schema for Gemini Developer API mode."
    return True, "Schema is 100% compatible with Gemini Developer API mode."

def sanitize_error_message(err: Exception) -> str:
    """Strip any API keys or sensitive auth tokens from error message."""
    msg = str(err)
    # Redact key=... parameters first
    msg = re.sub(r'key=[0-9A-Za-z_-]+', 'key=[REDACTED]', msg)
    # Redact common Gemini API key pattern (AIzaSy...)
    msg = re.sub(r'AIzaSy[0-9A-Za-z_-]{33}', '[REDACTED_API_KEY]', msg)
    return msg

def map_gemini_error(e: Exception, action: str = "Extraction", model_name: Optional[str] = None, is_youtube: bool = False) -> HTTPException:
    """Map Google Gemini API exceptions into clear, structured HTTPExceptions with safe messages."""
    clean_err = sanitize_error_message(e)
    err_lower = clean_err.lower()
    target_model = model_name or DEFAULT_MODEL

    if is_youtube and (
        "invalid_argument" in err_lower
        or "400" in clean_err
        or "cannot retrieve" in err_lower
        or "unsupported uri" in err_lower
        or "unable to retrieve" in err_lower
        or "resource has been exhausted" not in err_lower and "uri" in err_lower
    ):
        return HTTPException(
            status_code=400,
            detail="The YouTube video is restricted or inaccessible to the AI model. Please verify the video is Public (not Private or Unlisted with restriction) and does not require age-verification sign-in."
        )

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

def diagnose_empty_response(response: Any, model_name: str = "") -> str:
    """Diagnose the root cause of an empty response from Gemini."""
    if response is None:
        return f"Gemini ({model_name}) returned None instead of a response object."

    # Check prompt feedback
    pf = getattr(response, "prompt_feedback", None)
    if pf:
        block_reason = getattr(pf, "block_reason", None)
        if block_reason:
            return f"Gemini ({model_name}) blocked media prompt (reason: {block_reason})."

    # Check candidates and finish reasons
    candidates = getattr(response, "candidates", None)
    if not candidates or len(candidates) == 0:
        return f"Gemini ({model_name}) generated 0 candidate responses for this media."

    cand = candidates[0]
    finish_reason = getattr(cand, "finish_reason", None)
    if finish_reason:
        fr_str = str(finish_reason)
        if "SAFETY" in fr_str:
            return f"Gemini ({model_name}) response was blocked by safety filters ({fr_str})."
        if "RECITATION" in fr_str:
            return f"Gemini ({model_name}) response was blocked by copyright/recitation policy ({fr_str})."
        if "MAX_TOKENS" in fr_str:
            return f"Gemini ({model_name}) reached maximum token limit during generation."
        if "BLOCKLIST" in fr_str or "PROHIBITED" in fr_str:
            return f"Gemini ({model_name}) response was blocked by content policy ({fr_str})."
        if "STOP" not in fr_str:
            return f"Gemini ({model_name}) stopped generation with finish_reason: {fr_str}."

    return f"Gemini ({model_name}) returned an empty response with no content parts."

def get_response_text(response: Any) -> str:
    """
    Robustly extract generated text across all Google GenAI response formats,
    thinking models (where parts have thought=True), and legacy interactions.
    """
    if response is None:
        return ""

    # 1. Standard text property
    try:
        if hasattr(response, "text") and response.text:
            return response.text
    except Exception as e:
        logger.debug(f"Accessing response.text failed: {e}")

    # 2. Output text property (Interactions API)
    try:
        if hasattr(response, "output_text") and response.output_text:
            return response.output_text
    except Exception:
        pass

    # 3. Direct inspection of candidates and content parts
    candidates = getattr(response, "candidates", None)
    if candidates and isinstance(candidates, list) and len(candidates) > 0:
        for cand in candidates:
            content = getattr(cand, "content", None)
            if not content:
                continue
            parts = getattr(content, "parts", None)
            if not parts or not isinstance(parts, list):
                continue

            # First pass: standard non-thought text parts
            non_thought_parts = []
            for part in parts:
                p_text = getattr(part, "text", None)
                is_thought = getattr(part, "thought", False)
                if isinstance(p_text, str) and p_text and not is_thought:
                    non_thought_parts.append(p_text)

            if non_thought_parts:
                return "".join(non_thought_parts)

            # Second pass: if only thought parts are present (thinking models like Gemini 2.0 / 3.8)
            all_parts = []
            for part in parts:
                p_text = getattr(part, "text", None)
                if isinstance(p_text, str) and p_text:
                    all_parts.append(p_text)

            if all_parts:
                return "".join(all_parts)

    return ""

def parse_structured_gemini_response(
    response: Any,
    schema_model: Any,
    stage_name: str,
    job_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    model_name: Optional[str] = None,
) -> Any:
    """
    Parses and validates a structured Gemini response against a Pydantic schema model.
    Checks candidate finish reasons (e.g. MAX_TOKENS), strips markdown fences,
    detects truncation, attempts smart JSON repair if needed, and logs diagnostics.
    """
    candidates = getattr(response, "candidates", None) or []
    finish_reason = None
    if candidates and len(candidates) > 0:
        finish_reason = getattr(candidates[0], "finish_reason", None)

    is_truncated_by_tokens = False
    if finish_reason:
        fr_str = str(finish_reason).upper()
        if "MAX_TOKENS" in fr_str or (hasattr(types, "FinishReason") and finish_reason == types.FinishReason.MAX_TOKENS):
            is_truncated_by_tokens = True
            logger.warning(f"[VYORA AI] Gemini generation for stage '{stage_name}' was truncated (finish_reason=MAX_TOKENS).")
            log_diagnostic(
                event="GEMINI_TOKEN_LIMIT",
                job_id=job_id,
                correlation_id=correlation_id,
                stage=stage_name,
                status="WARNING",
                model_id=model_name,
                details={"stage": stage_name, "finish_reason": str(finish_reason)},
            )

    resp_text = get_response_text(response)
    if not resp_text or not resp_text.strip():
        diag = diagnose_empty_response(response, model_name=model_name or "gemini")
        log_diagnostic(
            event="GEMINI_RESPONSE_EMPTY",
            job_id=job_id,
            correlation_id=correlation_id,
            stage=stage_name,
            status="ERROR",
            model_id=model_name,
            error_class="EmptyResponse",
            error_message=diag,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned an empty response during {stage_name}: {diag}"
        )

    clean_text = clean_json_text(resp_text)

    # 1. Try direct Pydantic JSON validation
    try:
        return schema_model.model_validate_json(clean_text)
    except Exception as initial_err:
        logger.warning(f"[VYORA AI] Direct schema validation failed for stage '{stage_name}' ({initial_err}). Attempting repair...")

    # 2. Attempt smart JSON repair
    try:
        repaired_text = repair_truncated_json(clean_text)
        parsed_dict = json.loads(repaired_text)
        validated = schema_model.model_validate(parsed_dict)
        logger.info(f"[VYORA AI] Successfully recovered and validated partial JSON for stage '{stage_name}'.")
        log_diagnostic(
            event="GEMINI_RESPONSE_REPAIRED",
            job_id=job_id,
            correlation_id=correlation_id,
            stage=stage_name,
            status="RECOVERED",
            model_id=model_name,
            details={"stage": stage_name, "is_truncated_by_tokens": is_truncated_by_tokens},
        )
        return validated
    except Exception as repair_err:
        err_msg = sanitize_error_message(repair_err)
        logger.error(f"[VYORA AI] JSON parsing failed for stage '{stage_name}': {err_msg}")

        err_code = "GEMINI_TOKEN_LIMIT" if is_truncated_by_tokens else "GEMINI_RESPONSE_INVALID"
        if "delimiter" in err_msg.lower() or "unterminated" in err_msg.lower():
            err_code = "GEMINI_RESPONSE_TRUNCATED"

        log_diagnostic(
            event=err_code,
            job_id=job_id,
            correlation_id=correlation_id,
            stage=stage_name,
            status="ERROR",
            model_id=model_name,
            error_class=type(repair_err).__name__,
            error_message=err_msg,
            details={"snippet": clean_text[:300] if clean_text else ""}
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Gemini JSON response in stage '{stage_name}': {err_msg}. Code: {err_code}"
        )

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
    job_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> MediaAnalysisResult:
    ext_start_time = time.time()
    jid = job_id or f"job_{file_id[:8]}"
    cid = correlation_id or f"corr_{file_id[:8]}"

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

    # 3. Locate media file or inspect remote stream project
    source_url = None
    media_display_name = "media_file.mp4"
    is_video = True
    media_path = None
    try:
        from app.database import get_db
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT source_url, filename, media_type FROM projects WHERE id = ?", (file_id,))
            prow = cursor.fetchone()
            if prow:
                source_url = prow["source_url"]
                if prow["filename"]:
                    media_display_name = prow["filename"]
                is_video = prow["media_type"] == "video"
    except Exception as e:
        logger.debug(f"[VYORA AI] Project lookup info: {e}")

    is_youtube = bool(source_url and ("youtube.com" in source_url or "youtu.be" in source_url))

    if not is_youtube:
        try:
            media_path = get_media_path(file_id)
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Media file not found: {str(e)}")

        if not media_path.exists() or media_path.stat().st_size == 0:
            raise HTTPException(status_code=400, detail="Media file is empty or missing on disk.")

        mime_type = get_media_mime_type(media_path)
        is_video = mime_type.startswith("video/")
        media_display_name = media_path.name

    # 4. Initialize Google GenAI client with explicit 10-minute HTTP timeout for large video understanding
    try:
        client = genai.Client(
            api_key=resolved_key.strip(),
            http_options=types.HttpOptions(timeout=600000)
        )
    except Exception as e:
        clean_err = sanitize_error_message(e)
        raise HTTPException(status_code=400, detail=f"Failed to initialize Gemini Client: {clean_err}")

    # 5. Connect media to Gemini Multimodal Engine
    uploaded_content = None

    if is_youtube:
        if on_stage:
            on_stage("EXTRACTING_MEDIA", 35.0, f"Connecting Gemini multimodal engine to YouTube stream ({source_url})...")
        uploaded_content = types.Part.from_uri(
            file_uri=source_url,
            mime_type="video/mp4"
        )
        if on_stage:
            on_stage("SENDING_TO_AI", 50.0, "Synchronizing video stream tokens with Gemini multimodal engine...")
    else:
        # Optimization for Render Free Tier: Reuse valid existing Gemini file references
        existing_ref = FILE_REF_REGISTRY.get(file_id)
        if not existing_ref:
            try:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT gemini_file_name FROM projects WHERE id = ?", (file_id,))
                    row = cursor.fetchone()
                    if row and row["gemini_file_name"]:
                        existing_ref = row["gemini_file_name"]
            except Exception:
                pass

        uploaded_file = None
        file_name = None

        if existing_ref:
            try:
                if on_stage:
                    on_stage("SENDING_TO_AI", 45.0, f"Checking existing Gemini file reference ({existing_ref})...")
                candidate = await asyncio.to_thread(client.files.get, name=existing_ref)
                if candidate and hasattr(candidate, "state"):
                    state_str = str(candidate.state)
                    if not (candidate.state == types.FileState.FAILED or state_str.endswith("FAILED")):
                        uploaded_file = candidate
                        uploaded_content = candidate
                        file_name = existing_ref
                        FILE_REF_REGISTRY[file_id] = file_name
                        if on_stage:
                            on_stage("SENDING_TO_AI", 50.0, f"Reusing cached Gemini file reference ({file_name})...")
            except Exception as e:
                logger.info(f"Cached Gemini file reference {existing_ref} expired or unreachable: {e}")
                uploaded_file = None

        if not uploaded_file:
            # Note: google-genai SDK requires passing mime_type via types.UploadFileConfig
            if on_stage:
                on_stage("EXTRACTING_MEDIA", 35.0, f"Validating media streams and preparing {media_path.name}...")

            try:
                if on_stage:
                    on_stage("SENDING_TO_AI", 45.0, f"Uploading {media_path.name} to Gemini Files API...")

                upload_config = types.UploadFileConfig(
                    mime_type=mime_type,
                    display_name=media_path.name[:100]
                )
                uploaded_file = await asyncio.to_thread(
                    client.files.upload,
                    file=str(media_path),
                    config=upload_config
                )
                if not uploaded_file or not getattr(uploaded_file, "name", None):
                    raise HTTPException(status_code=500, detail="Gemini Files API upload failed (empty response received).")

                uploaded_content = uploaded_file
                file_name = uploaded_file.name
                FILE_REF_REGISTRY[file_id] = file_name
                log_diagnostic(
                    event="GEMINI_FILE_CREATED",
                    job_id=jid,
                    correlation_id=cid,
                    stage="SENDING_TO_AI",
                    elapsed_seconds=time.time() - ext_start_time,
                    status="INFO",
                    file_id=file_id,
                    details={"gemini_file_name": file_name},
                )

                # Persist to database so subsequent retries reuse it across restarts
                try:
                    with get_db() as conn:
                        cursor = conn.cursor()
                        cursor.execute("UPDATE projects SET gemini_file_name = ? WHERE id = ?", (file_name, file_id))
                        conn.commit()
                except Exception as e:
                    logger.warning(f"Could not persist gemini_file_name in projects: {e}")

            except HTTPException:
                raise
            except Exception as e:
                raise map_gemini_error(e, action="Media upload", is_youtube=is_youtube)

        # For video/large files, poll file state until ACTIVE asynchronously
        if is_video or (hasattr(uploaded_file, "state") and uploaded_file.state):
            max_wait = 360  # up to 6 minutes
            start_wait = time.time()
            if on_stage:
                on_stage("SENDING_TO_AI", 50.0, "Gemini processing video frames & audio tracks...")

            while uploaded_file and uploaded_file.state and (
                uploaded_file.state == types.FileState.PROCESSING or
                str(uploaded_file.state).endswith("PROCESSING")
            ):
                if time.time() - start_wait > max_wait:
                    raise HTTPException(status_code=504, detail="Video processing timed out on Gemini Files API")
                await asyncio.sleep(3)
                refreshed = await asyncio.to_thread(client.files.get, name=file_name)
                if refreshed:
                    uploaded_file = refreshed
                if on_stage:
                    elapsed = int(time.time() - start_wait)
                    pct = min(50.0 + (elapsed / max_wait) * 15.0, 65.0)
                    on_stage("SENDING_TO_AI", pct, f"Ingesting multimodal temporal features ({elapsed}s)...")

            if uploaded_file and uploaded_file.state and (
                uploaded_file.state == types.FileState.FAILED or
                str(uploaded_file.state).endswith("FAILED")
            ):
                err_info = getattr(uploaded_file, 'error', 'Internal error')
                raise HTTPException(status_code=500, detail=f"Gemini failed to process media: {err_info}")

        log_diagnostic(
            event="GEMINI_FILE_READY",
            job_id=jid,
            correlation_id=cid,
            stage="SENDING_TO_AI",
            elapsed_seconds=time.time() - ext_start_time,
            status="INFO",
            file_id=file_id,
            details={"gemini_file_name": file_name},
        )

    # 6. Resolve Model (Automatic Discovery or Configured)
    active_model = selected_model_override
    selection_mode = "automatic"
    if not active_model:
        active_model, selection_mode, _ = get_active_model_selection(resolved_key)

    max_fallbacks = 3
    fallback_attempts = 0
    fallback_history = []
    media_name_display = media_path.name if media_path else media_display_name

    async def _execute_gemini_stage(
        stage_name: str,
        system_instruction: str,
        prompt_text: str,
        schema_model: Any,
        progress_start: float,
        progress_end: float,
        progress_label: str,
        max_tokens: int = 4096,
    ) -> Any:
        nonlocal active_model, selection_mode, fallback_attempts
        disp_name = format_model_display_name(active_model)

        if on_stage:
            on_stage(stage_name, progress_start, f"{progress_label} with {disp_name}...")

        log_diagnostic(
            event="INFERENCE_STAGE_STARTED",
            job_id=jid,
            correlation_id=cid,
            stage=stage_name,
            elapsed_seconds=time.time() - ext_start_time,
            status="INFO",
            model_id=active_model,
            file_id=file_id,
            details={"stage": stage_name},
        )

        heartbeat_cancelled = asyncio.Event()

        async def _heartbeat_worker():
            h_start = time.time()
            while not heartbeat_cancelled.is_set():
                try:
                    await asyncio.wait_for(heartbeat_cancelled.wait(), timeout=5.0)
                    break
                except asyncio.TimeoutError:
                    pass
                elapsed = int(time.time() - h_start)
                if on_stage:
                    pct = min(progress_start + (elapsed / 180.0) * (progress_end - progress_start), progress_end - 1.0)
                    on_stage(stage_name, round(pct, 1), f"{progress_label} with {disp_name} (elapsed: {elapsed}s)...")

        heartbeat_task = asyncio.create_task(_heartbeat_worker())

        # Pre-validate and sanitize schema for Gemini Developer API mode
        safe_schema = sanitize_schema_for_gemini_api(schema_model)
        is_compat, compat_msg = validate_schema_compatibility(safe_schema)
        if not is_compat:
            log_diagnostic(
                event="SCHEMA_VALIDATION_FAILED",
                job_id=jid,
                correlation_id=cid,
                stage=stage_name,
                elapsed_seconds=time.time() - ext_start_time,
                status="ERROR",
                model_id=active_model,
                details={"reason": compat_msg},
            )
            raise HTTPException(
                status_code=500,
                detail=f"Schema validation error for stage '{stage_name}': {compat_msg}"
            )

        log_diagnostic(
            event="SCHEMA_VALIDATED",
            job_id=jid,
            correlation_id=cid,
            stage=stage_name,
            elapsed_seconds=time.time() - ext_start_time,
            status="SUCCESS",
            model_id=active_model,
            details={"schema": schema_model.__name__ if hasattr(schema_model, "__name__") else str(schema_model)},
        )

        try:
            gen_config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=safe_schema,
                temperature=0.2,
                max_output_tokens=max_tokens,
                safety_settings=STANDARD_SAFETY_SETTINGS,
            )
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=active_model,
                contents=[uploaded_content, prompt_text],
                config=gen_config,
            )
        finally:
            heartbeat_cancelled.set()
            await heartbeat_task

        parsed = parse_structured_gemini_response(
            response=response,
            schema_model=schema_model,
            stage_name=stage_name,
            job_id=jid,
            correlation_id=cid,
            model_name=active_model,
        )

        log_diagnostic(
            event="INFERENCE_STAGE_COMPLETED",
            job_id=jid,
            correlation_id=cid,
            stage=stage_name,
            elapsed_seconds=time.time() - ext_start_time,
            status="SUCCESS",
            model_id=active_model,
            file_id=file_id,
            details={"stage": stage_name},
        )
        return parsed

    async def _run_stage_with_recovery(
        stage_name: str,
        system_instruction: str,
        prompt_text: str,
        schema_model: Any,
        progress_start: float,
        progress_end: float,
        progress_label: str,
        max_tokens: int = 4096,
    ) -> Any:
        nonlocal active_model, selection_mode, fallback_attempts, fallback_history
        stage_attempt = 0
        max_same_model_attempts = 2  # 1 initial attempt + 1 retry with exponential backoff & jitter

        while True:
            try:
                return await _execute_gemini_stage(
                    stage_name=stage_name,
                    system_instruction=system_instruction,
                    prompt_text=prompt_text,
                    schema_model=schema_model,
                    progress_start=progress_start,
                    progress_end=progress_end,
                    progress_label=progress_label,
                    max_tokens=max_tokens,
                )
            except HTTPException as he:
                # Fatal client errors that cannot succeed on any model or retry
                if he.status_code in (401, 403):
                    raise he
                # Schema validation failure in our own code (500)
                if he.status_code == 500 and "Schema validation error" in str(he.detail):
                    raise he

                clean_err = str(he.detail)
                err_lower = clean_err.lower()
                status = he.status_code

                is_not_found = (status == 404 or "not found" in err_lower or "not_found" in err_lower or "no longer available" in err_lower)
                is_transient = (
                    status in (429, 503, 504)
                    or "unavailable" in err_lower
                    or "overloaded" in err_lower
                    or "rate limit" in err_lower
                    or "quota" in err_lower
                    or "deadline_exceeded" in err_lower
                    or "timed out" in err_lower
                )

                if is_not_found:
                    if fallback_attempts < max_fallbacks:
                        fallback_attempts += 1
                        old_model = active_model
                        next_model = blacklist_failed_model(old_model, api_key=resolved_key, reason=clean_err)
                        if next_model and next_model != old_model:
                            fallback_history.append({"from": old_model, "to": next_model, "reason": clean_err})
                            log_diagnostic(
                                event="MODEL_FAILOVER",
                                job_id=jid,
                                correlation_id=cid,
                                stage=stage_name,
                                elapsed_seconds=time.time() - ext_start_time,
                                status="WARN",
                                model_id=next_model,
                                details={"from": old_model, "to": next_model, "reason": clean_err, "stage": stage_name},
                            )
                            logger.warning(f"[VYORA AI] Model '{old_model}' not found (404). Auto-switching to '{next_model}'.")
                            if on_stage:
                                on_stage(stage_name, progress_start, f"Model '{format_model_display_name(old_model)}' unavailable. Auto-switching to '{format_model_display_name(next_model)}'...")
                            active_model = next_model
                            selection_mode = "fallback"
                            stage_attempt = 0
                            continue
                    raise he

                if is_transient:
                    stage_attempt += 1
                    if stage_attempt < max_same_model_attempts:
                        # Exponential backoff with random jitter
                        backoff = min(1.5 * (2 ** (stage_attempt - 1)) + random.uniform(0.5, 1.2), 8.0)
                        logger.warning(f"[VYORA AI] Transient error ({status}) on model '{active_model}'. Retrying stage '{stage_name}' in {backoff:.1f}s (attempt {stage_attempt}/{max_same_model_attempts})...")
                        if on_stage:
                            on_stage(stage_name, progress_start, f"Gemini is temporarily busy ({status}). Retrying in {backoff:.1f}s...")
                        await asyncio.sleep(backoff)
                        continue
                    else:
                        # Retries on this model exhausted -> trigger intelligent failover!
                        if fallback_attempts < max_fallbacks:
                            fallback_attempts += 1
                            old_model = active_model
                            next_model = blacklist_failed_model(old_model, api_key=resolved_key, reason=f"Persistent {status} error: {clean_err}")
                            if next_model and next_model != old_model:
                                fallback_history.append({"from": old_model, "to": next_model, "reason": f"Persistent {status}"})
                                log_diagnostic(
                                    event="MODEL_FAILOVER",
                                    job_id=jid,
                                    correlation_id=cid,
                                    stage=stage_name,
                                    elapsed_seconds=time.time() - ext_start_time,
                                    status="WARN",
                                    model_id=next_model,
                                    details={"from": old_model, "to": next_model, "status": status, "reason": clean_err, "stage": stage_name},
                                )
                                logger.info(f"[VYORA AI] Model '{old_model}' returned persistent {status}. Intelligently failing over to '{next_model}'...")
                                if on_stage:
                                    on_stage(stage_name, progress_start, f"Gemini {format_model_display_name(old_model)} is busy. Auto-switching to fallback candidate {format_model_display_name(next_model)}...")
                                active_model = next_model
                                selection_mode = "fallback"
                                stage_attempt = 0
                                await asyncio.sleep(1.0)
                                continue
                        raise he

                # For empty response (502) or parse failure (500), try fallback if retries exhausted
                stage_attempt += 1
                if stage_attempt < max_same_model_attempts:
                    logger.warning(f"[VYORA AI] Stage '{stage_name}' failed with {status}. Retrying in 2.0s...")
                    await asyncio.sleep(2.0)
                    continue
                elif fallback_attempts < max_fallbacks:
                    fallback_attempts += 1
                    old_model = active_model
                    next_model = blacklist_failed_model(old_model, api_key=resolved_key, reason=clean_err)
                    if next_model and next_model != old_model:
                        fallback_history.append({"from": old_model, "to": next_model, "reason": clean_err})
                        log_diagnostic(
                            event="MODEL_FAILOVER",
                            job_id=jid,
                            correlation_id=cid,
                            stage=stage_name,
                            elapsed_seconds=time.time() - ext_start_time,
                            status="WARN",
                            model_id=next_model,
                            details={"from": old_model, "to": next_model, "reason": clean_err, "stage": stage_name},
                        )
                        logger.info(f"[VYORA AI] Model '{old_model}' produced {status}. Failing over to '{next_model}'...")
                        if on_stage:
                            on_stage(stage_name, progress_start, f"Switching AI model to {format_model_display_name(next_model)}...")
                        active_model = next_model
                        selection_mode = "fallback"
                        stage_attempt = 0
                        await asyncio.sleep(1.0)
                        continue

                raise he

            except Exception as e:
                clean_err = sanitize_error_message(e)
                err_lower = clean_err.lower()

                # Auth / permission failures: immediate fail
                if "401" in clean_err or "unauthenticated" in err_lower or "api_key_invalid" in err_lower or "403" in clean_err or "permission_denied" in err_lower:
                    raise map_gemini_error(e, action="Extraction", model_name=active_model, is_youtube=is_youtube)

                is_not_found = ("404" in clean_err or "not_found" in err_lower or "no longer available" in err_lower or "not found" in err_lower)
                is_transient = (
                    "503" in clean_err
                    or "unavailable" in err_lower
                    or "overloaded" in err_lower
                    or "429" in clean_err
                    or "resource_exhausted" in err_lower
                    or "quota" in err_lower
                    or "rate limit" in err_lower
                    or "504" in clean_err
                    or "deadline_exceeded" in err_lower
                    or "timed out" in err_lower
                )

                if is_not_found:
                    if fallback_attempts < max_fallbacks:
                        fallback_attempts += 1
                        old_model = active_model
                        next_model = blacklist_failed_model(old_model, api_key=resolved_key, reason=clean_err)
                        if next_model and next_model != old_model:
                            fallback_history.append({"from": old_model, "to": next_model, "reason": clean_err})
                            log_diagnostic(
                                event="MODEL_FAILOVER",
                                job_id=jid,
                                correlation_id=cid,
                                stage=stage_name,
                                elapsed_seconds=time.time() - ext_start_time,
                                status="WARN",
                                model_id=next_model,
                                details={"from": old_model, "to": next_model, "reason": clean_err, "stage": stage_name},
                            )
                            logger.warning(f"[VYORA AI] Model '{old_model}' not found (404). Failing over to '{next_model}'.")
                            if on_stage:
                                on_stage(stage_name, progress_start, f"Model '{format_model_display_name(old_model)}' not found. Auto-switching to '{format_model_display_name(next_model)}'...")
                            active_model = next_model
                            selection_mode = "fallback"
                            stage_attempt = 0
                            continue
                    raise map_gemini_error(e, action="Extraction", model_name=active_model, is_youtube=is_youtube)

                if is_transient:
                    stage_attempt += 1
                    if stage_attempt < max_same_model_attempts:
                        # Extract Retry-After if present in exception
                        retry_after = None
                        if hasattr(e, "retry_after"):
                            retry_after = getattr(e, "retry_after")
                        elif hasattr(e, "response") and hasattr(e.response, "headers"):
                            retry_after = e.response.headers.get("retry-after")

                        if retry_after and str(retry_after).isdigit():
                            backoff = min(float(retry_after) + random.uniform(0.2, 1.0), 10.0)
                        else:
                            backoff = min(1.5 * (2 ** (stage_attempt - 1)) + random.uniform(0.5, 1.2), 8.0)

                        logger.warning(f"[VYORA AI] Transient error on model '{active_model}': {clean_err}. Retrying in {backoff:.1f}s (attempt {stage_attempt}/{max_same_model_attempts})...")
                        if on_stage:
                            on_stage(stage_name, progress_start, f"Gemini is temporarily busy. Retrying in {backoff:.1f}s...")
                        await asyncio.sleep(backoff)
                        continue
                    else:
                        # Retries on this model exhausted -> trigger intelligent failover!
                        if fallback_attempts < max_fallbacks:
                            fallback_attempts += 1
                            old_model = active_model
                            next_model = blacklist_failed_model(old_model, api_key=resolved_key, reason=clean_err)
                            if next_model and next_model != old_model:
                                fallback_history.append({"from": old_model, "to": next_model, "reason": clean_err})
                                log_diagnostic(
                                    event="MODEL_FAILOVER",
                                    job_id=jid,
                                    correlation_id=cid,
                                    stage=stage_name,
                                    elapsed_seconds=time.time() - ext_start_time,
                                    status="WARN",
                                    model_id=next_model,
                                    details={"from": old_model, "to": next_model, "reason": clean_err, "stage": stage_name},
                                )
                                logger.info(f"[VYORA AI] Model '{old_model}' failed persistently ({clean_err}). Intelligently failing over to '{next_model}'...")
                                if on_stage:
                                    on_stage(stage_name, progress_start, f"Gemini {format_model_display_name(old_model)} is busy. Auto-switching to fallback candidate {format_model_display_name(next_model)}...")
                                active_model = next_model
                                selection_mode = "fallback"
                                stage_attempt = 0
                                await asyncio.sleep(1.0)
                                continue
                    raise map_gemini_error(e, action="Extraction", model_name=active_model, is_youtube=is_youtube)

                # For unknown errors, retry once; if failed again, attempt failover or raise
                stage_attempt += 1
                if stage_attempt < max_same_model_attempts:
                    logger.warning(f"[VYORA AI] Unexpected error on stage '{stage_name}': {clean_err}. Retrying once...")
                    await asyncio.sleep(2.0)
                    continue
                elif fallback_attempts < max_fallbacks:
                    fallback_attempts += 1
                    old_model = active_model
                    next_model = blacklist_failed_model(old_model, api_key=resolved_key, reason=clean_err)
                    if next_model and next_model != old_model:
                        fallback_history.append({"from": old_model, "to": next_model, "reason": clean_err})
                        log_diagnostic(
                            event="MODEL_FAILOVER",
                            job_id=jid,
                            correlation_id=cid,
                            stage=stage_name,
                            elapsed_seconds=time.time() - ext_start_time,
                            status="WARN",
                            model_id=next_model,
                            details={"from": old_model, "to": next_model, "reason": clean_err, "stage": stage_name},
                        )
                        logger.info(f"[VYORA AI] Failing over to next model '{next_model}' after unexpected error on '{old_model}'...")
                        if on_stage:
                            on_stage(stage_name, progress_start, f"Switching AI model to {format_model_display_name(next_model)}...")
                        active_model = next_model
                        selection_mode = "fallback"
                        stage_attempt = 0
                        await asyncio.sleep(1.0)
                        continue

                raise map_gemini_error(e, action="Extraction", model_name=active_model, is_youtube=is_youtube)

    # -------------------------------------------------------------
    # STAGE A: Core Overview & Executive Summary & Action Items
    # -------------------------------------------------------------
    overview_sys_instruction = (
        "You are an expert Media Knowledge Extractor for VYORA AI.\n"
        "Your task is to analyze the high-level themes, arguments, overview, duration, and key takeaways.\n"
        "Generate a structured JSON overview matching the schema strictly."
    )
    overview_prompt = (
        f"Analyze this {'video' if is_video else 'audio'} file '{media_display_name}'.\n"
        "Extract the concise title, total duration in seconds and formatted (MM:SS), "
        "a 2-3 sentence overview, a rich executive summary (2-4 paragraphs), "
        "4-8 key takeaways, actionable next steps, and sentiment/tone analysis."
    )
    overview_res: MediaOverviewExtraction = await _run_stage_with_recovery(
        stage_name="ANALYZING_VIDEO",
        system_instruction=overview_sys_instruction,
        prompt_text=overview_prompt,
        schema_model=MediaOverviewExtraction,
        progress_start=68.0,
        progress_end=76.0,
        progress_label="Analyzing video overview & executive summary",
        max_tokens=4096,
    )

    # -------------------------------------------------------------
    # STAGE B: Timestamped Chapters & Key Moments
    # -------------------------------------------------------------
    chapters_sys_instruction = (
        "You are an expert Video Segmentation specialist for VYORA AI.\n"
        "Your task is to identify the logical, chronological chapters throughout the media.\n"
        "Each chapter must have start_time, end_time, title, summary, and 2-4 key moments."
    )
    chapters_prompt = (
        f"Analyze the chronological structure of '{media_display_name}'.\n"
        "Generate a chronological list of distinct, non-overlapping chapters covering the entire duration from 00:00 to the end.\n"
        "Ensure all start_time and end_time values are strictly non-negative numbers and formatted correctly as MM:SS."
    )
    chapters_res: MediaChaptersExtraction = await _run_stage_with_recovery(
        stage_name="GENERATING_CHAPTERS",
        system_instruction=chapters_sys_instruction,
        prompt_text=chapters_prompt,
        schema_model=MediaChaptersExtraction,
        progress_start=76.0,
        progress_end=84.0,
        progress_label="Synthesizing chronological chapters & key moments",
        max_tokens=4096,
    )

    # -------------------------------------------------------------
    # STAGE C: Spoken Dialogue Transcript, Visual Scenes & Entities
    # -------------------------------------------------------------
    scenes_sys_instruction = (
        "You are an expert Multimodal Knowledge Extractor for VYORA AI.\n"
        "Your task is to extract timestamped dialogue segments, visual scene descriptions with OCR text, and key entities.\n"
        "Group spoken dialogue into meaningful segment chunks (approx 15-45 seconds per segment).\n"
        "For videos, describe visible slides, code, diagrams, or presentations.\n"
        "For audio-only, describe audio cues and tone phases."
    )
    scenes_prompt = (
        f"Analyze the spoken dialogue and visual content of '{media_display_name}'.\n"
        "Extract:\n"
        "1. 'transcript': chronological spoken dialogue segments with timestamps and speaker labels.\n"
        "2. 'visual_scenes': chronological visual scene descriptions with OCR text visible on screen.\n"
        "3. 'entities': key technologies, concepts, and people mentioned."
    )
    scenes_res: MediaTranscriptAndScenesExtraction = await _run_stage_with_recovery(
        stage_name="SYNTHESIZING_INTELLIGENCE",
        system_instruction=scenes_sys_instruction,
        prompt_text=scenes_prompt,
        schema_model=MediaTranscriptAndScenesExtraction,
        progress_start=84.0,
        progress_end=92.0,
        progress_label="Extracting spoken dialogue, visual scenes & entities",
        max_tokens=8192,
    )

    # -------------------------------------------------------------
    # STAGE D: Combine, Validate & Persist
    # -------------------------------------------------------------
    if on_stage:
        on_stage("SAVING_RESULTS", 94.0, "Synthesizing and validating combined knowledge graph...")

    # Validate duration
    duration_sec = getattr(overview_res, "duration_seconds", 120.0) or 120.0
    if duration_sec <= 0:
        duration_sec = 120.0
    duration_fmt = getattr(overview_res, "duration_formatted", "") or format_seconds(duration_sec)

    # Validate chapters
    chapters = getattr(chapters_res, "chapters", []) or []
    if len(chapters) == 0:
        chapters = [
            Chapter(
                start_time=0.0,
                start_time_formatted="00:00",
                end_time=duration_sec,
                end_time_formatted=duration_fmt,
                title=getattr(overview_res, "title", "Full Presentation") or "Full Presentation",
                summary=getattr(overview_res, "overview", "Complete recording") or "Complete recording",
                key_moments=getattr(overview_res, "key_takeaways", [])[:3] or ["Key discussion"],
            )
        ]
    else:
        for ch in chapters:
            if ch.start_time is None:
                ch.start_time = 0.0
            if not ch.start_time_formatted:
                ch.start_time_formatted = format_seconds(ch.start_time)
            if ch.end_time is None:
                ch.end_time = duration_sec
            if not ch.end_time_formatted:
                ch.end_time_formatted = format_seconds(ch.end_time)

    # Validate transcript segments
    transcript = getattr(scenes_res, "transcript", []) or []
    for tr in transcript:
        if tr.start_time is None:
            tr.start_time = 0.0
        if not tr.start_time_formatted:
            tr.start_time_formatted = format_seconds(tr.start_time)
        if tr.end_time is None:
            tr.end_time = tr.start_time + 5.0
        if not tr.end_time_formatted:
            tr.end_time_formatted = format_seconds(tr.end_time)

    # Validate visual scenes
    visual_scenes = getattr(scenes_res, "visual_scenes", []) or []
    for vs in visual_scenes:
        if vs.start_time is None:
            vs.start_time = 0.0
        if not vs.start_time_formatted:
            vs.start_time_formatted = format_seconds(vs.start_time)
        if vs.end_time is None:
            vs.end_time = vs.start_time + 10.0
        if not vs.end_time_formatted:
            vs.end_time_formatted = format_seconds(vs.end_time)

    entities = getattr(scenes_res, "entities", []) or []
    action_items = getattr(overview_res, "action_items", []) or []
    key_takeaways = getattr(overview_res, "key_takeaways", []) or []
    sentiment_and_tone = getattr(overview_res, "sentiment_and_tone", {}) or {}

    combined_data = {
        "file_id": file_id,
        "filename": media_display_name,
        "media_type": "video" if is_video else "audio",
        "duration_seconds": duration_sec,
        "duration_formatted": duration_fmt,
        "title": getattr(overview_res, "title", media_display_name) or media_display_name,
        "overview": getattr(overview_res, "overview", "Video overview") or "Video overview",
        "executive_summary": getattr(overview_res, "executive_summary", "") or getattr(overview_res, "overview", ""),
        "key_takeaways": key_takeaways,
        "chapters": [c.model_dump() for c in chapters],
        "transcript": [t.model_dump() for t in transcript],
        "visual_scenes": [v.model_dump() for v in visual_scenes],
        "entities": [e.model_dump() for e in entities],
        "action_items": [a.model_dump() for a in action_items],
        "sentiment_and_tone": sentiment_and_tone.model_dump() if hasattr(sentiment_and_tone, "model_dump") else (sentiment_and_tone or {}),
        "created_at": datetime.now().isoformat(),
        "selected_model": active_model,
        "model_selection_mode": selection_mode,
        "fallback_history": fallback_history,
        "source_url": source_url,
    }

    result = MediaAnalysisResult(**combined_data)
    save_cache_result(result)

    log_diagnostic(
        event="JOB_COMPLETED",
        job_id=jid,
        correlation_id=cid,
        stage="SAVING_RESULTS",
        elapsed_seconds=time.time() - ext_start_time,
        status="SUCCESS",
        model_id=active_model,
        file_id=file_id,
        details={
            "chapters_count": len(result.chapters),
            "transcript_count": len(result.transcript),
            "scenes_count": len(result.visual_scenes),
            "entities_count": len(result.entities),
        }
    )

    import gc
    gc.collect()

    return result
