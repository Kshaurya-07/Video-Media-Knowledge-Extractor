import os
import uuid
from pathlib import Path
from typing import Generator, Tuple
from fastapi import HTTPException
from app.config import UPLOAD_DIR, SAMPLES_DIR

def format_seconds(seconds: float) -> str:
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def get_media_path(file_id: str) -> Path:
    # Check uploads directory first
    for ext in ['.mp4', '.webm', '.mov', '.mp3', '.wav', '.m4a', '.ogg', '.mkv']:
        candidate = UPLOAD_DIR / f"{file_id}{ext}"
        if candidate.exists():
            return candidate
    
    # Check if exact file_id exists
    direct = UPLOAD_DIR / file_id
    if direct.exists():
        return direct
        
    # Check samples directory
    for f in SAMPLES_DIR.iterdir():
        if f.stem == file_id or f.name == file_id:
            return f
            
    raise HTTPException(status_code=404, detail="Media file not found")

def get_media_mime_type(filepath: Path) -> str:
    ext = filepath.suffix.lower()
    mapping = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.mkv': 'video/x-matroska',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg',
    }
    return mapping.get(ext, 'application/octet-stream')

def range_stream(filepath: Path, range_header: str | None = None) -> Tuple[Generator, int, int, int, str]:
    """
    Supports HTTP Range requests for video/audio streaming with instant seeking.
    Returns: (generator, start, end, file_size, content_type)
    """
    file_size = filepath.stat().st_size
    mime_type = get_media_mime_type(filepath)
    
    if not range_header:
        def full_stream():
            with open(filepath, "rb") as f:
                while chunk := f.read(1024 * 1024):
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
            chunk_size = 1024 * 512  # 512KB chunks
            while remaining > 0:
                read_bytes = min(remaining, chunk_size)
                data = f.read(read_bytes)
                if not data:
                    break
                remaining -= len(data)
                yield data

    return chunk_generator(), start, end, file_size, mime_type
