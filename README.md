# VYORA AI — Video & Media Knowledge Extractor ⚡

> **Tagline:** *Every Video Holds a Universe of Knowledge.*

An immersive, full-stack multimodal video knowledge extraction and intelligence platform powered by **Google Gemini 3.8 Flash**, **FastAPI**, **Three.js**, and **React (Vite + Tailwind CSS)**.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19+-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r183+-black?logo=three.js&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)
[![Tests](https://img.shields.io/badge/Pytest-35%20Passed-brightgreen)](https://docs.pytest.org)

---

## ⚡ Core Capabilities

- **Multimodal Video & Speech Extraction**: Ingests video frames, audio tracks, and on-screen text (OCR) via Google's official Gen AI SDK.
- **Dynamic Model Discovery & Automatic Selection**: Discovers models available to your Google API key, filters compatible multimodal engines, and locks to `gemini-3.8-flash` with automatic fallback to `gemini-2.0-flash` or `gemini-1.5-flash`.
- **SSRF-Protected Remote Video Ingestion**: Supports direct video streams and public YouTube links with DNS pre-flight verification, loopback/private IP rejection, and 500 MB download caps.
- **Dual-Engine Media Player**: Synchronizes timestamps and seeking seamlessly across local files (HTML5 video/audio) and remote YouTube iframe embeds via bidirectional `postMessage`.
- **Source-Grounded AI Q&A**: Answers questions based exclusively on the video context, citing clickable `[MM:SS]` badges that instantly jump to that exact video moment.
- **Durable State Machine**: Tracks background jobs through SQLite (`processing_jobs`), surviving browser refreshes without losing analysis progress.
- **Cinematic Dark Design**: Minimalist graphite and obsidian palette (`#050505`, `#0A0A0A`, `#111111`, `#27272A`) with restrained violet accents.

---

## 🔮 3D-First Interactive Architecture

1. **VYORA Knowledge Core (`VyoraKnowledgeCore.tsx`)**: Metallic icosahedron core with concentric gimbal rings and starfield particle swarm.
2. **3D Spatial Chapter Timeline (`SpatialTimeline3D.tsx`)**: Luminous orbital nodes along a 3D curved trajectory rendered in the AI Workspace with raycast seeking.
3. **3D Adaptive Processing Core (`ProcessingCore3D.tsx`)**: Dynamic 3D core that adapts geometry, particle density, and rotation across real pipeline stages (`QUEUED` ➔ `UPLOADING` ➔ `EXTRACTING_AUDIO` ➔ `TRANSCRIBING` ➔ `IDENTIFYING_CHAPTERS` ➔ `FINALIZING` ➔ `COMPLETED`).
4. **3D Knowledge Map Topology (`KnowledgeMap3D.tsx`)**: Radial graph connecting video projects with chapter and concept satellite nodes.

---

## 🏗️ Repository Layout

```
VYORA-AI/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI routes, SPA serving & health checks
│   │   ├── config.py                   # Environment config & API key resolution
│   │   ├── database.py                 # SQLite database, auto-migrations & demo seeding
│   │   ├── models/
│   │   │   └── schemas.py              # Pydantic schemas (Chapters, Transcripts, OCR, Q&A)
│   │   └── services/
│   │       ├── gemini_extractor.py     # Multimodal analysis engine via Google GenAI SDK
│   │       ├── model_discovery_service.py # Dynamic model discovery, rating & TTL caching
│   │       ├── url_ingestion_service.py   # SSRF defense, DNS resolution & YouTube adapters
│   │       ├── qa_service.py           # Grounded RAG with clickable citations
│   │       ├── media_service.py        # HTTP Range video/audio streaming
│   │       └── pipeline_service.py     # Background job scheduler & state machine
│   ├── tests/
│   │   ├── test_api_endpoints.py       # API route & health tests
│   │   ├── test_gemini_upload.py       # Gemini SDK upload & fallback tests
│   │   ├── test_model_discovery.py     # Model discovery & TTL cache tests
│   │   └── test_url_ingestion.py       # SSRF protection & YouTube parsing tests
│   ├── requirements.txt                # Python dependencies
│   ├── run.py                          # Server launcher
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/                     # Three.js / React Three Fiber visualizers
│   │   │   ├── pages/                  # Landing, Dashboard, Import, Workspace, Library
│   │   │   ├── VideoPlayer.tsx         # Dual-engine player (HTML5 + YouTube iframe API)
│   │   │   ├── QAChatTab.tsx           # Grounded Q&A with clickable timestamp badges
│   │   │   └── SettingsModal.tsx       # Masked API key manager with real-time test
│   │   ├── lib/
│   │   │   ├── api.ts                  # API client & job polling
│   │   │   └── types.ts                # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── render.yaml                         # Production Render Blueprint configuration
├── ENVIRONMENT_VARIABLES.md            # Complete environment variable specification
├── DEPLOYMENT.md                       # Comprehensive deployment manual
└── README.md
```

---

## 🚀 Local Development Quickstart

### Prerequisites
- **Python 3.10+** (Python 3.12 / 3.14 verified)
- **Node.js 18+** & `npm`
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey))

### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# Activate Virtualenv:
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your GEMINI_API_KEY

# Run server
uvicorn app.main:app --reload --port 8000
```
*API interactive documentation available at `http://127.0.0.1:8000/docs`.*

### 2. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
*Application opens at `http://localhost:5173/`.*

---

## 🧪 Automated Verification Suite

Run all backend unit and regression tests (35 tests):
```bash
# Set PYTHONPATH and execute pytest
python -m pytest backend/tests -v
```

Run frontend TypeScript verification and production build:
```bash
npm --prefix frontend run build
```

---

## 🌐 Deploying to Render

This repository includes a pre-configured `render.yaml` Blueprint for Render:

1. Connect your repository on [dashboard.render.com](https://dashboard.render.com/) via **New + ➔ Blueprint**.
2. Render automatically sets up:
   - **`vyora-backend`**: Python Web Service running `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - **`vyora-frontend`**: Static Site publishing `./dist` with SPA rewrite rules.
3. Add your `GEMINI_API_KEY` under the backend environment configuration.
4. For detailed step-by-step instructions, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## 📄 License

MIT License. Designed and built with ❤️ by [Kumar Shaurya](https://github.com/Kshaurya-07).
