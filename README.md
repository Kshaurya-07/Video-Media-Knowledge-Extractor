# VYORA AI — Video and Media Knowledge Extractor

Turns long video and audio content into structured, searchable knowledge, with chapters, transcripts, and timestamped question answering.

Repository: Video-Media-Knowledge-Extractor

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

## Overview

VYORA AI is a full-stack platform for analysing video and audio. Instead of treating video only as audio to transcribe, it combines visual scene analysis, audio transcripts, on-screen text, speaker sentiment, and structured entities into chapters, summaries, and a question-and-answer interface.

It is powered by Google Gemini, FastAPI, Three.js, and React, with a dual-engine media player, a 3D timeline view, and source-grounded Q&A with clickable timestamp references.

## Features

### Video and speech analysis

- Ingests MP4, WebM, MOV, AVI, MP3, WAV, and remote video streams
- Visual analysis, including slide changes, presentations, on-screen code and diagrams, and OCR text
- Chapter segmentation with start and end timestamps and takeaways
- Named entity extraction for people, technologies, and organisations, and action-item extraction with urgency flags

### Media playback and timestamps

- Local media playback with HTTP range streaming (`206 Partial Content`)
- Remote YouTube playback through the YouTube IFrame player, synchronised bidirectionally via `postMessage`
- Clickable `[MM:SS]` timestamp references that seek to the relevant moment in the video

### Question answering

- A question-and-answer interface grounded in the video's transcripts, visual descriptions, and OCR content
- Answers include timestamp citations, so claims can be checked against the source material

### 3D interface

Four Three.js visualisers support the workspace and library views:

| Component | Role |
| --- | --- |
| VyoraIntelligenceOrbit | Icosahedron core with gimbal rings and a starfield particle swarm |
| SpatialTimeline3D | Curved 3D timeline with chapter nodes, hover tooltips, and click-to-seek |
| ProcessingCore3D | Visualiser that changes with each pipeline extraction stage |
| KnowledgeMap3D | Radial topology linking projects to chapter and concept nodes |

### Model handling

- Dynamic model discovery from the Google API, listing the models accessible to the configured API key
- The preferred model is configurable with `GEMINI_MODEL` and defaults to `gemini-3.8-flash`; if it is unavailable, the service falls back automatically to other available Gemini models, including `gemini-2.0-flash` and `gemini-1.5-flash`
- Retry handling with exponential backoff for rate limits (HTTP 429) and upstream disruptions (HTTP 503)
- A model-discovery cache with a configurable TTL and manual invalidation

### Background pipeline

- Asynchronous processing, decoupled from HTTP request timeouts
- Job stages: `QUEUED`, `UPLOADING`, `EXTRACTING_AUDIO`, `TRANSCRIBING`, `IDENTIFYING_CHAPTERS`, `FINALIZING`, and `COMPLETED`
- SQLite-backed job persistence, designed to survive server restarts

## System Architecture

The system has four main parts:

- **Frontend:** React with Vite and Three.js visualisations, including landing, dashboard, import, workspace, and library views
- **Backend:** FastAPI with REST endpoints, SSRF validation, a background job engine, range streaming, and model discovery
- **Storage:** SQLite for projects, jobs, notes, and bookmarks, plus a local disk cache for uploads
- **Google GenAI:** Gemini models and the Gemini Files API for multimodal analysis

## Project Structure

```text
VYORA-AI/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   │   └── schemas.py
│   │   └── services/
│   │       ├── gemini_extractor.py
│   │       ├── model_discovery_service.py
│   │       ├── url_ingestion_service.py
│   │       ├── qa_service.py
│   │       ├── media_service.py
│   │       └── pipeline_service.py
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   ├── samples/
│   ├── tests/
│   ├── requirements.txt
│   ├── run.py
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/
│   │   │   ├── pages/
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   ├── ExportModal.tsx
│   │   │   └── ModelStatusModal.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── ENVIRONMENT_VARIABLES.md
├── DEPLOYMENT.md
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10 or higher (Python 3.12 verified)
- Node.js 18 or higher, and npm
- A Google Gemini API key

### Backend setup

```bash
git clone https://github.com/Kshaurya-07/Video-Media-Knowledge-Extractor.git Vyora-AI
cd Vyora-AI/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

On Windows PowerShell, activate the virtual environment with `.\.venv\Scripts\Activate.ps1` instead of the `source` command above.

