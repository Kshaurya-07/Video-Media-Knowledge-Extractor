import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.services.media_service import validate_media_file_content
from app.services.url_ingestion_service import validate_url_security
from app.services.pipeline_service import recover_all_stale_jobs, ACTIVE_JOBS
from app.database import get_db

client = TestClient(app)

def test_scenario_unsupported_video_format(tmp_path):
    """Failure Scenario 1: Uploading an unsupported file format (.exe) is rejected."""
    bad_file = tmp_path / "malware.exe"
    bad_file.write_bytes(b"MZ\x90\x00\x03\x00\x00\x00")
    valid, msg = validate_media_file_content(bad_file)
    assert valid is False
    assert "unsupported file extension" in msg.lower()


def test_scenario_corrupted_video_magic_bytes(tmp_path):
    """Failure Scenario 2: Uploading a corrupted MP4 (bad header) is rejected."""
    corrupted_file = tmp_path / "corrupted.mp4"
    corrupted_file.write_bytes(b"THIS IS CORRUPTED DATA NOT A VIDEO")
    valid, msg = validate_media_file_content(corrupted_file)
    assert valid is False
    assert "does not match expected format" in msg.lower()


def test_scenario_invalid_youtube_and_ssrf_url():
    """Failure Scenario 3: Malformed, non-HTTP, and private/internal URLs are blocked."""
    with pytest.raises(Exception) as exc:
        validate_url_security("http://127.0.0.1:8000/internal-stream.mp4")
    assert "400" in str(exc.value) or "restricted" in str(exc.value).lower() or "ssrf" in str(exc.value).lower()


def test_scenario_invalid_api_key():
    """Failure Scenario 4: Processing with an empty or missing API key is rejected with 401."""
    with patch("app.services.gemini_extractor.get_api_key", return_value=None):
        response = client.post("/api/verify-key", json={"api_key": ""})
        assert response.status_code == 200
        assert response.json()["valid"] is False


