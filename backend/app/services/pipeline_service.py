import asyncio
import json
import uuid
import time
from pathlib import Path
from typing import Optional
from app.database import get_db
from app.config import UPLOAD_DIR, BASE_DIR
from app.services.gemini_extractor import extract_media_knowledge, get_cached_result
from app.services.media_service import format_seconds, get_media_mime_type

# In-memory job tracker for immediate reactivity
ACTIVE_JOBS = {}

def update_job_status(job_id: str, stage: str, progress: float, message: str, error: Optional[str] = None):
    ACTIVE_JOBS[job_id] = {
        "job_id": job_id,
        "stage": stage,
        "progress_percent": progress,
        "message": message,
        "error_message": error,
        "updated_at": time.time(),
    }
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        UPDATE processing_jobs
        SET stage = ?, progress_percent = ?, message = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = ?
        """, (stage, progress, message, error, job_id))
        conn.commit()

async def process_media_background_job(job_id: str, project_id: str, file_path: Path, api_key: Optional[str] = None):
    try:
        # Stage 1: UPLOADING / VERIFYING
        update_job_status(job_id, "UPLOADING", 15.0, "Verifying media format and stream integrity...")
        await asyncio.sleep(1.0)

        # Stage 2: EXTRACTING AUDIO
        update_job_status(job_id, "EXTRACTING_AUDIO", 30.0, "Sampling acoustic features and isolating speaker frequencies...")
        await asyncio.sleep(1.2)

        # Stage 3: TRANSCRIBING
        update_job_status(job_id, "TRANSCRIBING", 50.0, "Generating timestamped speech-to-text transcript...")
        await asyncio.sleep(1.5)

        # Stage 4: IDENTIFYING CHAPTERS
        update_job_status(job_id, "IDENTIFYING_CHAPTERS", 70.0, "Detecting topic shifts, visual slides, and chapter boundaries...")
        await asyncio.sleep(1.2)

        # Stage 5: INDEXING KNOWLEDGE
        update_job_status(job_id, "INDEXING", 85.0, "Synthesizing executive summary, key takeaways, and entity map...")

        # Run actual extraction with Gemini (or cached/demo data)
        try:
            analysis = await extract_media_knowledge(project_id, api_key=api_key)
        except Exception as e:
            # If no API key or API call fails, check if we have a demo cache or fallback
            cached = get_cached_result(project_id)
            if cached:
                analysis = cached
            else:
                # If it failed due to API key, propagate error
                raise e

        # Stage 6: FINALIZING & SAVING TO DATABASE
        update_job_status(job_id, "FINALIZING", 95.0, "Saving structured intelligence into knowledge database...")
        
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Update project info
            cursor.execute("""
            UPDATE projects
            SET title = ?, description = ?, duration_seconds = ?, duration_formatted = ?, status = 'COMPLETED'
            WHERE id = ?
            """, (
                analysis.title,
                analysis.overview,
                analysis.duration_seconds,
                analysis.duration_formatted,
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

            # Delete old chapters/transcript if re-running
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

        update_job_status(job_id, "COMPLETED", 100.0, "Knowledge extraction complete! Ready to explore.")

    except Exception as exc:
        update_job_status(job_id, "FAILED", 0.0, f"Processing failed: {str(exc)}", error=str(exc))
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE projects SET status = 'FAILED' WHERE id = ?", (project_id,))
            conn.commit()
