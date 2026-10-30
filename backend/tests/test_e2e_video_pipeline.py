import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.main import app
from app.services.media_service import inspect_media_file, format_seconds
from app.database import get_db

client = TestClient(app)

def test_mp4_upload_and_metadata_inspection():
    """Verify real MP4 video upload, byte counting, metadata inspection, and DB persistence."""
    video_path = Path("backend/samples/big_buck_bunny.mp4")
    assert video_path.exists(), "Real test MP4 must exist"

    with open(video_path, "rb") as f:
        response = client.post("/api/upload", files={"file": ("big_buck_bunny.mp4", f, "video/mp4")})

    assert response.status_code == 200, f"Upload failed: {response.text}"
    data = response.json()
    assert data["filename"] == "big_buck_bunny.mp4"
    assert data["media_type"] == "video"
    assert data["file_size_bytes"] == 5510872
    assert data["duration_seconds"] > 0
    assert data["duration_formatted"] != "00:00"

    file_id = data["file_id"]

    # Verify project row was created in SQLite with correct inspected duration
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (file_id,))
        proj = cursor.fetchone()
        assert proj is not None
        assert proj["filename"] == "big_buck_bunny.mp4"
        assert proj["media_type"] == "video"
        assert proj["duration_seconds"] > 0
        assert proj["status"] == "QUEUED"


def test_mp4_byte_range_streaming_and_player_seeking():
    """Verify HTTP Range partial content streaming allows instant player seeking."""
    video_path = Path("backend/samples/big_buck_bunny.mp4")
    file_id = "test_player_stream_vid"
    dest_path = Path("backend/uploads") / f"{file_id}.mp4"
    
    # Copy sample to uploads
    import shutil
    shutil.copyfile(video_path, dest_path)

    try:
        # 1. Full stream request (HTTP 200)
        res_full = client.get(f"/api/media/stream/{file_id}")
        assert res_full.status_code == 200
        assert res_full.headers["content-type"] == "video/mp4"
        assert res_full.headers["accept-ranges"] == "bytes"

        # 2. Seek to 2MB (HTTP 206 Partial Content)
        headers = {"Range": "bytes=2097152-4194303"}
        res_seek = client.get(f"/api/media/stream/{file_id}", headers=headers)
        assert res_seek.status_code == 206
        assert res_seek.headers["content-range"].startswith("bytes 2097152-4194303/5510872")
        assert len(res_seek.content) == 2097152
    finally:
        if dest_path.exists():
            dest_path.unlink()
