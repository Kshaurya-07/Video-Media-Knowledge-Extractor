import asyncio
import json
import uuid
import time
from pathlib import Path
from typing import Optional, Dict, Any
from app.database import get_db
from app.config import UPLOAD_DIR, BASE_DIR
from app.services.gemini_extractor import (
    extract_media_knowledge,
    get_cached_result,
    sanitize_error_message,
)
from app.services.model_discovery_service import (
    get_active_model_selection,
    format_model_display_name,
)
from app.services.media_service import format_seconds, get_media_mime_type
from app.services.diagnostic_logger import log_diagnostic

# In-memory job tracker for immediate reactivity
ACTIVE_JOBS: Dict[str, Dict[str, Any]] = {}

# Stale job timeout in seconds (15 minutes for long video inference)
JOB_INACTIVITY_TIMEOUT_SECONDS = 900.0

def recover_all_stale_jobs() -> int:
    """
    On startup or health recovery, mark any in-flight jobs in the database
    that are not actively held in ACTIVE_JOBS as FAILED so they never block users.
    """
    active_ids = list(ACTIVE_JOBS.keys())
    with get_db() as conn:
        cursor = conn.cursor()
        if active_ids:
            placeholders = ",".join("?" for _ in active_ids)
            cursor.execute(f"""
                UPDATE processing_jobs
                SET stage = 'FAILED',
                    progress_percent = 0.0,
                    message = 'Processing was interrupted by a service restart. Ready to retry.',
                    error_message = 'Service restarted while job was in-flight.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE stage NOT IN ('COMPLETED', 'FAILED')
                  AND job_id NOT IN ({placeholders})
            """, active_ids)
        else:
            cursor.execute("""
                UPDATE processing_jobs
                SET stage = 'FAILED',
                    progress_percent = 0.0,
                    message = 'Processing was interrupted by a service restart. Ready to retry.',
                    error_message = 'Service restarted while job was in-flight.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE stage NOT IN ('COMPLETED', 'FAILED')
            """)
        count = cursor.rowcount
        conn.commit()
        return count

def get_active_job_for_project(project_id: str) -> Optional[Dict[str, Any]]:
    """
    Check in-memory and database for an actively running processing job.
    Accurately detects abandoned or stale jobs (e.g. from service restarts)
    and transitions them to FAILED so a fresh attempt is never blocked.
    """
    now = time.time()
    stale_in_memory = []

    # 1. Inspect in-memory active jobs
    for jid, job in ACTIVE_JOBS.items():
        if job.get("project_id") == project_id and job.get("stage") not in ("COMPLETED", "FAILED"):
            last_update = job.get("updated_at", 0)
            if (now - last_update) > JOB_INACTIVITY_TIMEOUT_SECONDS:
                stale_in_memory.append(jid)
            else:
                # Genuinely active job running in current process
                return job

    # Clean up any stalled in-memory jobs
    for jid in stale_in_memory:
        update_job_status(
            jid,
            "FAILED",
            0.0,
            "Processing stalled or timed out after 5 minutes of inactivity. Ready to retry.",
            error="Worker inactivity timeout",
            project_id=project_id,
        )
        if jid in ACTIVE_JOBS:
            del ACTIVE_JOBS[jid]

    # 2. Inspect database for unfinalized jobs from prior runs
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM processing_jobs 
            WHERE project_id = ? AND stage NOT IN ('COMPLETED', 'FAILED')
            ORDER BY created_at DESC LIMIT 1
            """,
            (project_id,)
        )
        row = cursor.fetchone()
        if row:
            # Job is in DB but NOT running in current process memory: it was abandoned by a restart
            stale_id = row["job_id"]
            cursor.execute("""
                UPDATE processing_jobs
                SET stage = 'FAILED',
                    progress_percent = 0.0,
                    message = 'Previous processing attempt was interrupted (server restart). Ready to retry.',
                    error_message = 'Job was interrupted before completion. You can restart processing.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = ?
            """, (stale_id,))
            conn.commit()
            # Return None so start_processing can immediately initiate a fresh job
            return None

    return None

def update_job_status(
    job_id: str,
    stage: str,
    progress: float,
    message: str,
    error: Optional[str] = None,
    project_id: Optional[str] = None,
    selected_model: Optional[str] = None,
    model_selection_mode: Optional[str] = None,
    fallback_history: Optional[str] = None,
    correlation_id: Optional[str] = None,
):
    current = ACTIVE_JOBS.get(job_id, {})
    model = selected_model or current.get("selected_model")
    mode = model_selection_mode or current.get("model_selection_mode", "automatic")
    fb_hist = fallback_history or current.get("fallback_history")
    corr_id = correlation_id or current.get("correlation_id", job_id[:8])

    ACTIVE_JOBS[job_id] = {
        "job_id": job_id,
        "correlation_id": corr_id,
        "project_id": project_id or current.get("project_id"),
        "stage": stage,
        "progress_percent": progress,
        "message": message,
        "error_message": error,
        "selected_model": model,
        "model_selection_mode": mode,
        "fallback_history": fb_hist,
        "updated_at": time.time(),
    }
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE processing_jobs
        SET stage = ?, progress_percent = ?, message = ?, error_message = ?,
            selected_model = ?, model_selection_mode = ?, fallback_history = ?,
            correlation_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
        """, (stage, progress, message, error, model, mode, fb_hist, corr_id, job_id))
        conn.commit()