Edit `.env` and add your `GEMINI_API_KEY` before starting the server.

Once the backend is running, interactive API documentation is available at http://127.0.0.1:8000/docs.

### Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

For full specifications, see `ENVIRONMENT_VARIABLES.md` in the repository.

### Backend

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes | — | Google Gemini API key for extraction and Q&A |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Preferred Gemini model, with automatic fallback if unavailable |
| `MODEL_CACHE_TTL_SECONDS` | No | `3600` | Model discovery cache TTL in seconds |
| `PORT` | No | `8000` | Local HTTP port for the backend server |

### Frontend

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | No | `http://localhost:8000` | Base URL of the backend API service |

## API Reference

### System and diagnostics

- `GET /health` or `GET /api/health` — Backend status, database connection, and uptime
- `GET /ready` or `GET /api/ready` — Readiness check, including disk storage and environment readiness
- `GET /api/system/model-status` — Active model, discovery roster, and key health status
- `GET /api/system/gemini-live-check` — Dry-run check against the Google GenAI API
- `POST /api/system/model-cache/refresh` — Refresh the model discovery cache
- `POST /api/verify-key` — Validate an API key provided in the request body

### Ingestion and jobs

- `POST /api/upload` — Upload a local video or audio file, with validation and duration inspection
- `POST /api/ingest/url` — Ingest a public YouTube URL or direct video stream, with SSRF validation
- `POST /api/process/start` — Start an asynchronous extraction job
- `GET /api/jobs/{job_id}` — Poll job status, stage, progress, and diagnostic messages

### Knowledge and analytics

- `GET /api/projects` — List media projects
- `GET /api/projects/{project_id}` — Retrieve a project's metadata, chapters, OCR, and analysis
- `DELETE /api/projects/{project_id}` — Delete a project and its local files
- `GET /api/projects/{project_id}/search` — Search transcripts, OCR, and chapters
- `POST /api/chat` — Question answering against a processed project
- `GET /api/knowledge-graph` — Knowledge map connecting projects and tags

### Streaming, notes, and bookmarks

- `GET /api/media/{file_id}` — Stream video or audio with HTTP range support
- `GET /api/projects/{id}/notes` and `POST /api/projects/{id}/notes` — Timestamped notes
- `GET /api/projects/{id}/bookmarks` and `POST /api/projects/{id}/bookmarks` — Timestamped bookmarks

## Testing

The backend test suite comprises 35 tests across 9 modules, covering API endpoints, Gemini uploads, model discovery, URL ingestion, failure recovery, end-to-end pipeline behaviour, media formats, schema compatibility, and JSON repair. These counts are as documented in the repository and were not independently re-run for this rewrite.

| Test module | Coverage |
| --- | --- |
| `test_api_endpoints.py` | Health probes, project CRUD, notes, bookmarks, and upload validation |
| `test_gemini_upload.py` | Gemini file uploads, timeout handling, and model fallback |
| `test_model_discovery.py` | Model rating, discovery logic, and TTL cache invalidation |
| `test_url_ingestion.py` | YouTube URL parsing, parameter scrubbing, and SSRF loopback rejection |
| `test_failure_recovery_scenarios.py` | Recovery from corrupt files, 503 errors, and interrupted jobs |
| `test_e2e_video_pipeline.py` | End-to-end ingestion, background processing, and output schemas |
| `test_media_formats.py` | MIME detection, magic-byte validation, and range streaming |
| `test_schema_compatibility.py` | Pydantic serialisation, migration integrity, and backward compatibility |
| `test_json_repair.py` | Resilience to truncated or malformed JSON from model responses |

```bash
python -m pytest backend/tests -v
npm --prefix frontend run build
```

## Security

1. The Gemini API key is kept server-side and is not injected into client bundles.
2. Remote URLs undergo DNS pre-flight checks, blocking loopback addresses (`127.0.0.1`, `::1`), private subnets, and cloud metadata endpoints (`169.254.169.254`).
3. Remote downloads enforce a 500 MB streaming limit.
4. Uploaded media is checked by MIME type and file headers.

## Contributing

Issues, suggestions, and pull requests are welcome. Please keep API keys and other secrets out of pull requests and test fixtures.

## License

This project is licensed under the MIT License. See the LICENSE file in the repository for details.

## Author

Kumar Shaurya — https://github.com/Kshaurya-07
