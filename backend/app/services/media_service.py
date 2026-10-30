import os
import shutil
import struct
import subprocess
import json
import logging
import time
from pathlib import Path
from typing import Generator, Tuple, Dict, Any, Optional
from fastapi import HTTPException
from app.config import UPLOAD_DIR, SAMPLES_DIR

logger = logging.getLogger("vyora.media")

MAX_MEDIA_FILE_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB limit

SUPPORTED_VIDEO_EXTENSIONS: Dict[str, str] = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpeg",
    ".wmv": "video/x-ms-wmv",
    ".3gp": "video/3gpp",
}

SUPPORTED_AUDIO_EXTENSIONS: Dict[str, str] = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
}

SUPPORTED_MEDIA_EXTENSIONS: Dict[str, str] = {
    **SUPPORTED_VIDEO_EXTENSIONS,
    **SUPPORTED_AUDIO_EXTENSIONS,
}

ALL_SUPPORTED_EXTENSIONS = list(SUPPORTED_MEDIA_EXTENSIONS.keys())

def format_seconds(seconds: float) -> str:
    if seconds is None or seconds < 0:
        return "00:00"
    total_seconds = int(round(seconds))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def get_media_path(file_id: str) -> Path:
    # Check uploads directory first across all supported extensions
    for ext in ALL_SUPPORTED_EXTENSIONS:
        candidate = UPLOAD_DIR / f"{file_id}{ext}"
        if candidate.exists():
            return candidate

    # Check if exact file_id exists
    direct = UPLOAD_DIR / file_id
    if direct.exists():
        return direct

    # Check samples directory
    if SAMPLES_DIR.exists():
        for f in SAMPLES_DIR.iterdir():
            if f.stem == file_id or f.name == file_id:
                return f

    raise HTTPException(status_code=404, detail="Media file not found")

def get_media_mime_type(filepath: Path) -> str:
    ext = filepath.suffix.lower()
    return SUPPORTED_MEDIA_EXTENSIONS.get(ext, 'application/octet-stream')