async def process_media_background_job(
    job_id: str,
    project_id: str,
    file_path: Path,
    api_key: Optional[str] = None,
    correlation_id: Optional[str] = None,
):
    job_start_time = time.time()
    corr_id = correlation_id or str(uuid.uuid4())[:8]
    resolved_model = None

    try:
        # Pre-resolve model for this job to lock it in and display it in progress status
        resolved_model, selection_mode, _ = get_active_model_selection(api_key=api_key)
        disp_name = format_model_display_name(resolved_model)

        def on_stage(stage: str, progress: float, message: str):
            update_job_status(
                job_id,
                stage,
                progress,
                message,
                project_id=project_id,
                selected_model=resolved_model,
                model_selection_mode=selection_mode,
                correlation_id=corr_id,
            )

        # Initial stages
        on_stage("UPLOADING", 10.0, f"Initializing pipeline with {disp_name} ({selection_mode})...")
        on_stage("VALIDATING", 20.0, "Verifying media container integrity and decoding temporal streams...")

        # Run multimodal extraction with Gemini (or cached/demo data)
        try:
            analysis = await extract_media_knowledge(
                project_id,
                api_key=api_key,
                on_stage=on_stage,
                selected_model_override=resolved_model,
                job_id=job_id,
                correlation_id=corr_id,
            )
        except Exception as e:
            # Only allow demo cache for the pre-seeded demo presentation; real user projects fail truthfully
            if project_id == "demo_presentation":
                cached = get_cached_result(project_id)
                if cached:
                    analysis = cached
                else:
                    raise e
            else:
                raise e

        # If a fallback happened during extraction, update resolved_model to match analysis.selected_model
        final_model = getattr(analysis, "selected_model", None) or resolved_model
        final_mode = getattr(analysis, "model_selection_mode", None) or selection_mode

        # Saving structured intelligence
        on_stage("SAVING_RESULTS", 95.0, f"Persisting structured knowledge (analyzed with {format_model_display_name(final_model)})...")
        log_diagnostic(
            event="RESULTS_SAVED",
            job_id=job_id,
            correlation_id=corr_id,
            stage="SAVING_RESULTS",
            elapsed_seconds=time.time() - job_start_time,
            status="INFO",
            model_id=final_model,
            file_id=project_id,
        )
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Update project info
            cursor.execute("""
            UPDATE projects
            SET title = ?, description = ?, duration_seconds = ?, duration_formatted = ?, status = 'COMPLETED', selected_model = ?
            WHERE id = ?
            """, (
                analysis.title,
                analysis.overview,
                analysis.duration_seconds,
                analysis.duration_formatted,
                final_model,
                project_id
            ))

            # Save summary
            cursor.execute("""
            INSERT OR REPLACE INTO summaries (project_id, overview, executive_summary, key_takeaways, action_items, sentiment_and_tone)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                project_id,
                analysis.overview,
                analysis.executive_summary,
                json.dumps(analysis.key_takeaways),
                json.dumps([a.model_dump() for a in analysis.action_items]),
                json.dumps(analysis.sentiment_and_tone)
            ))

            # Clear previous entries if re-processing
            cursor.execute("DELETE FROM chapters WHERE project_id = ?", (project_id,))
            cursor.execute("DELETE FROM transcript_segments WHERE project_id = ?", (project_id,))
            cursor.execute("DELETE FROM visual_scenes WHERE project_id = ?", (project_id,))
            cursor.execute("DELETE FROM entities WHERE project_id = ?", (project_id,))

            # Insert chapters
            for ch in analysis.chapters:
                cursor.execute("""
                INSERT INTO chapters (project_id, start_time, start_time_formatted, end_time, end_time_formatted, title, summary, key_moments)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    project_id,
                    ch.start_time,
                    ch.start_time_formatted,
                    ch.end_time,
                    ch.end_time_formatted,
                    ch.title,
                    ch.summary,
                    json.dumps(ch.key_moments)
                ))

            # Insert transcript
            for tr in analysis.transcript:
                cursor.execute("""
                INSERT INTO transcript_segments (project_id, start_time, start_time_formatted, end_time, end_time_formatted, speaker, text)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    project_id,
                    tr.start_time,
                    tr.start_time_formatted,
                    tr.end_time,
                    tr.end_time_formatted,
                    tr.speaker,
                    tr.text
                ))

            # Insert visual scenes
            for vs in analysis.visual_scenes:
                cursor.execute("""
                INSERT INTO visual_scenes (project_id, start_time, start_time_formatted, end_time, end_time_formatted, description, visual_elements, detected_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    project_id,
                    vs.start_time,
                    vs.start_time_formatted,
                    vs.end_time,
                    vs.end_time_formatted,
                    vs.description,
                    json.dumps(vs.visual_elements),
                    json.dumps(vs.detected_text)
                ))

            # Insert entities
            for ent in analysis.entities:
                cursor.execute("""
                INSERT INTO entities (project_id, name, category, description, mentions_count, timestamps)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    project_id,
                    ent.name,
                    ent.category,
                    ent.description,
                    ent.mentions_count,
                    json.dumps(ent.timestamps)
                ))

            conn.commit()

        update_job_status(
            job_id,
            "COMPLETED",
            100.0,
            f"Knowledge extraction complete! Analyzed with {format_model_display_name(final_model)}.",
            project_id=project_id,
            selected_model=final_model,
            model_selection_mode=final_mode,
            correlation_id=corr_id,
        )
        log_diagnostic(
            event="JOB_COMPLETED",
            job_id=job_id,
            correlation_id=corr_id,
            stage="COMPLETED",
            elapsed_seconds=time.time() - job_start_time,
            status="SUCCESS",
            model_id=final_model,
            file_id=project_id,
        )

    except Exception as exc:
        sanitized_err = sanitize_error_message(exc)
        update_job_status(
            job_id,
            "FAILED",
            0.0,
            f"Processing failed: {sanitized_err}",
            error=sanitized_err,
            project_id=project_id,
            correlation_id=corr_id,
        )
        log_diagnostic(
            event="JOB_FAILED",
            job_id=job_id,
            correlation_id=corr_id,
            stage="FAILED",
            elapsed_seconds=time.time() - job_start_time,
            status="ERROR",
            error_class=exc.__class__.__name__,
            error_message=sanitized_err,
            model_id=resolved_model,
            file_id=project_id,
        )
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE projects SET status = 'FAILED' WHERE id = ?", (project_id,))
            conn.commit()

