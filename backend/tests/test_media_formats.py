import struct
from pathlib import Path
import pytest

from app.services.media_service import (
    SUPPORTED_VIDEO_EXTENSIONS,
    SUPPORTED_AUDIO_EXTENSIONS,
    SUPPORTED_MEDIA_EXTENSIONS,
    ALL_SUPPORTED_EXTENSIONS,
    MAX_MEDIA_FILE_SIZE_BYTES,
    format_seconds,
    get_media_mime_type,
    validate_media_file_content,
    inspect_media_file,
)


def test_supported_extensions_comprehensiveness():
    """Verify all requested container formats and codecs are registered."""
    required_video = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".mpeg", ".mpg", ".wmv", ".3gp"}
    required_audio = {".mp3", ".wav", ".m4a", ".ogg"}

    for ext in required_video:
        assert ext in SUPPORTED_VIDEO_EXTENSIONS
        assert ext in ALL_SUPPORTED_EXTENSIONS
        assert get_media_mime_type(Path(f"test{ext}")).startswith("video/")

    for ext in required_audio:
        assert ext in SUPPORTED_AUDIO_EXTENSIONS
        assert ext in ALL_SUPPORTED_EXTENSIONS
        assert get_media_mime_type(Path(f"test{ext}")).startswith("audio/")


def test_format_seconds_formatting():
    assert format_seconds(0) == "00:00"
    assert format_seconds(45) == "00:45"
    assert format_seconds(125) == "02:05"
    assert format_seconds(3665) == "01:01:05"
    assert format_seconds(-10) == "00:00"
    assert format_seconds(None) == "00:00"


def test_validate_and_inspect_sample_wav():
    sample_path = Path("backend/samples/demo_presentation.wav")
    assert sample_path.exists(), "Sample presentation audio should be present"

    is_valid, msg = validate_media_file_content(sample_path)
    assert is_valid is True
    assert msg == "Valid media file"

    info = inspect_media_file(sample_path)
    assert info["media_type"] == "audio"
    assert info["mime_type"] == "audio/wav"
    assert info["has_audio"] is True
    assert info["audio_tracks"] >= 1
    assert abs(info["duration_seconds"] - 45.0) < 0.5
    assert info["duration_formatted"] == "00:45"


def test_validation_rejects_invalid_files(tmp_path):
    # 1. Non-existent file
    valid, msg = validate_media_file_content(tmp_path / "does_not_exist.mp4")
    assert valid is False
    assert "not exist" in msg.lower()

    # 2. Empty file
    empty_file = tmp_path / "empty.mp4"
    empty_file.write_bytes(b"")
    valid, msg = validate_media_file_content(empty_file)
    assert valid is False
    assert "empty" in msg.lower()

    # 3. Unsupported extension
    unsupported = tmp_path / "file.exe"
    unsupported.write_bytes(b"MZ\x90\x00\x03\x00")
    valid, msg = validate_media_file_content(unsupported)
    assert valid is False
    assert "unsupported" in msg.lower()

    # 4. Corrupted content (invalid magic bytes for container)
    corrupted_mp4 = tmp_path / "fake.mp4"
    corrupted_mp4.write_bytes(b"THIS IS NOT A VALID MP4 FILE AT ALL")
    valid, msg = validate_media_file_content(corrupted_mp4)
    assert valid is False
    assert "match expected format" in msg.lower()

    # 5. File exceeding size limit
    oversized = tmp_path / "oversized.mp4"
    oversized.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00isommp42")
    valid, msg = validate_media_file_content(oversized, max_bytes=10)
    assert valid is False
    assert "exceeds maximum allowed size" in msg.lower()


