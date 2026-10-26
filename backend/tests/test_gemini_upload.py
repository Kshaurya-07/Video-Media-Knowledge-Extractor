import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path
import inspect

from google import genai
from google.genai import types

from app.services.gemini_extractor import (
    sanitize_error_message,
    clean_json_text,
    extract_media_knowledge,
)
from app.services.pipeline_service import (
    update_job_status,
    get_active_job_for_project,
    ACTIVE_JOBS,
)
from app.models.schemas import MediaAnalysisResult


# ==============================================================================
# 1. REGRESSION TEST: client.files.upload() signature & mime_type handling
# ==============================================================================
def test_regression_gemini_sdk_upload_signature():
    """
    REGRESSION TEST for:
    500: File upload to Gemini failed: Files.upload() got an unexpected keyword argument 'mime_type'

    In google-genai SDK (v0.1.1+ and v2.x), client.files.upload() does NOT accept `mime_type`
    as a direct keyword argument. It accepts `config=types.UploadFileConfig(mime_type=...)`.
    """
    # Verify the actual SDK signature does NOT have mime_type as a parameter
    sig = inspect.signature(genai.Client(api_key="AIzaSyTestMockKeyForSignatureTest1234").files.upload)
    assert "mime_type" not in sig.parameters, (
        "Files.upload() should not take 'mime_type' directly as a keyword argument in google-genai SDK"
    )
    assert "config" in sig.parameters, "Files.upload() must accept 'config'"


@pytest.mark.asyncio
async def test_extract_media_knowledge_uses_upload_file_config():
    """
    Verify extract_media_knowledge() creates a types.UploadFileConfig and passes
    it to client.files.upload() with config=..., eliminating the 500 error.
    """
    mock_file = MagicMock()
    mock_file.name = "files/test_media_ref_123"
    mock_file.state = types.FileState.ACTIVE

    mock_response = MagicMock()
    mock_response.text = '''{
        "title": "VYORA AI Architecture",
        "overview": "Overview of neural knowledge synthesis",
        "executive_summary": "Deep dive into multi-modal video indexing",
        "duration_seconds": 120.0,
        "duration_formatted": "02:00",
        "chapters": [],
        "key_takeaways": ["Takeaway 1"],
        "action_items": [],
        "transcript": [],
        "visual_scenes": [],
        "entities": [],
        "sentiment_and_tone": {
            "overall_sentiment": "Positive",
            "confidence_score": 0.95,
            "tone_descriptors": ["Visionary"],
            "energy_level": "High",
            "communication_style": "Analytical"
        }
    }'''

    with patch("app.services.gemini_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.gemini_extractor.get_media_path") as mock_get_path, \
         patch("app.services.gemini_extractor.get_cached_result", return_value=None), \
         patch("app.services.gemini_extractor.save_cache_result"):

        mock_path = MagicMock(spec=Path)
        mock_path.exists.return_value = True
        mock_path.name = "sample.mp4"
        mock_path.suffix = ".mp4"
        mock_path.stat.return_value.st_size = 1048576
        mock_get_path.return_value = mock_path

        mock_client = MagicMock()
        mock_client.files.upload.return_value = mock_file
        mock_client.models.generate_content.return_value = mock_response
        mock_client_cls.return_value = mock_client

        # Run extraction
        stages_recorded = []
        def stage_cb(stage, pct, msg):
            stages_recorded.append(stage)

        result = await extract_media_knowledge(
            file_id="test_media_id",
            api_key="test-api-key-123",
            on_stage=stage_cb
        )

        assert result.title == "VYORA AI Architecture"
        assert mock_client.files.upload.called

        # Verify upload was called with config=types.UploadFileConfig and NOT mime_type keyword
        call_kwargs = mock_client.files.upload.call_args.kwargs
        assert "mime_type" not in call_kwargs, (
            "Regression failure: client.files.upload called with illegal 'mime_type' keyword!"
        )
        assert "config" in call_kwargs
        assert isinstance(call_kwargs["config"], types.UploadFileConfig)
        assert call_kwargs["config"].mime_type.startswith("video/")


# ==============================================================================
# 2. ERROR SANITIZATION TESTS: No API secrets in error messages
# ==============================================================================
def test_sanitize_error_message_redacts_api_key():
    """Verify that Google Gemini API keys are completely stripped from error strings."""
    fake_key = "AIzaSyB1234567890abcdefghijklmnopqrstuv"
    raw_error = Exception(f"403 Forbidden: Invalid API Key passed: {fake_key} to endpoint https://generativelanguage.googleapis.com/v1beta/files?key={fake_key}")
    
    clean = sanitize_error_message(raw_error)

    assert fake_key not in clean
    assert "[REDACTED_API_KEY]" in clean
    assert "key=[REDACTED]" in clean


# ==============================================================================
# 3. PIPELINE STAGE TRANSITIONS & PERSISTENCE
# ==============================================================================
def test_pipeline_job_transitions():
    """Verify state transitions of a processing job."""
    job_id = "test_job_001"
    project_id = "test_proj_001"

    stages = [
        ("QUEUED", 5.0, "Queued in VYORA background queue..."),
        ("UPLOADING", 15.0, "Uploading to Gemini Files API..."),
        ("EXTRACTING_AUDIO", 40.0, "Gemini processing video frames & audio tracks..."),
        ("TRANSCRIBING", 55.0, "Ingesting multimodal temporal features..."),
        ("IDENTIFYING_CHAPTERS", 75.0, "Synthesizing chapters, OCR text, and conceptual entities..."),
        ("INDEXING", 90.0, "Parsing knowledge graph, validating timestamps..."),
        ("FINALIZING", 95.0, "Persisting structured intelligence..."),
        ("COMPLETED", 100.0, "Knowledge extraction complete!"),
    ]

    for stage, pct, msg in stages:
        update_job_status(job_id, stage, pct, msg, project_id=project_id)
        current = ACTIVE_JOBS[job_id]
        assert current["stage"] == stage
        assert current["progress_percent"] == pct
        assert current["message"] == msg


# ==============================================================================
# 4. DUPLICATE SUBMISSION PREVENTION
# ==============================================================================
def test_duplicate_submission_detection():
    """Verify that get_active_job_for_project identifies ongoing jobs to prevent duplicates."""
    proj_id = "unique_project_id_999"
    job_id = "active_job_999"

    # Set as active
    update_job_status(job_id, "TRANSCRIBING", 50.0, "Transcribing...", project_id=proj_id)

    active_job = get_active_job_for_project(proj_id)
    assert active_job is not None
    assert active_job["job_id"] == job_id
    assert active_job["stage"] == "TRANSCRIBING"

    # Mark as completed
    update_job_status(job_id, "COMPLETED", 100.0, "Done", project_id=proj_id)

    # Should no longer be flagged as active running job
    active_after = get_active_job_for_project(proj_id)
    assert active_after is None


# ==============================================================================
# 5. JSON TEXT SANITIZATION
# ==============================================================================
def test_clean_json_text():
    """Verify that markdown fences are properly stripped."""
    fenced_json = "```json\n{\"test\": true}\n```"
    assert clean_json_text(fenced_json) == '{"test": true}'

    plain_json = '{"test": true}'
    assert clean_json_text(plain_json) == '{"test": true}'
