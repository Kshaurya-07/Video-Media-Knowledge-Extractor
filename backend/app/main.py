import os
import uuid
import json
import shutil
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    Header,
    Request,
    Response,
    HTTPException,
    status,
    BackgroundTasks,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from google import genai

from app.config import BASE_DIR, UPLOAD_DIR, SAMPLES_DIR, DATA_CACHE_DIR, get_api_key, DEFAULT_MODEL
from app.database import init_db, seed_demo_project_if_needed, get_db
from app.models.schemas import (
    MediaMetadata,
    MediaAnalysisResult,
    Chapter,
    TranscriptSegment,
    VisualScene,
    EntityItem,
    ActionItem,
    ChatRequest,
    ChatResponse,
    VerifyKeyRequest,
    VerifyKeyResponse,
)
from app.services.media_service import (
    get_media_path,
    get_media_mime_type,
    range_stream,
    format_seconds,
    validate_media_file_content,
    inspect_media_file,
    MAX_MEDIA_FILE_SIZE_BYTES,
)
from app.services.gemini_extractor import (
    extract_media_knowledge,
    get_cached_result,
    save_cache_result,
    sanitize_error_message,
)
from app.services.qa_service import answer_media_question
from app.services.model_discovery_service import (
    get_model_status_payload,
    get_active_model_selection,
    invalidate_model_cache,
    format_model_display_name,
    verify_gemini_key_lightweight,
)
from app.services.pipeline_service import (
    process_media_background_job,
    get_active_job_for_project,
    recover_all_stale_jobs,
    update_job_status,
    ACTIVE_JOBS,
)
from app.services.url_ingestion_service import (
    ingest_remote_media_url,
    validate_url_security,
)

