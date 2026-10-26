import sqlite3
import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from app.config import BASE_DIR

DB_PATH = BASE_DIR / "vyora.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Projects Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            media_type TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0,
            duration_formatted TEXT DEFAULT '00:00',
            status TEXT DEFAULT 'COMPLETED', -- 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        # 2. Processing Jobs Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS processing_jobs (
            job_id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            stage TEXT NOT NULL, -- 'QUEUED', 'UPLOADING', 'EXTRACTING_AUDIO', 'TRANSCRIBING', 'IDENTIFYING_CHAPTERS', 'INDEXING', 'FINALIZING', 'COMPLETED', 'FAILED'
            progress_percent REAL DEFAULT 0,
            message TEXT,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 3. Chapters Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            start_time REAL NOT NULL,
            start_time_formatted TEXT NOT NULL,
            end_time REAL NOT NULL,
            end_time_formatted TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            key_moments TEXT, -- JSON string
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 4. Transcript Segments Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS transcript_segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            start_time REAL NOT NULL,
            start_time_formatted TEXT NOT NULL,
            end_time REAL NOT NULL,
            end_time_formatted TEXT NOT NULL,
            speaker TEXT,
            text TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 5. Visual Scenes Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS visual_scenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            start_time REAL NOT NULL,
            start_time_formatted TEXT NOT NULL,
            end_time REAL NOT NULL,
            end_time_formatted TEXT NOT NULL,
            description TEXT NOT NULL,
            visual_elements TEXT, -- JSON string
            detected_text TEXT, -- JSON string
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 6. Entities Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            mentions_count INTEGER DEFAULT 1,
            timestamps TEXT, -- JSON string
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 7. Summaries Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS summaries (
            project_id TEXT PRIMARY KEY,
            overview TEXT NOT NULL,
            executive_summary TEXT NOT NULL,
            key_takeaways TEXT, -- JSON string
            action_items TEXT, -- JSON string
            sentiment_and_tone TEXT, -- JSON string
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 8. User Notes Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            timestamp_seconds REAL,
            timestamp_formatted TEXT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 9. Bookmarks Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            timestamp_seconds REAL NOT NULL,
            timestamp_formatted TEXT NOT NULL,
            label TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # 10. Chat Messages Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            citations TEXT, -- JSON string
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_transcripts_pid ON transcript_segments(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chapters_pid ON chapters(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_notes_pid ON notes(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bookmarks_pid ON bookmarks(project_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_pid ON chat_messages(project_id)")
        
        conn.commit()

# Seed default demo project into DB if empty
def seed_demo_project_if_needed():
    cache_path = BASE_DIR / "data_cache" / "demo_presentation.json"
    if not cache_path.exists():
        return

    with open(cache_path, "r", encoding="utf-8") as f:
        demo = json.load(f)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM projects WHERE id = ?", (demo["file_id"],))
        if cursor.fetchone():
            return  # Already seeded

        # Insert project
        cursor.execute("""
        INSERT INTO projects (id, user_id, title, description, media_type, filename, file_path, duration_seconds, duration_formatted, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            demo["file_id"],
            "default_user",
            demo["title"],
            demo["overview"],
            demo["media_type"],
            demo["filename"],
            str(BASE_DIR / "samples" / demo["filename"]),
            demo["duration_seconds"],
            demo["duration_formatted"],
            "COMPLETED"
        ))

        # Insert summary
        cursor.execute("""
        INSERT INTO summaries (project_id, overview, executive_summary, key_takeaways, action_items, sentiment_and_tone)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            demo["file_id"],
            demo["overview"],
            demo["executive_summary"],
            json.dumps(demo["key_takeaways"]),
            json.dumps(demo.get("action_items", [])),
            json.dumps(demo.get("sentiment_and_tone", {}))
        ))

        # Insert chapters
        for ch in demo["chapters"]:
            cursor.execute("""
            INSERT INTO chapters (project_id, start_time, start_time_formatted, end_time, end_time_formatted, title, summary, key_moments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                demo["file_id"],
                ch["start_time"],
                ch["start_time_formatted"],
                ch["end_time"],
                ch["end_time_formatted"],
                ch["title"],
                ch["summary"],
                json.dumps(ch.get("key_moments", []))
            ))

        # Insert transcript
        for tr in demo["transcript"]:
            cursor.execute("""
            INSERT INTO transcript_segments (project_id, start_time, start_time_formatted, end_time, end_time_formatted, speaker, text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                demo["file_id"],
                tr["start_time"],
                tr["start_time_formatted"],
                tr["end_time"],
                tr["end_time_formatted"],
                tr.get("speaker", "Speaker"),
                tr["text"]
            ))

        # Insert visual scenes
        for vs in demo.get("visual_scenes", []):
            cursor.execute("""
            INSERT INTO visual_scenes (project_id, start_time, start_time_formatted, end_time, end_time_formatted, description, visual_elements, detected_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                demo["file_id"],
                vs["start_time"],
                vs["start_time_formatted"],
                vs["end_time"],
                vs["end_time_formatted"],
                vs["description"],
                json.dumps(vs.get("visual_elements", [])),
                json.dumps(vs.get("detected_text", []))
            ))

        # Insert entities
        for ent in demo.get("entities", []):
            cursor.execute("""
            INSERT INTO entities (project_id, name, category, description, mentions_count, timestamps)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                demo["file_id"],
                ent["name"],
                ent["category"],
                ent["description"],
                ent.get("mentions_count", 1),
                json.dumps(ent.get("timestamps", []))
            ))

        # Seed sample note and bookmark
        cursor.execute("""
        INSERT INTO notes (id, project_id, user_id, timestamp_seconds, timestamp_formatted, title, content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "note_1",
            demo["file_id"],
            "default_user",
            25.0,
            "00:25",
            "Pydantic Validation Architecture",
            "Using strict Pydantic schemas reduces extraction errors to zero and standardizes downstream consumption."
        ))

        cursor.execute("""
        INSERT INTO bookmarks (id, project_id, user_id, timestamp_seconds, timestamp_formatted, label)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "bm_1",
            demo["file_id"],
            "default_user",
            12.0,
            "00:12",
            "Benchmark: 4x Latency Drop"
        ))

        conn.commit()
