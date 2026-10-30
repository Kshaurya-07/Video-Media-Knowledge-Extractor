import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.services.pipeline_service import update_job_status, ACTIVE_JOBS

client = TestClient(app)

def test_health_check_endpoint():
    """Verify backend health endpoint responds with system status."""
    for path in ["/api/health", "/health"]:
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "VYORA AI" in data["service"]
        assert data["model"] == "gemini-3.8-flash"
        assert data["configured_model"] == "gemini-3.8-flash"
        assert data["display_model"] == "Gemini 3.8 Flash"


def test_readiness_endpoints():
    """Verify backend readiness endpoints respond with 200 OK and database connectivity."""
    for path in ["/api/ready", "/ready"]:
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["database"] == "connected"


def test_root_endpoint():
    """Verify backend root endpoint responds with 200 OK (either SPA HTML or JSON health)."""
    response = client.get("/")
    assert response.status_code == 200
    content_type = response.headers.get("content-type", "")
    if "text/html" in content_type:
        assert "<!doctype html>" in response.text.lower()
    else:
        data = response.json()
        assert data["service"] == "VYORA AI Backend"
        assert data["status"] == "healthy"


def test_config_endpoint():
    """Verify backend config endpoint returns safe, non-secret model status."""
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "Google Gemini"
    assert data["configured_model"] == "gemini-3.8-flash"
    assert data["display_model"] == "Gemini 3.8 Flash"
    assert "api_key" not in data


def test_system_model_status_endpoint_no_key():
    """Verify system model status endpoint safely returns model metadata without API key."""
    with patch("app.services.model_discovery_service.get_api_key", return_value=""):
        response = client.get("/api/system/model-status")
        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == "Google Gemini"
        assert data["configured_model"] == "gemini-3.8-flash"
        assert data["display_model"] == "Gemini 3.8 Flash"
        assert data["status"] == "pending_key"
        assert data["has_api_key"] is False
        assert data["model_verified"] is False
        assert "api_key" not in data


def test_system_model_status_endpoint_verified():
    """Verify system model status endpoint returns connected when model is verified."""
    mock_model = MagicMock()
    mock_model.name = "models/gemini-3.8-flash"
    mock_model.display_name = "Gemini 3.8 Flash"
    mock_model.supported_actions = ["generateContent"]
    mock_model.input_token_limit = 1048576

    with patch("app.services.model_discovery_service.get_api_key", return_value="mock_key_xyz"), \
         patch("app.services.model_discovery_service.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_client_cls.return_value = mock_instance
        mock_instance.models.list.return_value = [mock_model]

        response = client.get("/api/system/model-status", headers={"X-Gemini-Api-Key": "mock_key_xyz"})
        assert response.status_code == 200
        data = response.json()
        assert data["provider"] == "Google Gemini"
        assert data["configured_model"] == "gemini-3.8-flash"
        assert data["display_model"] == "Gemini 3.8 Flash"
        assert data["status"] == "connected"
        assert data["has_api_key"] is True
        assert data["model_verified"] is True
        assert "api_key" not in data


def test_verify_key_endpoint_empty():
    """Verify key verification rejects empty key with actionable message."""
    response = client.post("/api/verify-key", json={"api_key": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False
    assert "empty" in data["message"].lower()


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
    from app.database import get_db
    project_id = "active_dup_project"
    existing_job_id = "existing_running_job"

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO projects (id, user_id, title, media_type, filename, file_path, status)
            VALUES (?, 'user', 'Dup Test', 'video', 'dup.mp4', 'uploads/dup.mp4', 'PROCESSING')
        """, (project_id,))
        conn.commit()

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


def test_server_key_detection():
    """Verify /api/config accurately reports whether server key is configured."""
    with patch("app.main.get_api_key", return_value="AIzaSyTestServerKey123"):
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.json()
        assert data["server_api_key_configured"] is True
        assert "api_key" not in data

    with patch("app.main.get_api_key", return_value=""):
        response = client.get("/api/config")
        assert response.status_code == 200
        data = response.json()
        assert data["server_api_key_configured"] is False


def test_verify_key_success():
    """Verify /api/verify-key returns valid when lightweight check succeeds."""
    mock_model = MagicMock()
    mock_model.display_name = "Gemini 2.0 Flash"
    with patch("app.services.model_discovery_service.genai.Client") as mock_client_cls:
        instance = MagicMock()
        mock_client_cls.return_value = instance
        instance.models.get.return_value = mock_model

        response = client.post("/api/verify-key", json={"api_key": "AIzaSyValidKey12345"})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert "verified" in data["message"].lower()


def test_verify_key_invalid():
    """Verify /api/verify-key returns invalid on 401 unauthenticated response."""
    with patch("app.services.model_discovery_service.genai.Client") as mock_client_cls:
        instance = MagicMock()
        mock_client_cls.return_value = instance
        instance.models.get.side_effect = Exception("401 API_KEY_INVALID: User not found")

        response = client.post("/api/verify-key", json={"api_key": "AIzaSyBadKey12345"})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert "invalid" in data["message"].lower()


def test_stale_abandoned_job_recovery():
    """Verify an orphaned in-flight job from a prior run is recovered and marked FAILED."""
    from app.database import get_db
    from app.services.pipeline_service import get_active_job_for_project

    orphaned_id = "orphaned_job_999"
    project_id = "orphaned_project_999"

    # Insert orphaned in-flight job into DB (not present in ACTIVE_JOBS)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO projects (id, user_id, title, media_type, filename, file_path, status)
            VALUES (?, 'user', 'Orphaned', 'video', 'orphaned.mp4', 'uploads/orphaned.mp4', 'PROCESSING')
        """, (project_id,))
        cursor.execute("""
            INSERT OR REPLACE INTO processing_jobs (job_id, project_id, stage, progress_percent, message)
            VALUES (?, ?, 'QUEUED', 10.0, 'Old stalled job')
        """, (orphaned_id, project_id))
        conn.commit()

    # Querying active job should mark it failed in DB and return None
    result = get_active_job_for_project(project_id)
    assert result is None, "Abandoned job must not be returned as active"

    # Status endpoint should now reflect FAILED with clear recovery message
    res = client.get(f"/api/jobs/{orphaned_id}")
    assert res.status_code == 200
    assert res.json()["stage"] == "FAILED"
    assert "restart" in res.json()["message"].lower() or "stopped" in res.json()["message"].lower()
