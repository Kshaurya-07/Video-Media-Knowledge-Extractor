import pytest
from google.genai._transformers import t_schema
from pydantic import BaseModel, Field
from typing import Dict, Any

from app.models.schemas import (
    MediaOverviewExtraction,
    MediaChaptersExtraction,
    MediaTranscriptAndScenesExtraction,
    SentimentAndTone,
    ChatResponse,
)
from app.services.gemini_extractor import (
    sanitize_schema_for_gemini_api,
    validate_schema_compatibility,
)

def test_overview_schema_has_no_additional_properties():
    """Verify MediaOverviewExtraction contains no additionalProperties that trigger Developer API 400."""
    sanitized = sanitize_schema_for_gemini_api(MediaOverviewExtraction)
    is_valid, msg = validate_schema_compatibility(sanitized)
    assert is_valid, msg
    assert "additional_properties=True" not in str(sanitized)
    assert "additionalProperties" not in str(sanitized)

def test_chapters_schema_has_no_additional_properties():
    """Verify MediaChaptersExtraction contains no additionalProperties."""
    sanitized = sanitize_schema_for_gemini_api(MediaChaptersExtraction)
    is_valid, msg = validate_schema_compatibility(sanitized)
    assert is_valid, msg
    assert "additional_properties=True" not in str(sanitized)
    assert "additionalProperties" not in str(sanitized)

def test_transcript_schema_has_no_additional_properties():
    """Verify MediaTranscriptAndScenesExtraction contains no additionalProperties."""
    sanitized = sanitize_schema_for_gemini_api(MediaTranscriptAndScenesExtraction)
    is_valid, msg = validate_schema_compatibility(sanitized)
    assert is_valid, msg
    assert "additional_properties=True" not in str(sanitized)
    assert "additionalProperties" not in str(sanitized)

def test_chat_response_schema_has_no_additional_properties():
    """Verify ChatResponse Q&A schema contains no additionalProperties."""
    sanitized = sanitize_schema_for_gemini_api(ChatResponse)
    is_valid, msg = validate_schema_compatibility(sanitized)
    assert is_valid, msg
    assert "additional_properties=True" not in str(sanitized)
    assert "additionalProperties" not in str(sanitized)

def test_sanitizer_removes_unsupported_additional_properties_from_arbitrary_models():
    """Verify sanitize_schema_for_gemini_api recursively strips additional_properties from dynamic dict models."""
    class DynamicModel(BaseModel):
        name: str
        extra_data: Dict[str, Any]

    raw_schema = t_schema(None, DynamicModel)
    assert "additional_properties=True" in str(raw_schema)

    cleaned = sanitize_schema_for_gemini_api(DynamicModel)
    is_valid, msg = validate_schema_compatibility(cleaned)
    assert is_valid, msg
    assert "additional_properties=True" not in str(cleaned)

def test_sentiment_and_tone_defaults():
    """Verify SentimentAndTone model creates valid instances with defaults."""
    st = SentimentAndTone()
    assert st.overall == "Informative"
    assert st.energy_level == "Moderate"
    assert st.communication_style == "Conversational"