import logging
logger = logging.getLogger("vyora.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and seed demo
    init_db()
    seed_demo_project_if_needed()
    recovered = recover_all_stale_jobs()
    if recovered > 0:
        logger.info(f"[VYORA AI] Cleaned up {recovered} orphaned processing jobs from prior runs.")
    logger.info(f"[VYORA AI] Initialized engine. Configured Gemini model: {DEFAULT_MODEL}")
    yield

app = FastAPI(
    title="VYORA AI — Video & Media Knowledge Extractor API",
    description="Multimodal knowledge extraction, chapter segmentation, OCR, 3D spatial mapping, and Q&A powered by Google Gemini",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Models for New Endpoints -----------------
class NoteCreateRequest(BaseModel):
    title: str
    content: str
    timestamp_seconds: Optional[float] = None
    timestamp_formatted: Optional[str] = None

class BookmarkCreateRequest(BaseModel):
    label: str
    timestamp_seconds: float
    timestamp_formatted: str

class StartProcessingRequest(BaseModel):
    file_id: Optional[str] = None
    url: Optional[str] = None
    title: Optional[str] = None
    api_key: Optional[str] = None

class IngestUrlRequest(BaseModel):
    url: str
    title: Optional[str] = None

# ----------------- Health & Configuration -----------------
@app.get("/api/system/model-status")
async def get_system_model_status(x_gemini_api_key: Optional[str] = Header(None)):
    return get_model_status_payload(api_key=x_gemini_api_key, allow_network=True)

@app.post("/api/system/model-cache/refresh")
async def refresh_model_cache(x_gemini_api_key: Optional[str] = Header(None)):
    invalidate_model_cache(api_key=x_gemini_api_key)
    return get_model_status_payload(api_key=x_gemini_api_key, allow_network=True)

@app.get("/api/config")
async def get_system_config(x_gemini_api_key: Optional[str] = Header(None)):
    payload = get_model_status_payload(api_key=x_gemini_api_key)
    server_key = get_api_key()
    has_server_key = bool(server_key and server_key.strip())
    has_user_key = bool(x_gemini_api_key and x_gemini_api_key.strip())
    return {
        "provider": "Google Gemini",
        "selection_mode": payload["selection_mode"],
        "configured_model": payload["selected_model"],
        "selected_model": payload["selected_model"],
        "display_model": payload["display_model"],
        "status": payload["status"],
        "has_api_key_configured": payload["has_api_key"],
        "server_api_key_configured": has_server_key,
        "user_api_key_provided": has_user_key,
        "compatible_models_count": payload["compatible_models_count"],
    }

@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check():
    has_env_key = bool(get_api_key())
    selected_model, selection_mode, _ = get_active_model_selection(allow_network=False)
    return {
        "status": "healthy",
        "service": "VYORA AI Media Knowledge Extractor",
        "provider": "Google Gemini",
        "selection_mode": selection_mode,
        "configured_model": selected_model,
        "selected_model": selected_model,
        "display_model": format_model_display_name(selected_model),
        "model": selected_model,
        "has_api_key_configured": has_env_key,
        "active_jobs_count": len(ACTIVE_JOBS),
    }

@app.get("/ready", tags=["Health"])
@app.get("/api/ready", tags=["Health"])
async def readiness_check():
    try:
        with get_db() as db:
            db.execute("SELECT 1").fetchone()
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {str(e)}")

@app.post("/api/verify-key", response_model=VerifyKeyResponse)
async def verify_api_key(req: VerifyKeyRequest):
    if not req.api_key or not req.api_key.strip():
        return VerifyKeyResponse(valid=False, message="API key is empty. Please enter a valid Gemini API key.")
    clean_key = req.api_key.strip()
    try:
        is_valid, msg, model_name = verify_gemini_key_lightweight(clean_key)
        return VerifyKeyResponse(valid=is_valid, message=msg)
    except Exception as e:
        sanitized = sanitize_error_message(e)
        return VerifyKeyResponse(valid=False, message=f"Verification failed: {sanitized}")

# ----------------- Projects API -----------------
@app.get("/api/projects")
async def list_projects(user_id: str = "default_user"):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT p.*, 
               (SELECT COUNT(*) FROM chapters WHERE project_id = p.id) as chapter_count,
               (SELECT COUNT(*) FROM transcript_segments WHERE project_id = p.id) as transcript_count
        FROM projects p
        ORDER BY p.created_at DESC
        """)
        rows = cursor.fetchall()
        projects = []
        for r in rows:
            projects.append({
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "media_type": r["media_type"],
                "filename": r["filename"],
                "source_url": r["source_url"] if "source_url" in r.keys() else None,
                "selected_model": r["selected_model"] if "selected_model" in r.keys() else None,
                "duration_seconds": r["duration_seconds"],
                "duration_formatted": r["duration_formatted"],
                "status": r["status"],
                "chapter_count": r["chapter_count"],
                "transcript_count": r["transcript_count"],
                "created_at": r["created_at"],
            })
        return projects

@app.get("/api/projects/{project_id}")
async def get_project_details(project_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        proj = cursor.fetchone()
        if not proj:
            # Fallback to cached JSON if present
            cached = get_cached_result(project_id)
            if cached:
                return cached.model_dump()
            raise HTTPException(status_code=404, detail="Project not found")

        # Summary
        cursor.execute("SELECT * FROM summaries WHERE project_id = ?", (project_id,))
        summary_row = cursor.fetchone()
        overview = summary_row["overview"] if summary_row else proj["description"] or ""
        executive_summary = summary_row["executive_summary"] if summary_row else ""
        key_takeaways = json.loads(summary_row["key_takeaways"]) if summary_row and summary_row["key_takeaways"] else []
        action_items = json.loads(summary_row["action_items"]) if summary_row and summary_row["action_items"] else []
        sentiment_and_tone = json.loads(summary_row["sentiment_and_tone"]) if summary_row and summary_row["sentiment_and_tone"] else {}

        # Chapters
        cursor.execute("SELECT * FROM chapters WHERE project_id = ? ORDER BY start_time ASC", (project_id,))
        chapters = []
        for c in cursor.fetchall():
            chapters.append({
                "start_time": c["start_time"],
                "start_time_formatted": c["start_time_formatted"],
                "end_time": c["end_time"],
                "end_time_formatted": c["end_time_formatted"],
                "title": c["title"],
                "summary": c["summary"] or "",
                "key_moments": json.loads(c["key_moments"]) if c["key_moments"] else [],
            })

        # Transcript
        cursor.execute("SELECT * FROM transcript_segments WHERE project_id = ? ORDER BY start_time ASC", (project_id,))
        transcript = []
        for t in cursor.fetchall():
            transcript.append({
                "start_time": t["start_time"],
                "start_time_formatted": t["start_time_formatted"],
                "end_time": t["end_time"],
                "end_time_formatted": t["end_time_formatted"],
                "speaker": t["speaker"] or "Speaker",
                "text": t["text"],
            })

        # Visual Scenes
        cursor.execute("SELECT * FROM visual_scenes WHERE project_id = ? ORDER BY start_time ASC", (project_id,))
        visual_scenes = []
        for v in cursor.fetchall():
            visual_scenes.append({
                "start_time": v["start_time"],
                "start_time_formatted": v["start_time_formatted"],
                "end_time": v["end_time"],
                "end_time_formatted": v["end_time_formatted"],
                "description": v["description"],
                "visual_elements": json.loads(v["visual_elements"]) if v["visual_elements"] else [],
                "detected_text": json.loads(v["detected_text"]) if v["detected_text"] else [],
            })

        # Entities
        cursor.execute("SELECT * FROM entities WHERE project_id = ?", (project_id,))
        entities = []
        for e in cursor.fetchall():
            entities.append({
                "name": e["name"],
                "category": e["category"],
                "description": e["description"] or "",
                "mentions_count": e["mentions_count"] or 1,
                "timestamps": json.loads(e["timestamps"]) if e["timestamps"] else [],
            })

        return {
            "file_id": proj["id"],
            "filename": proj["filename"],
            "media_type": proj["media_type"],
            "source_url": proj["source_url"] if "source_url" in proj.keys() else None,
            "selected_model": proj["selected_model"] if "selected_model" in proj.keys() else None,
            "duration_seconds": proj["duration_seconds"],
            "duration_formatted": proj["duration_formatted"],
            "title": proj["title"],
            "overview": overview,
            "executive_summary": executive_summary,
            "key_takeaways": key_takeaways,
            "chapters": chapters,
            "transcript": transcript,
            "visual_scenes": visual_scenes,
            "entities": entities,
            "action_items": action_items,
            "sentiment_and_tone": sentiment_and_tone,
            "created_at": proj["created_at"],
        }

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    return {"success": True, "message": "Project deleted successfully"}

# ----------------- Transcript Search -----------------
@app.get("/api/projects/{project_id}/search")
async def search_transcript(project_id: str, q: str = Query(..., min_length=1)):
    with get_db() as conn:
        cursor = conn.cursor()
        search_pattern = f"%{q}%"
        cursor.execute("""
        SELECT * FROM transcript_segments
        WHERE project_id = ? AND text LIKE ?
        ORDER BY start_time ASC
        LIMIT 50
        """, (project_id, search_pattern))
        results = []
        for r in cursor.fetchall():
            results.append({
                "start_time": r["start_time"],
                "start_time_formatted": r["start_time_formatted"],
                "end_time": r["end_time"],
                "end_time_formatted": r["end_time_formatted"],
                "speaker": r["speaker"],
                "text": r["text"],
            })
        return {"query": q, "count": len(results), "matches": results}

# ----------------- User Notes -----------------
@app.get("/api/projects/{project_id}/notes")
async def get_notes(project_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM notes WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
        return [dict(r) for r in cursor.fetchall()]

@app.post("/api/projects/{project_id}/notes")
async def create_note(project_id: str, req: NoteCreateRequest, user_id: str = "default_user"):
    note_id = str(uuid.uuid4())[:8]
    ts_sec = req.timestamp_seconds or 0.0
    ts_fmt = req.timestamp_formatted or format_seconds(ts_sec)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO notes (id, project_id, user_id, timestamp_seconds, timestamp_formatted, title, content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (note_id, project_id, user_id, ts_sec, ts_fmt, req.title, req.content))
        conn.commit()
    return {"id": note_id, "project_id": project_id, "title": req.title, "content": req.content, "timestamp_formatted": ts_fmt}

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM notes WHERE id = ?", (note_id,))
        conn.commit()
    return {"success": True}

# ----------------- Bookmarks -----------------
@app.get("/api/projects/{project_id}/bookmarks")
async def get_bookmarks(project_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM bookmarks WHERE project_id = ? ORDER BY timestamp_seconds ASC", (project_id,))
        return [dict(r) for r in cursor.fetchall()]

@app.post("/api/projects/{project_id}/bookmarks")
async def create_bookmark(project_id: str, req: BookmarkCreateRequest, user_id: str = "default_user"):
    bm_id = str(uuid.uuid4())[:8]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO bookmarks (id, project_id, user_id, timestamp_seconds, timestamp_formatted, label)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (bm_id, project_id, user_id, req.timestamp_seconds, req.timestamp_formatted, req.label))
        conn.commit()
    return {"id": bm_id, "project_id": project_id, "timestamp_seconds": req.timestamp_seconds, "timestamp_formatted": req.timestamp_formatted, "label": req.label}

@app.delete("/api/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
        conn.commit()
    return {"success": True}

# ----------------- 3D Knowledge Map Graph Endpoint -----------------
@app.get("/api/knowledge-graph")
async def get_knowledge_graph(project_id: Optional[str] = None):
    """
    Constructs a connected 3D graph connecting video projects, chapters, and concepts.
    """
    nodes = []
    links = []

    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT id, title, media_type FROM projects WHERE status = 'COMPLETED'"
        params = ()
        if project_id:
            query += " AND id = ?"
            params = (project_id,)
        cursor.execute(query, params)
        projs = cursor.fetchall()

        for p in projs:
            pid = p["id"]
            nodes.append({
                "id": pid,
                "label": p["title"],
                "type": "video",
                "projectId": pid,
            })

            # Fetch chapters
            cursor.execute("SELECT id, title, start_time_formatted FROM chapters WHERE project_id = ?", (pid,))
            for ch in cursor.fetchall():
                chid = f"ch_{ch['id']}"
                nodes.append({
                    "id": chid,
                    "label": ch["title"],
                    "type": "chapter",
                    "timestamp": ch["start_time_formatted"],
                    "projectId": pid,
                })
                links.append({"source": pid, "target": chid})

            # Fetch entities
            cursor.execute("SELECT id, name, category, timestamps FROM entities WHERE project_id = ? LIMIT 8", (pid,))
            for ent in cursor.fetchall():
                entid = f"ent_{ent['id']}"
                ts = json.loads(ent["timestamps"])[0] if ent["timestamps"] and json.loads(ent["timestamps"]) else None
                nodes.append({
                    "id": entid,
                    "label": ent["name"],
                    "type": "concept",
                    "category": ent["category"],
                    "timestamp": ts,
                    "projectId": pid,
                })
                links.append({"source": pid, "target": entid})

    return {"nodes": nodes, "links": links}

# ----------------- Upload & Background Processing -----------------
@app.post("/api/upload", response_model=MediaMetadata)
async def upload_media(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())[:12]
    orig_name = file.filename or "media_file.mp4"
    suffix = Path(orig_name).suffix.lower()
    if not suffix:
        suffix = ".mp4"

    save_path = UPLOAD_DIR / f"{file_id}{suffix}"

    file_size = 0
    try:
        with open(save_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                file_size += len(chunk)
                if file_size > MAX_MEDIA_FILE_SIZE_BYTES:
                    buffer.close()
                    if save_path.exists():
                        save_path.unlink()
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the maximum allowed size limit of 500MB."
                    )
                buffer.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Validate file integrity and container format signatures
    is_valid, validation_msg = validate_media_file_content(save_path)
    if not is_valid:
        if save_path.exists():
            save_path.unlink()
        raise HTTPException(status_code=400, detail=validation_msg)

    # Inspect media properties (duration, resolution, audio streams)
    info = inspect_media_file(save_path)
    duration_secs = info.get("duration_seconds", 120.0)
    duration_fmt = info.get("duration_formatted", format_seconds(duration_secs))
    media_type = info.get("media_type", "video")

    # Create unanalyzed project record
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO projects (id, user_id, title, description, media_type, filename, file_path, duration_seconds, duration_formatted, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_id,
            "default_user",
            orig_name,
            "Uploaded media awaiting AI knowledge extraction",
            media_type,
            orig_name,
            str(save_path),
            duration_secs,
            duration_fmt,
            "QUEUED"
        ))
        conn.commit()

    return MediaMetadata(
        file_id=file_id,
        filename=orig_name,
        media_type=media_type,
        duration_seconds=duration_secs,
        duration_formatted=duration_fmt,
        file_size_bytes=file_size,
    )

@app.post("/api/ingest/url")
async def ingest_media_url_endpoint(req: IngestUrlRequest):
    """Securely validate and ingest remote video links (YouTube or direct streams) with SSRF defense."""
    return await ingest_remote_media_url(raw_url=req.url, title_hint=req.title)

@app.post("/api/process/start")
async def start_processing(
    req: StartProcessingRequest,
    background_tasks: BackgroundTasks,
    x_gemini_api_key: Optional[str] = Header(None)
):
    key = req.api_key or x_gemini_api_key or get_api_key()
    
    file_id = req.file_id
    if not file_id:
        if req.url:
            ingest_result = await ingest_remote_media_url(raw_url=req.url, title_hint=req.title)
            file_id = ingest_result["file_id"]
        else:
            raise HTTPException(status_code=400, detail="file_id or url is required")

    # Verify that media project exists in database
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (file_id,))
        proj = cursor.fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail=f"Media project '{file_id}' not found.")

    # Prevent duplicate active jobs for the same media file (recovers any stale/abandoned job)
    existing_job = get_active_job_for_project(file_id)
    if existing_job:
        return {
            "job_id": existing_job.get("job_id"),
            "project_id": file_id,
            "stage": existing_job.get("stage"),
            "message": existing_job.get("message", "Processing is actively in-flight for this media.")
        }

    job_id = str(uuid.uuid4())[:10]

    # Record job in database and update project status
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO processing_jobs (job_id, project_id, stage, progress_percent, message)
        VALUES (?, ?, ?, ?, ?)
        """, (job_id, file_id, "QUEUED", 5.0, "Job queued in VYORA background queue..."))
        cursor.execute("UPDATE projects SET status = 'PROCESSING' WHERE id = ?", (file_id,))
        conn.commit()

    import time
    ACTIVE_JOBS[job_id] = {
        "job_id": job_id,
        "project_id": file_id,
        "stage": "QUEUED",
        "progress_percent": 5.0,
        "message": "Job queued in VYORA background queue...",
        "error_message": None,
        "updated_at": time.time(),
    }

    # Dispatch background worker
    media_path = None
    try:
        media_path = get_media_path(file_id)
    except Exception:
        pass

    background_tasks.add_task(
        process_media_background_job,
        job_id=job_id,
        project_id=file_id,
        file_path=media_path,
        api_key=key
    )

    return {"job_id": job_id, "project_id": file_id, "stage": "QUEUED"}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    import time
    if job_id in ACTIVE_JOBS:
        job = ACTIVE_JOBS[job_id]
        # Inactivity timeout guard (5 minutes)
        if job.get("stage") not in ("COMPLETED", "FAILED") and (time.time() - job.get("updated_at", 0) > 300.0):
            update_job_status(
                job_id,
                "FAILED",
                0.0,
                "Processing timed out or stalled. Ready to retry.",
                error="Worker timeout exceeded",
            )
            del ACTIVE_JOBS[job_id]
        else:
            return job

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM processing_jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        job_data = dict(row)
        # If job is in DB as in-flight but not in ACTIVE_JOBS, it was abandoned on server restart
        if job_data.get("stage") not in ("COMPLETED", "FAILED"):
            cursor.execute("""
                UPDATE processing_jobs
                SET stage = 'FAILED',
                    progress_percent = 0.0,
                    message = 'Processing stopped unexpectedly (server restart). Ready to retry.',
                    error_message = 'Job interrupted by server restart. Please retry.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = ?
            """, (job_id,))
            conn.commit()
            job_data["stage"] = "FAILED"
            job_data["message"] = "Processing stopped unexpectedly (server restart). Ready to retry."
            job_data["error_message"] = "Job interrupted by server restart. Please retry."
        return job_data

# ----------------- Media Streaming & Chat -----------------
@app.post("/api/extract/{file_id}", response_model=MediaAnalysisResult)
async def extract_knowledge(
    file_id: str,
    x_gemini_api_key: Optional[str] = Header(None)
):
    result = await extract_media_knowledge(file_id, api_key=x_gemini_api_key)
    return result

@app.get("/api/analysis/{file_id}", response_model=MediaAnalysisResult)
async def get_analysis(file_id: str):
    cached = get_cached_result(file_id)
    if not cached:
        # Check database
        try:
            db_proj = await get_project_details(file_id)
            return MediaAnalysisResult(**db_proj)
        except Exception:
            raise HTTPException(status_code=404, detail="No extracted knowledge found for this media ID.")
    return cached

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_media(
    req: ChatRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    key = req.api_key or x_gemini_api_key
    response = await answer_media_question(
        file_id=req.file_id,
        question=req.message,
        history=req.history,
        api_key=key
    )
    # Save chat messages to DB
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            user_msg_id = str(uuid.uuid4())[:8]
            ai_msg_id = str(uuid.uuid4())[:8]
            cursor.execute("""
            INSERT INTO chat_messages (id, project_id, user_id, role, content, citations)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (user_msg_id, req.file_id, "default_user", "user", req.message, "[]"))

            citations_json = json.dumps([c.model_dump() for c in response.citations])
            cursor.execute("""
            INSERT INTO chat_messages (id, project_id, user_id, role, content, citations)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (ai_msg_id, req.file_id, "default_user", "assistant", response.answer, citations_json))
            conn.commit()
    except Exception:
        pass

    return response

@app.api_route("/api/media/{file_id}", methods=["GET", "HEAD"])
@app.api_route("/api/stream/{file_id}", methods=["GET", "HEAD"])
@app.api_route("/api/media/stream/{file_id}", methods=["GET", "HEAD"])
async def stream_media(file_id: str, request: Request):
    try:
        media_path = get_media_path(file_id)
    except HTTPException as e:
        # If local media not found on disk, check if it's a remote URL/YouTube project
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT source_url FROM projects WHERE id = ?", (file_id,))
            row = cursor.fetchone()
            if row and row["source_url"]:
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=row["source_url"], status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        raise e

    range_header = request.headers.get("range")
    
    stream_generator, start, end, file_size, content_type = range_stream(media_path, range_header)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str((end - start) + 1),
        "Content-Type": content_type,
    }

    if request.method == "HEAD":
        return Response(status_code=status.HTTP_200_OK, headers=headers, media_type=content_type)

    status_code = status.HTTP_206_PARTIAL_CONTENT if range_header else status.HTTP_200_OK

    iterator = stream_generator() if callable(stream_generator) else stream_generator

    return StreamingResponse(
        iterator,
        status_code=status_code,
        headers=headers,
        media_type=content_type
    )

@app.get("/api/samples")
async def list_sample_media():
    samples = []
    for f in SAMPLES_DIR.iterdir():
        if f.suffix.lower() in ['.mp4', '.webm', '.mov', '.mp3', '.wav']:
            samples.append({
                "id": f.stem,
                "name": f.name,
                "type": "video" if get_media_mime_type(f).startswith("video/") else "audio",
                "size": f.stat().st_size
            })
    return samples

# Optional unified SPA static assets serving
dist_dir = BASE_DIR.parent / "dist"
if not dist_dir.exists():
    dist_dir = BASE_DIR / "dist"

if dist_dir.exists() and (dist_dir / "index.html").exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        requested = dist_dir / full_path
        if requested.exists() and requested.is_file():
            return FileResponse(requested)
        return FileResponse(dist_dir / "index.html")
else:
    @app.get("/", tags=["Health"])
    async def root():
        return {
            "service": "VYORA AI Backend",
            "status": "healthy",
            "version": "2.0.0",
            "docs": "/docs",
            "health": "/api/health",
            "ready": "/api/ready"
        }

