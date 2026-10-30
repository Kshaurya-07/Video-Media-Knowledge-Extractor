import re
import uuid
import socket
import ipaddress
import logging
from urllib.parse import urlsplit, urlunsplit
from pathlib import Path
from typing import Optional, Dict, Any

import httpx
from fastapi import HTTPException

from app.config import UPLOAD_DIR
from app.database import get_db
from app.services.media_service import (
    validate_media_file_content,
    inspect_media_file,
    ALL_SUPPORTED_EXTENSIONS,
)

logger = logging.getLogger("vyora.url_ingestion")

MAX_REMOTE_MEDIA_BYTES = 500 * 1024 * 1024  # 500 MB limit
YOUTUBE_REGEX = re.compile(
    r'(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})',
    re.IGNORECASE
)

BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "169.254.169.254",
    "metadata",
}

BLOCKED_DOMAIN_SUFFIXES = (
    ".local",
    ".internal",
    ".localhost",
    ".onion",
    ".arpa",
)


def validate_url_security(url: str) -> str:
    """
    Validate URL to strictly block Server-Side Request Forgery (SSRF).
    Ensures safe scheme, public hostnames, and resolves DNS to verify no
    private, loopback, link-local, multicast, or reserved IPs are targeted.
    """
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="Invalid media URL: URL cannot be empty.")

    clean_url = url.strip()
    try:
        parts = urlsplit(clean_url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid media URL syntax: {str(e)}")

    if parts.scheme.lower() not in ("http", "https"):
        raise HTTPException(
            status_code=400,
            detail=f"Prohibited URL scheme '{parts.scheme}'. Only HTTP and HTTPS protocols are permitted."
        )

    hostname = parts.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid media URL: Hostname is missing.")

    hostname_lower = hostname.lower()

    # Block well-known private/loopback/cloud metadata hostnames
    if hostname_lower in BLOCKED_HOSTNAMES or any(hostname_lower.endswith(sfx) for sfx in BLOCKED_DOMAIN_SUFFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"Security Alert: Destination hostname '{hostname}' is restricted (SSRF protection)."
        )

    # DNS Resolution and IP address validation
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror as e:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to resolve host '{hostname}': {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Host resolution error for '{hostname}': {str(e)}"
        )

    if not addr_info:
        raise HTTPException(status_code=400, detail=f"No IP addresses resolved for '{hostname}'.")

    for entry in addr_info:
        ip_str = entry[4][0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)

            # Unmap IPv4 mapped IPv6 (e.g. ::ffff:127.0.0.1)
            if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
                ip_obj = ip_obj.ipv4_mapped

            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
                or ip_obj.is_unspecified
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Security Alert: Host resolved to prohibited network address '{ip_str}' (SSRF blocked)."
                )
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid IP address resolved: '{ip_str}'.")

    # Return normalized URL
    return urlunsplit(parts)


def extract_youtube_video_id(url: str) -> Optional[str]:
    """Extract YouTube video ID if URL matches YouTube patterns."""
    match = YOUTUBE_REGEX.search(url)
    if match:
        return match.group(1)
    return None


