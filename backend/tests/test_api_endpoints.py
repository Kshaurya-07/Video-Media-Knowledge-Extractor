import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.services.pipeline_service import update_job_status, ACTIVE_JOBS

client = TestClient(app)

def test_health_check_endpoint():
    """Verify backend health endpoint responds with system status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "VYORA AI" in data["service"]


def test_get_job_status_endpoint():
    """Verify retrieval of active and persisted job states."""
    job_id = "test_endpoint_job"
    update_job_status(job_id, "IDENTIFYING_CHAPTERS", 70.0, "Analyzing scene markers...")

    response = client.get(f"/api/jobs/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == job_id
    assert data["stage"] == "IDENTIFYING_CHAPTERS"
    assert data["progress_percent"] == 70.0


def test_start_processing_prevents_duplicate():
    """Verify duplicate submission prevention for in-progress jobs."""
    project_id = "active_dup_project"
    existing_job_id = "existing_running_job"

    update_job_status(existing_job_id, "TRANSCRIBING", 50.0, "Transcribing in progress...", project_id=project_id)

    # Attempt to start processing for the same project
    response = client.post("/api/process/start", json={"file_id": project_id})
    assert response.status_code == 200
    data = response.json()
    # Must return the existing job rather than spawning another
    assert data["job_id"] == existing_job_id
    assert data["stage"] == "TRANSCRIBING"


def test_stream_media_range_support():
    """Verify partial content and Range streaming for synchronized media playback."""
    response = client.get("/api/media/demo_presentation", headers={"Range": "bytes=0-1023"})
    # Demo sample exists, so it should return 206 Partial Content
    assert response.status_code == 206
    assert "Content-Range" in response.headers
    assert "Accept-Ranges" in response.headers
    assert response.headers["Accept-Ranges"] == "bytes"
