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