def test_mp4_pure_python_atom_box_parser(tmp_path):
    """Construct a minimal valid MP4 file with ftyp + moov/mvhd/tkhd atoms and verify parsing."""
    mp4_file = tmp_path / "synthetic_test.mp4"

    # ftyp atom (24 bytes)
    ftyp = struct.pack(">I4s4sI4s4s", 24, b"ftyp", b"isom", 0x200, b"isom", b"mp42")

    # mvhd atom inside moov:
    # version=0 (1 byte), flags (3 bytes)
    # creation_time=0 (4 bytes), mod_time=0 (4 bytes)
    # timescale=1000 (4 bytes), duration=25000 (4 bytes -> 25.0s)
    # remaining mvhd fields up to 108 bytes
    mvhd_payload = (
        b"\x00\x00\x00\x00"  # v=0, flags=0
        + b"\x00\x00\x00\x00"  # creation
        + b"\x00\x00\x00\x00"  # mod
        + struct.pack(">II", 1000, 25000)  # timescale=1000, duration=25000 (25.0s)
        + b"\x00" * 80  # rates, matrix, etc.
    )
    mvhd_box = struct.pack(">I4s", len(mvhd_payload) + 8, b"mvhd") + mvhd_payload

    # tkhd atom inside trak inside moov:
    # version=0 (1 byte), flags (3 bytes)
    # width and height at offset 72 from payload start (fixed point 16.16: 1920x1080)
    tkhd_payload = b"\x00" * 72 + struct.pack(">II", 1920 << 16, 1080 << 16)
    tkhd_box = struct.pack(">I4s", len(tkhd_payload) + 8, b"tkhd") + tkhd_payload

    # hdlr atom inside mdia inside trak:
    # subtype 'vide' or 'soun'
    hdlr_payload = b"\x00\x00\x00\x00\x00\x00\x00\x00soun" + b"\x00" * 12
    hdlr_box = struct.pack(">I4s", len(hdlr_payload) + 8, b"hdlr") + hdlr_payload

    mdia_box = struct.pack(">I4s", len(hdlr_box) + 8, b"mdia") + hdlr_box
    trak_box = struct.pack(">I4s", len(tkhd_box) + len(mdia_box) + 8, b"trak") + tkhd_box + mdia_box

    moov_payload = mvhd_box + trak_box
    moov_box = struct.pack(">I4s", len(moov_payload) + 8, b"moov") + moov_payload

    mp4_file.write_bytes(ftyp + moov_box)

    # Validate
    valid, msg = validate_media_file_content(mp4_file)
    assert valid is True

    # Inspect
    info = inspect_media_file(mp4_file)
    assert info["media_type"] == "video"
    assert info["mime_type"] == "video/mp4"
    assert abs(info["duration_seconds"] - 25.0) < 0.1
    assert info["duration_formatted"] == "00:25"
    assert info["width"] == 1920
    assert info["height"] == 1080
    assert info["has_audio"] is True


def test_avi_riff_parser(tmp_path):
    """Construct a minimal valid AVI file with RIFF AVI and avih header and verify parsing."""
    avi_file = tmp_path / "synthetic_test.avi"

    # avih header payload (40 bytes used: us_per_frame, max_bps, pad, flags, total_frames, init_frames, streams, buf_sz, w, h)
    us_per_frame = 33333  # ~30fps
    total_frames = 600   # 600 * 33333 / 1000000 = ~20.0s
    streams = 2          # 1 video + 1 audio
    width = 1280
    height = 720
    avih_payload = struct.pack("<IIIIIIIIII", us_per_frame, 0, 0, 0, total_frames, 0, streams, 0, width, height)
    avih_chunk = b"avih" + struct.pack("<I", len(avih_payload)) + avih_payload

    # Wrap in RIFF AVI
    riff_data = b"RIFF" + struct.pack("<I", len(avih_chunk) + 4) + b"AVI " + avih_chunk
    avi_file.write_bytes(riff_data)

    valid, msg = validate_media_file_content(avi_file)
    assert valid is True

    info = inspect_media_file(avi_file)
    assert info["media_type"] == "video"
    assert info["mime_type"] == "video/x-msvideo"
    assert abs(info["duration_seconds"] - 20.0) < 0.2
    assert info["duration_formatted"] == "00:20"
    assert info["width"] == 1280
    assert info["height"] == 720
    assert info["has_audio"] is True