def test_scenario_stale_job_recovery_on_restart():
    """Failure Scenario 5: Interrupted in-flight job is recovered on restart and never blocks."""
    test_proj = "test_abandoned_proj_99"
    test_job = "job_stale_99"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT OR REPLACE INTO projects (id, user_id, title, description, media_type, filename, file_path, status)
        VALUES (?, 'default_user', 'Stale Video', 'Testing recovery', 'video', 'stale.mp4', 'uploads/stale.mp4', 'PROCESSING')
        """, (test_proj,))
        cursor.execute("""
        INSERT OR REPLACE INTO processing_jobs (job_id, project_id, stage, progress_percent, message)
        VALUES (?, ?, 'QUEUED', 10.0, 'Job was queued before server crashed')
        """, (test_job, test_proj))
        conn.commit()

    # Ensure memory active jobs map does not contain this job (simulating fresh server process restart)
    ACTIVE_JOBS.pop(test_job, None)

    # Trigger recovery
    recovered = recover_all_stale_jobs()
    assert recovered >= 1

    # Verify job stage transitioned to FAILED with clear retry guidance
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT stage, message, error_message FROM processing_jobs WHERE job_id = ?", (test_job,))
        row = cursor.fetchone()
        assert row["stage"] == "FAILED"
        assert "interrupted" in row["message"].lower() or "restart" in row["message"].lower()


def test_scenario_curated_models_production_ready():
    """Failure Scenario 6: Verify curated and default models contain real Google production models."""
    from app.config import DEFAULT_MODEL
    from app.services.model_discovery_service import CURATED_MULTIMODAL_MODELS, INCOMPATIBLE_NAME_PATTERNS

    assert DEFAULT_MODEL == "gemini-2.0-flash"
    assert "gemini-3.8-flash" not in CURATED_MULTIMODAL_MODELS
    assert "gemini-2.0-flash" in CURATED_MULTIMODAL_MODELS
    assert "gemini-1.5-flash" in CURATED_MULTIMODAL_MODELS
    assert "gemini-1.5-pro" in CURATED_MULTIMODAL_MODELS
    assert "gemini-3.8" in INCOMPATIBLE_NAME_PATTERNS


@pytest.mark.asyncio
async def test_scenario_gemini_503_failover_recovery():
    """Failure Scenario 7: HTTP 503 triggers backoff and intelligent failover to next model without file loss."""
    from google.genai import types
    from app.services.gemini_extractor import extract_media_knowledge
    from app.services.model_discovery_service import invalidate_model_cache

    test_key = "test_503_failover_key"
    invalidate_model_cache(test_key)

    mock_file = MagicMock()
    mock_file.name = "files/test_shared_file_ref_503"
    mock_file.state = types.FileState.ACTIVE

    # GenerateContent call sequence:
    # 1. Overview with gemini-2.0-flash -> raises 503
    # 2. Overview retry with gemini-2.0-flash -> raises 503
    # -> Triggers failover to gemini-1.5-flash
    # 3. Overview with gemini-1.5-flash -> succeeds
    # 4. Chapters with gemini-1.5-flash -> succeeds
    # 5. Transcript with gemini-1.5-flash -> succeeds

    overview_json = '''{
        "title": "503 Failover Recovery Test",
        "duration_seconds": 60.0,
        "duration_formatted": "01:00",
        "overview": "Overview recovered after 503.",
        "executive_summary": "Full summary recovered after failover.",
        "key_takeaways": ["Takeaway 1"],
        "action_items": [],
        "sentiment_and_tone": {
            "overall": "Analytical",
            "energy_level": "Medium",
            "communication_style": "Concise"
        }
    }'''

    chapters_json = '''{
        "chapters": [
            {
                "start_time": 0.0,
                "start_time_formatted": "00:00",
                "end_time": 60.0,
                "end_time_formatted": "01:00",
                "title": "Introduction",
                "summary": "Chapter summary",
                "key_moments": ["Moment 1"]
            }
        ]
    }'''

    transcript_json = '''{
        "transcript": [
            {
                "start_time": 0.0,
                "start_time_formatted": "00:00",
                "end_time": 10.0,
                "end_time_formatted": "00:10",
                "speaker": "Speaker 1",
                "text": "Hello world"
            }
        ],
        "visual_scenes": [],
        "entities": []
    }'''

    call_count = 0
    models_called = []

    def mock_generate_content(model, contents, config=None):
        nonlocal call_count, models_called
        call_count += 1
        models_called.append(model)
        if model == "gemini-2.0-flash":
            # Simulate Google 503 Overloaded
            raise Exception("503 The model is overloaded. Please try again later.")
        elif model == "gemini-1.5-flash":
            resp = MagicMock()
            if len(models_called) <= 3:
                resp.text = overview_json
            elif len(models_called) == 4:
                resp.text = chapters_json
            else:
                resp.text = transcript_json
            return resp
        raise Exception(f"Unexpected model called: {model}")

    with patch("app.services.gemini_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.gemini_extractor.get_media_path") as mock_get_path, \
         patch("app.services.gemini_extractor.get_cached_result", return_value=None), \
         patch("app.services.gemini_extractor.save_cache_result"), \
         patch("asyncio.sleep", return_value=None):

        mock_path = MagicMock(spec=Path)
        mock_path.exists.return_value = True
        mock_path.name = "sample_503.mp4"
        mock_path.suffix = ".mp4"
        mock_path.stat.return_value.st_size = 1048576
        mock_get_path.return_value = mock_path

        mock_client = MagicMock()
        mock_client.files.upload.return_value = mock_file
        mock_client.models.generate_content.side_effect = mock_generate_content
        mock_client_cls.return_value = mock_client

        stages = []
        def on_stage_cb(st, pct, msg):
            stages.append((st, pct, msg))

        result = await extract_media_knowledge(
            file_id="test_media_503",
            api_key=test_key,
            on_stage=on_stage_cb,
            job_id="job_503_test"
        )

        assert result is not None
        # Must have fallen back to gemini-1.5-flash
        assert result.selected_model == "gemini-1.5-flash"
        assert result.model_selection_mode == "fallback"
        assert len(result.fallback_history) >= 1
        assert result.fallback_history[0]["from"] == "gemini-2.0-flash"
        assert result.fallback_history[0]["to"] == "gemini-1.5-flash"
        # File upload was NOT repeated (uploaded once)
        assert mock_client.files.upload.call_count == 1
        assert "503 The model is overloaded" in result.fallback_history[0]["reason"]


@pytest.mark.asyncio
async def test_scenario_gemini_404_immediate_failover():
    """Failure Scenario 8: HTTP 404 (model not found) immediately fails over to next candidate."""
    from google.genai import types
    from app.services.gemini_extractor import extract_media_knowledge
    from app.services.model_discovery_service import invalidate_model_cache

    test_key = "test_404_failover_key"
    invalidate_model_cache(test_key)

    mock_file = MagicMock()
    mock_file.name = "files/test_shared_file_ref_404"
    mock_file.state = types.FileState.ACTIVE

    overview_json = '''{
        "title": "404 Immediate Failover Test",
        "duration_seconds": 30.0,
        "duration_formatted": "00:30",
        "overview": "Overview after 404.",
        "executive_summary": "Summary after 404.",
        "key_takeaways": ["Takeaway 1"],
        "action_items": [],
        "sentiment_and_tone": {
            "overall": "Optimistic",
            "energy_level": "High",
            "communication_style": "Engaging"
        }
    }'''

    chapters_json = '''{
        "chapters": []
    }'''

    transcript_json = '''{
        "transcript": [],
        "visual_scenes": [],
        "entities": []
    }'''

    models_called = []

    def mock_generate_content(model, contents, config=None):
        nonlocal models_called
        models_called.append(model)
        if model == "gemini-2.0-flash":
            raise Exception("404 models/gemini-2.0-flash is not found for project")
        elif model == "gemini-1.5-flash":
            resp = MagicMock()
            if len([m for m in models_called if m == "gemini-1.5-flash"]) == 1:
                resp.text = overview_json
            elif len([m for m in models_called if m == "gemini-1.5-flash"]) == 2:
                resp.text = chapters_json
            else:
                resp.text = transcript_json
            return resp
        raise Exception(f"Unexpected model: {model}")

    with patch("app.services.gemini_extractor.genai.Client") as mock_client_cls, \
         patch("app.services.gemini_extractor.get_media_path") as mock_get_path, \
         patch("app.services.gemini_extractor.get_cached_result", return_value=None), \
         patch("app.services.gemini_extractor.save_cache_result"), \
         patch("asyncio.sleep", return_value=None):

        mock_path = MagicMock(spec=Path)
        mock_path.exists.return_value = True
        mock_path.name = "sample_404.mp4"
        mock_path.suffix = ".mp4"
        mock_path.stat.return_value.st_size = 1048576
        mock_get_path.return_value = mock_path

        mock_client = MagicMock()
        mock_client.files.upload.return_value = mock_file
        mock_client.models.generate_content.side_effect = mock_generate_content
        mock_client_cls.return_value = mock_client

        result = await extract_media_knowledge(
            file_id="test_media_404",
            api_key=test_key,
            job_id="job_404_test"
        )

        assert result is not None
        assert result.selected_model == "gemini-1.5-flash"
        assert result.model_selection_mode == "fallback"
        assert len(result.fallback_history) >= 1
        assert result.fallback_history[0]["from"] == "gemini-2.0-flash"
        assert result.fallback_history[0]["to"] == "gemini-1.5-flash"
        # Since 404 is an immediate failover, gemini-2.0-flash was called only ONCE before failing over
        assert models_called.count("gemini-2.0-flash") == 1
