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

VYORA AI is a full-stack platform for analysing video and audio. Instead of treating video only as audio to transcribe, it is designed to combine visual scene analysis, audio transcripts, on-screen text, and structured entities into chapters, summaries, and a question-and-answer interface.

The original README describes the platform as powered by Google Gemini, FastAPI, Three.js, and React, with a dual-engine media player, a 3D timeline view, and source-grounded Q&A with clickable timestamp references.

## Features

### Video and speech analysis

- Ingests MP4, WebM, MOV, AVI, MP3, WAV, and remote video streams, as described in the original README
- Visual analysis, including slide changes, presentations, on-screen code and diagrams, and OCR text
- Chapter segmentation with start and end timestamps and takeaways
- Named entity and action-item extraction, as described in the original README

### Media playback and timestamps

- Local media playback with HTTP range streaming
- Remote YouTube playback through the YouTube IFrame player, as described in the original README
- Clickable timestamp references intended to seek to the relevant moment in the video

### Question answering

- A question-and-answer interface grounded in the video's transcripts, visual descriptions, and OCR content
- Answers are intended to include timestamp citations, so claims can be checked against the source material

### Model handling

- The original README describes dynamic model discovery from the Google API, with a preferred model and automatic fallback to other Gemini models if the preferred model is unavailable
- Retry handling for rate limits and upstream disruptions, and a model-discovery cache with manual invalidation, as described in the original README

### Background pipeline

- Asynchronous processing, decoupled from HTTP request timeouts
- Job stages described in the original README: queued, uploading, extracting audio, transcribing, identifying chapters, finalizing, and completed
- SQLite-backed job persistence, intended to survive server restarts

## System Architecture

The system described in the original README has four main parts:

- **Frontend:** React with Vite and Three.js visualisations, including landing, dashboard, workspace, and library views
- **Backend:** FastAPI with REST endpoints, SSRF validation, a background job engine, range streaming, and model discovery
- **Storage:** SQLite for projects, jobs, notes, and bookmarks, plus a local disk cache for uploads
- **Google GenAI:** Gemini models and the Gemini Files API for multimodal analysis

## Project Structure

The structure below is a condensed summary of the layout described in the original README.

```text
VYORA-AI/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   └── services/
│   ├── migrations/
│   ├── samples/
│   ├── tests/
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
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

- Python 3.10 or higher (Python 3.12 verified, as stated in the original README)
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

Once the backend is running, interactive API documentation is available at http://127.0.0.1:8000/docs, as described in the original README.

### Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser, as described in the original README.

## Environment Variables

For full specifications, see `ENVIRONMENT_VARIABLES.md` in the repository.

### Backend

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for extraction and Q&A |
| `GEMINI_MODEL` | No | Preferred Gemini model, with automatic fallback as described in the original README |
| `MODEL_CACHE_TTL_SECONDS` | No | Model discovery cache TTL in seconds |
| `PORT` | No | Local HTTP port for the backend server |

### Frontend

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | No | Base URL of the backend API service |

## API Reference

### System and diagnostics

- `GET /health` or `GET /api/health` — Backend status and database connection
- `GET /ready` or `GET /api/ready` — Readiness check
- `GET /api/system/model-status` — Active model and discovery status
- `GET /api/system/gemini-live-check` — Dry-run check against the Google GenAI API
- `POST /api/system/model-cache/refresh` — Refresh the model discovery cache
- `POST /api/verify-key` — Validate an API key

### Ingestion and jobs

- `POST /api/upload` — Upload a local video or audio file
- `POST /api/ingest/url` — Ingest a public YouTube URL or direct video stream, with SSRF validation
- `POST /api/process/start` — Start an extraction job
- `GET /api/jobs/{job_id}` — Poll job status and stage

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

The original README describes a backend test suite of 35 tests across 9 modules, covering API endpoints, Gemini uploads, model discovery, URL ingestion, failure recovery, end-to-end pipeline behaviour, media formats, schema compatibility, and JSON repair. Those counts are as described in the original README and were not independently re-run for this rewrite.

```bash
python -m pytest backend/tests -v
npm --prefix frontend run build
```

## Security

Security measures described in the original README include:

1. The Gemini API key is kept server-side and is not injected into client bundles.
2. Remote URLs undergo DNS pre-flight checks, blocking loopback addresses, private subnets, and cloud metadata endpoints.
3. Remote downloads enforce a 500 MB streaming limit, as described in the original README.
4. Uploaded media is checked by MIME type and file headers.

## Contributing

Issues, suggestions, and pull requests are welcome. Please keep API keys and other secrets out of pull requests and test fixtures.

## License

This project is licensed under the MIT License. See the LICENSE file in the repository for details.

## Author

Kumar Shaurya — https://github.com/Kshaurya-07