async def ingest_remote_media_url(
    raw_url: str,
    title_hint: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ingest a validated remote video link (YouTube or direct HTTP media stream).
    Registers the media project into SQLite and returns ingestion details.
    """
    validated_url = validate_url_security(raw_url)

    # 1. Check for YouTube Link
    yt_id = extract_youtube_video_id(validated_url)
    if yt_id:
        canonical_url = f"https://www.youtube.com/watch?v={yt_id}"
        file_id = f"yt_{yt_id}"
        title = title_hint.strip() if title_hint and title_hint.strip() else f"YouTube Video ({yt_id})"

        # Persist project row
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO projects (
                id, user_id, title, description, media_type, filename, file_path,
                source_url, duration_seconds, duration_formatted, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                source_url = excluded.source_url,
                file_path = excluded.file_path,
                status = 'QUEUED'
            """, (
                file_id,
                "default_user",
                title,
                f"Ingested from YouTube: {canonical_url}",
                "video",
                f"youtube_{yt_id}.mp4",
                canonical_url,
                canonical_url,
                300.0,
                "05:00",
                "QUEUED"
            ))
            conn.commit()

        logger.info(f"[VYORA Ingestion] Registered YouTube stream {canonical_url} as project {file_id}")
        return {
            "file_id": file_id,
            "kind": "youtube",
            "source_url": canonical_url,
            "title": title,
            "media_type": "video",
        }

    # 2. Direct Video/Audio Stream Download
    file_id = f"url_{uuid.uuid4().hex[:10]}"
    parsed = urlsplit(validated_url)
    orig_filename = Path(parsed.path).name or "stream_video.mp4"
    suffix = Path(orig_filename).suffix.lower()
    if suffix not in ALL_SUPPORTED_EXTENSIONS:
        suffix = ".mp4"

    save_path = UPLOAD_DIR / f"{file_id}{suffix}"

    logger.info(f"[VYORA Ingestion] Downloading media from {validated_url} to {save_path}...")

    # Download with size caps and redirect safety
    timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3) as client:
        # Re-validate any redirect locations for SSRF
        try:
            head_res = await client.head(validated_url)
            # Re-validate final URL if redirected
            if str(head_res.url) != validated_url:
                validate_url_security(str(head_res.url))

            content_length = head_res.headers.get("content-length")
            if content_length and int(content_length) > MAX_REMOTE_MEDIA_BYTES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Remote media size ({int(content_length) / (1024 * 1024):.1f}MB) exceeds 500MB maximum limit."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.debug(f"[VYORA Ingestion] HEAD check warning: {e}")

        # Stream download file with strict byte counter
        try:
            async with client.stream("GET", validated_url) as response:
                if str(response.url) != validated_url:
                    validate_url_security(str(response.url))

                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to fetch remote media stream: HTTP {response.status_code}"
                    )

                downloaded_bytes = 0
                with open(save_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        downloaded_bytes += len(chunk)
                        if downloaded_bytes > MAX_REMOTE_MEDIA_BYTES:
                            f.close()
                            if save_path.exists():
                                save_path.unlink()
                            raise HTTPException(
                                status_code=400,
                                detail="Remote media stream exceeded the 500MB size limit during download."
                            )
                        f.write(chunk)
        except HTTPException:
            raise
        except Exception as e:
            if save_path.exists():
                save_path.unlink()
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download remote media from URL: {str(e)}"
            )

    # Validate container format & magic bytes
    is_valid, validation_msg = validate_media_file_content(save_path)
    if not is_valid:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=400, detail=f"Downloaded media stream is invalid: {validation_msg}")

    # Inspect media properties
    info = inspect_media_file(save_path)
    duration_secs = info.get("duration_seconds", 120.0)
    duration_fmt = info.get("duration_formatted", "02:00")
    media_type = info.get("media_type", "video")
    title = title_hint.strip() if title_hint and title_hint.strip() else orig_filename

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO projects (
            id, user_id, title, description, media_type, filename, file_path,
            source_url, duration_seconds, duration_formatted, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            source_url = excluded.source_url,
            file_path = excluded.file_path,
            duration_seconds = excluded.duration_seconds,
            duration_formatted = excluded.duration_formatted,
            status = 'QUEUED'
        """, (
            file_id,
            "default_user",
            title,
            f"Ingested from direct URL: {validated_url}",
            media_type,
            orig_filename,
            str(save_path),
            validated_url,
            duration_secs,
            duration_fmt,
            "QUEUED"
        ))
        conn.commit()

    logger.info(f"[VYORA Ingestion] Ingested direct stream to {save_path} as project {file_id}")
    return {
        "file_id": file_id,
        "kind": "direct_file",
        "source_url": validated_url,
        "file_path": str(save_path),
        "title": title,
        "media_type": "video" if is_video else "audio",
    }