def validate_media_file_content(filepath: Path, max_bytes: int = MAX_MEDIA_FILE_SIZE_BYTES) -> Tuple[bool, str]:
    """
    Validate media file existence, non-emptiness, maximum file size,
    allowed extension, and binary container magic byte signatures.
    """
    if not filepath.exists():
        return False, "File does not exist on disk."

    file_size = filepath.stat().st_size
    if file_size == 0:
        return False, "File is empty (0 bytes)."

    if file_size > max_bytes:
        mb_actual = file_size / (1024 * 1024)
        mb_limit = max_bytes // (1024 * 1024)
        return False, f"File exceeds maximum allowed size of {mb_limit}MB (actual: {mb_actual:.1f}MB)."

    ext = filepath.suffix.lower()
    if ext not in SUPPORTED_MEDIA_EXTENSIONS:
        supported_str = ", ".join(sorted(SUPPORTED_MEDIA_EXTENSIONS.keys()))
        return False, f"Unsupported file extension '{ext}'. Supported formats: {supported_str}."

    # Inspect first 64KB for container signatures
    try:
        with open(filepath, "rb") as f:
            header = f.read(65536)
    except Exception as e:
        return False, f"Failed to read file header: {str(e)}"

    if len(header) < 4:
        return False, "File is truncated or too small to be valid media."

    valid_signature = False

    # 1. MP4 / MOV / M4A / 3GP (ISO Base Media File Format)
    if ext in [".mp4", ".mov", ".m4a", ".3gp"]:
        if b"ftyp" in header[:64] or b"moov" in header[:4096] or b"mdat" in header[:4096] or b"wide" in header[:64]:
            valid_signature = True
        elif ext == ".mov" and (header[4:8] in [b"moov", b"mdat", b"wide", b"skip", b"free"]):
            valid_signature = True

    # 2. MKV / WEBM (EBML)
    elif ext in [".mkv", ".webm"]:
        if header.startswith(b"\x1a\x45\xdf\xa3") or b"\x1a\x45\xdf\xa3" in header[:32]:
            valid_signature = True

    # 3. AVI (RIFF ... AVI )
    elif ext == ".avi":
        if header.startswith(b"RIFF") and header[8:12] == b"AVI ":
            valid_signature = True

    # 4. WAV (RIFF ... WAVE)
    elif ext == ".wav":
        if header.startswith(b"RIFF") and header[8:12] == b"WAVE":
            valid_signature = True

    # 5. MPEG / MPG
    elif ext in [".mpeg", ".mpg"]:
        if (
            header.startswith(b"\x00\x00\x01\xba")
            or header.startswith(b"\x00\x00\x01\xb3")
            or b"\x00\x00\x01" in header[:64]
        ):
            valid_signature = True

    # 6. WMV / ASF
    elif ext == ".wmv":
        asf_guid = b"\x30\x26\xb2\x75\x8e\x66\xcf\x11\xa6\xd9\x00\xaa\x00\x62\xce\x6c"
        if header.startswith(asf_guid) or asf_guid in header[:64]:
            valid_signature = True

    # 7. MP3
    elif ext == ".mp3":
        if header.startswith(b"ID3") or (len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
            valid_signature = True

    # 8. OGG
    elif ext == ".ogg":
        if header.startswith(b"OggS"):
            valid_signature = True

    if not valid_signature:
        return False, f"File content does not match expected format for {ext} container."

    return True, "Valid media file"


def _inspect_via_ffprobe(filepath: Path) -> Optional[Dict[str, Any]]:
    """Probe media metadata using ffprobe executable if available on system."""
    ffprobe_bin = shutil.which("ffprobe")
    if not ffprobe_bin:
        return None

    try:
        cmd = [
            ffprobe_bin,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(filepath),
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode != 0 or not res.stdout:
            return None

        data = json.loads(res.stdout)
        fmt = data.get("format", {})
        streams = data.get("streams", [])

        duration = None
        if "duration" in fmt:
            try:
                duration = float(fmt["duration"])
            except (ValueError, TypeError):
                pass

        width = None
        height = None
        has_audio = False
        audio_tracks = 0

        for s in streams:
            codec_type = s.get("codec_type")
            if codec_type == "video":
                if width is None and "width" in s and "height" in s:
                    width = int(s["width"])
                    height = int(s["height"])
                if duration is None and "duration" in s:
                    try:
                        duration = float(s["duration"])
                    except (ValueError, TypeError):
                        pass
            elif codec_type == "audio":
                has_audio = True
                audio_tracks += 1
                if duration is None and "duration" in s:
                    try:
                        duration = float(s["duration"])
                    except (ValueError, TypeError):
                        pass

        return {
            "duration_seconds": duration,
            "width": width,
            "height": height,
            "has_audio": has_audio,
            "audio_tracks": audio_tracks,
            "format_name": fmt.get("format_name", ""),
        }
    except Exception as e:
        logger.debug(f"[VYORA Media] ffprobe inspection warning: {e}")
        return None


def _inspect_pure_python(filepath: Path) -> Dict[str, Any]:
    """Pure Python container inspection fallback when ffprobe is absent."""
    ext = filepath.suffix.lower()
    file_size = filepath.stat().st_size
    duration = None
    width = None
    height = None
    has_audio = ext in SUPPORTED_AUDIO_EXTENSIONS
    audio_tracks = 1 if has_audio else 0

    # 1. Standard WAV
    if ext == ".wav":
        try:
            import wave
            with wave.open(str(filepath), "rb") as w:
                frames = w.getnframes()
                rate = w.getframerate()
                if rate > 0:
                    duration = frames / float(rate)
                has_audio = True
                audio_tracks = w.getnchannels()
        except Exception:
            pass

    # 2. MP4 / MOV / 3GP / M4A Atom Box Parser
    elif ext in [".mp4", ".mov", ".m4a", ".3gp"]:
        try:
            with open(filepath, "rb") as f:
                data = f.read(min(file_size, 4 * 1024 * 1024))  # Read up to 4MB for atom headers

            def walk_atoms(buf: bytes, start: int, end: int):
                nonlocal duration, width, height, has_audio, audio_tracks
                curr = start
                while curr + 8 <= end:
                    size, btype = struct.unpack(">I4s", buf[curr:curr+8])
                    if size == 0:
                        break
                    if size == 1:
                        if curr + 16 > end:
                            break
                        size = struct.unpack(">Q", buf[curr+8:curr+16])[0]
                        box_data_start = curr + 16
                    else:
                        box_data_start = curr + 8

                    box_end = min(curr + size, end)

                    if btype in (b"moov", b"trak", b"mdia", b"minf"):
                        walk_atoms(buf, box_data_start, box_end)
                    elif btype == b"mvhd":
                        v = buf[box_data_start]
                        if v == 0 and box_data_start + 20 <= box_end:
                            timescale, dur = struct.unpack(">II", buf[box_data_start+12:box_data_start+20])
                            if timescale > 0:
                                duration = dur / float(timescale)
                        elif v == 1 and box_data_start + 32 <= box_end:
                            timescale = struct.unpack(">I", buf[box_data_start+20:box_data_start+24])[0]
                            dur = struct.unpack(">Q", buf[box_data_start+24:box_data_start+32])[0]
                            if timescale > 0:
                                duration = dur / float(timescale)
                    elif btype == b"tkhd":
                        v = buf[box_data_start]
                        pos = box_data_start + (84 if v == 1 else 72)
                        if pos + 8 <= box_end:
                            w, h = struct.unpack(">II", buf[pos:pos+8])
                            w = w >> 16
                            h = h >> 16
                            if w > 0 and h > 0 and (width is None or w > width):
                                width, height = w, h
                    elif btype == b"hdlr":
                        if box_data_start + 12 <= box_end:
                            subtype = buf[box_data_start+8:box_data_start+12]
                            if subtype == b"soun":
                                has_audio = True
                                audio_tracks = max(audio_tracks, 1)

                    curr = box_end

            walk_atoms(data, 0, len(data))
        except Exception as e:
            logger.debug(f"[VYORA Media] MP4 atom parser warning: {e}")

    # 3. AVI RIFF avih parser
    elif ext == ".avi":
        try:
            with open(filepath, "rb") as f:
                data = f.read(min(file_size, 1024 * 1024))
            if len(data) >= 48 and data.startswith(b"RIFF") and data[8:12] == b"AVI ":
                idx = data.find(b"avih")
                if idx != -1 and idx + 44 <= len(data):
                    payload = data[idx+8:idx+48]
                    us_per_frame, max_bps, pad, flags, total_frames, init_frames, streams, buf_sz, w, h = struct.unpack("<IIIIIIIIII", payload[:40])
                    if us_per_frame > 0 and total_frames > 0:
                        duration = (total_frames * us_per_frame) / 1000000.0
                    if w > 0 and h > 0:
                        width, height = w, h
                    if streams > 1:
                        has_audio = True
                        audio_tracks = streams - 1
        except Exception as e:
            logger.debug(f"[VYORA Media] AVI parser warning: {e}")

    # Fallback duration estimate if indeterminate
    if duration is None or duration <= 0:
        # Default fallback duration: 120.0s for user video, or estimated from typical 2Mbps bitrate
        duration = 120.0

    return {
        "duration_seconds": duration,
        "width": width,
        "height": height,
        "has_audio": has_audio,
        "audio_tracks": audio_tracks,
        "format_name": ext.replace(".", ""),
    }


def inspect_media_file(filepath: Path) -> Dict[str, Any]:
    """
    Inspect media file duration, resolution, audio streams, and size.
    Uses ffprobe if available on system, falling back to pure Python container parsing.
    """
    file_size = filepath.stat().st_size
    mime_type = get_media_mime_type(filepath)
    is_video = mime_type.startswith("video/")

    # Try ffprobe first
    info = _inspect_via_ffprobe(filepath)
    if not info or info.get("duration_seconds") is None:
        info = _inspect_pure_python(filepath)

    duration = info.get("duration_seconds") or 120.0

    return {
        "file_size_bytes": file_size,
        "mime_type": mime_type,
        "media_type": "video" if is_video else "audio",
        "duration_seconds": float(duration),
        "duration_formatted": format_seconds(float(duration)),
        "width": info.get("width"),
        "height": info.get("height"),
        "has_audio": info.get("has_audio", True),
        "audio_tracks": info.get("audio_tracks", 1),
        "format_name": info.get("format_name", filepath.suffix.replace(".", "")),
    }


def range_stream(filepath: Path, range_header: str | None = None) -> Tuple[Generator, int, int, int, str]:
    """
    Supports HTTP Range requests for video/audio streaming with instant seeking.
    Optimized for Render Free Tier (128KB chunks) to minimize RAM footprint.
    Returns: (generator, start, end, file_size, content_type)
    """
    file_size = filepath.stat().st_size
    mime_type = get_media_mime_type(filepath)
    stream_chunk_size = 128 * 1024  # 128KB chunks

    if not range_header:
        def full_stream():
            with open(filepath, "rb") as f:
                while chunk := f.read(stream_chunk_size):
                    yield chunk
        return full_stream(), 0, file_size - 1, file_size, mime_type

    # Parse Range: bytes=start-end
    try:
        range_val = range_header.replace("bytes=", "").strip()
        parts = range_val.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
    except ValueError:
        start = 0
        end = file_size - 1

    start = max(0, start)
    end = min(file_size - 1, end)
    content_length = (end - start) + 1

    def chunk_generator():
        with open(filepath, "rb") as f:
            f.seek(start)
            remaining = content_length
            while remaining > 0:
                read_bytes = min(remaining, stream_chunk_size)
                data = f.read(read_bytes)
                if not data:
                    break
                remaining -= len(data)
                yield data

    return chunk_generator(), start, end, file_size, mime_type


def cleanup_old_uploads(max_age_hours: float = 2.0, max_dir_size_mb: int = 250) -> int:
    """
    Render Free Tier disk optimizer:
    Cleans up old uploaded media files from UPLOAD_DIR once processed or expired,
    preventing ephemeral disk exhaustion while keeping DB metadata & Gemini references intact.
    """
    if not UPLOAD_DIR.exists():
        return 0

    now = time.time()
    max_age_secs = max_age_hours * 3600
    cleaned = 0

    try:
        files = [f for f in UPLOAD_DIR.glob("*") if f.is_file()]
        total_size = sum(f.stat().st_size for f in files)
        max_bytes = max_dir_size_mb * 1024 * 1024

        # Sort files by modification time (oldest first)
        files.sort(key=lambda f: f.stat().st_mtime)

        for f in files:
            if f.name.startswith("."):
                continue
            file_age = now - f.stat().st_mtime
            # Delete if older than max_age_secs OR if total directory size exceeds max_bytes
            if file_age > max_age_secs or total_size > max_bytes:
                file_size = f.stat().st_size
                try:
                    f.unlink()
                    cleaned += 1
                    total_size -= file_size
                    logger.info(f"Cleaned expired upload file {f.name} ({file_size} bytes)")
                except Exception as e:
                    logger.warning(f"Could not remove upload file {f.name}: {e}")
    except Exception as e:
        logger.error(f"Error during upload cleanup: {e}")

    return cleaned
