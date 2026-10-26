import json
from typing import List, Optional
from google import genai
from google.genai import types
from fastapi import HTTPException

from app.config import DEFAULT_MODEL, get_api_key
from app.models.schemas import ChatMessage, ChatResponse, TimestampCitation
from app.services.gemini_extractor import get_cached_result, FILE_REF_REGISTRY, clean_json_text

QA_SYSTEM_PROMPT = """You are an interactive AI Knowledge Assistant for a video/audio recording.
The user is asking questions about the contents, discussions, slides, demonstrations, or key points in this media.

You have access to:
1. The media file itself (if available).
2. The extracted metadata, executive summary, chapters, transcript, and visual scene analysis.

Your goal:
- Answer the user's question thoroughly and accurately based exclusively on the media contents.
- Always include timestamp citations in your answer when referencing specific moments, quotes, slides, or demonstrations. Format citations in text as `[MM:SS]` (e.g. "[02:15]").
- Also populate the "citations" array with each cited timestamp (seconds as float, formatted string as "MM:SS", and a short phrase describing the context).

Output JSON ONLY with this structure:
{
  "answer": "Markdown formatted answer with [MM:SS] timestamp references",
  "citations": [
    {
      "seconds": 135.0,
      "formatted": "02:15",
      "context": "Discussion of data pipeline architecture"
    }
  ]
}
"""

async def answer_media_question(
    file_id: str,
    question: str,
    history: List[ChatMessage],
    api_key: Optional[str] = None
) -> ChatResponse:
    resolved_key = get_api_key(api_key)
    if not resolved_key:
        raise HTTPException(status_code=401, detail="Google Gemini API Key is required for Q&A.")

    try:
        client = genai.Client(api_key=resolved_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to initialize Gemini Client: {str(e)}")

    # Retrieve cached analysis for grounded context
    cached_analysis = get_cached_result(file_id)
    context_str = ""
    if cached_analysis:
        context_str = f"""
Media Title: {cached_analysis.title}
Duration: {cached_analysis.duration_formatted}
Summary: {cached_analysis.executive_summary}

Chapters:
"""
        for ch in cached_analysis.chapters:
            context_str += f"- [{ch.start_time_formatted} - {ch.end_time_formatted}] {ch.title}: {ch.summary}\n"

        context_str += "\nKey Transcript Excerpts:\n"
        # Include sample transcript segments
        for seg in cached_analysis.transcript[:50]:
            context_str += f"[{seg.start_time_formatted}] {seg.speaker}: {seg.text}\n"

        if cached_analysis.visual_scenes:
            context_str += "\nVisual Scenes & Slides:\n"
            for vs in cached_analysis.visual_scenes:
                context_str += f"[{vs.start_time_formatted}] {vs.description}. Elements: {', '.join(vs.visual_elements)}. Detected Text: {', '.join(vs.detected_text)}\n"

    # Check if we have an active uploaded file_ref
    contents = []
    file_ref_name = FILE_REF_REGISTRY.get(file_id)
    if file_ref_name:
        try:
            file_ref = client.files.get(name=file_ref_name)
            contents.append(file_ref)
        except Exception:
            pass  # Fallback to context string

    user_prompt = f"""
Context about this media:
{context_str}

Conversation History:
"""
    for msg in history[-6:]:  # last 6 messages
        user_prompt += f"{msg.role.capitalize()}: {msg.content}\n"

    user_prompt += f"\nUser Question: {question}\n\nAnswer in the requested JSON format."
    contents.append(user_prompt)

    try:
        response = client.models.generate_content(
            model=DEFAULT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=QA_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2,
            )
        )

        clean_text = clean_json_text(response.text)
        data = json.loads(clean_text)
        return ChatResponse(**data)

    except json.JSONDecodeError:
        # Fallback if model returned plain text markdown
        return ChatResponse(
            answer=response.text,
            citations=[]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(e)}")
