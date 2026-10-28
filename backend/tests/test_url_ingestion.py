import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.services.url_ingestion_service import (
    validate_url_security,
    extract_youtube_video_id,
    ingest_remote_media_url,
)
from app.database import get_db

client = TestClient(app)


def test_ssrf_rejects_disallowed_schemes():
    with pytest.raises(HTTPException) as exc_info:
        validate_url_security("file:///etc/passwd")
    assert exc_info.value.status_code == 400
    assert "scheme" in exc_info.value.detail.lower()

    with pytest.raises(HTTPException) as exc_info2:
        validate_url_security("ftp://ftp.example.com/video.mp4")
    assert exc_info2.value.status_code == 400


def test_ssrf_rejects_localhost_and_cloud_metadata():
    for blocked_url in [
        "http://localhost:8000/media.mp4",
        "http://127.0.0.1/video.mp4",
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://0.0.0.0/test.mp4",
        "http://server.local/video.mp4",
        "http://internal.arpa/video.mp4",
    ]:
        with pytest.raises(HTTPException) as exc_info:
            validate_url_security(blocked_url)
        assert exc_info.value.status_code == 400
        assert "ssrf" in exc_info.value.detail.lower() or "restricted" in exc_info.value.detail.lower() or "resolve" in exc_info.value.detail.lower()


def test_ssrf_rejects_private_ip_resolution():
    # Mock DNS resolution to return private IP 10.0.0.5 for a seemingly harmless domain
    mock_addr = [(2, 1, 0, '', ('10.0.0.5', 0))]
    with patch("socket.getaddrinfo", return_value=mock_addr):
        with pytest.raises(HTTPException) as exc_info:
            validate_url_security("https://private-corp-intranet.com/video.mp4")
        assert exc_info.value.status_code == 400
        assert "ssrf blocked" in exc_info.value.detail.lower()


def test_extract_youtube_video_id():
    test_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
    ]
    for url, expected_id in test_cases:
        assert extract_youtube_video_id(url) == expected_id

    assert extract_youtube_video_id("https://vimeo.com/1234567") is None
    assert extract_youtube_video_id("https://example.com/video.mp4") is None


@pytest.mark.asyncio
async def test_ingest_youtube_url_creates_project():
    mock_addr = [(2, 1, 0, '', ('142.250.190.46', 0))]  # Public Google IP
    with patch("socket.getaddrinfo", return_value=mock_addr):
        res = await ingest_remote_media_url(
            "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
            title_hint="Luis Fonsi - Despacito"
        )
        assert res["kind"] == "youtube"
        assert res["file_id"] == "yt_kJQP7kiw5Fk"
        assert "youtube.com/watch?v=kJQP7kiw5Fk" in res["source_url"]

        # Check DB entry
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", ("yt_kJQP7kiw5Fk",))
            row = cursor.fetchone()
            assert row is not None
            assert row["media_type"] == "video"
            assert "youtube.com/watch?v=kJQP7kiw5Fk" in row["source_url"]


def test_api_ingest_url_endpoint():
    mock_addr = [(2, 1, 0, '', ('142.250.190.46', 0))]
    with patch("socket.getaddrinfo", return_value=mock_addr):
        response = client.post("/api/ingest/url", json={
            "url": "https://youtu.be/dQw4w9WgXcQ",
            "title": "Rick Astley"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["kind"] == "youtube"
        assert data["file_id"] == "yt_dQw4w9WgXcQ"


def test_start_processing_with_youtube_url():
    mock_addr = [(2, 1, 0, '', ('142.250.190.46', 0))]
    with patch("socket.getaddrinfo", return_value=mock_addr), \
         patch("app.main.process_media_background_job") as mock_job:
        response = client.post("/api/process/start", json={
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "title": "Rick Astley"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["project_id"] == "yt_dQw4w9WgXcQ"
        assert data["stage"] == "QUEUED"
