# VYORA AI — Video & Media Knowledge Extractor ⚡

> **Tagline:** *Every Video Holds a Universe of Knowledge.*

An immersive, full-stack, 3D-first multimodal video knowledge extraction platform powered by **Google Gemini 3.8 Flash**, **FastAPI**, **Three.js**, and **React 18 (Vite + Tailwind CSS)**.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r183+-black?logo=three.js&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)

---

## 🌌 Visual Identity & Design System

Built on an ultra-premium, cinematic black-and-silver palette with restrained violet accents:

- **Primary Background:** `#050505`
- **Secondary Background:** `#0A0A0A`
- **Elevated Surfaces:** `#111111`
- **Card Surfaces:** `#151515`
- **Border Trim:** `#27272A`
- **Primary Text:** `#FAFAFA`
- **Secondary Text:** `#A1A1AA`
- **Muted Text:** `#71717A`
- **Silver Highlight:** `#D4D4D8`
- **Subtle Violet Accent:** `#8B5CF6`

---

## 🔮 Mandatory 3D-First Experience

VYORA AI features meaningful Three.js spatial elements throughout every major screen:

1. **VYORA Knowledge Core (`VyoraKnowledgeCore.tsx`)**
   - Signature sculptural, dark metallic icosahedron core with concentric gimbal orbital rings, floating concept nodes, and a quantum starfield particle swarm.
   - Real-time pointer inertia tracking, ACESFilmic tone mapping, and automatic off-screen animation pausing.

2. **3D Spatial Chapter Timeline (`SpatialTimeline3D.tsx`)**
   - Rendered directly inside the AI Video Workspace.
   - Visualizes video chapters as luminous orbital nodes along a 3D curved trajectory.
   - Interactive raycasting: clicking an orb smoothly navigates the HTML5 video player to that timestamp.

3. **3D Knowledge Map Topology (`KnowledgeMap3D.tsx`)**
   - Spherical radial graph connecting video projects (central nodes) with chapter nodes and entity/concept satellite nodes.
   - Allows users to hover to preview concepts and click to navigate directly into project workspaces.

4. **3D Adaptive Processing Core (`ProcessingCore3D.tsx`)**
   - Dynamic 3D visualization that changes its geometry, particle streams, rotation frequency, and emissive colors as the media progresses through real pipeline stages:
     `QUEUED` ➔ `UPLOADING` ➔ `EXTRACTING_AUDIO` ➔ `TRANSCRIBING` ➔ `IDENTIFYING_CHAPTERS` ➔ `INDEXING` ➔ `FINALIZING` ➔ `COMPLETED`.

---

## 🖥️ Screen & Product Architecture

### 1. Cinematic Landing Page
- Minimal floating navigation bar with geometric knowledge core logo.
- Editorial headline: *"Every Video Holds a Universe of Knowledge."*
- Interactive 3D Knowledge Core hero with direct video stream input.
- Feature grid, 3-step pipeline sequence, and live interactive sample preview.

### 2. Authentication Experience
- Split layout featuring Supabase Auth integration and one-click demo login.
- Dedicated 3D spatial backdrop with ambient particles and typography.

### 3. Knowledge Command Center Dashboard
- Collapsible sidebar navigation: Overview, My Videos, AI Workspace, Saved Notes, Bookmarks, Settings.
- Interactive 3D Knowledge Map showing topological relationships across all processed videos.
- Video project cards with real duration, status, chapter count, open, and delete actions.

### 4. Video Ingestion & Processing
- Drag-and-drop file upload (MP4, WebM, MOV, MP3, WAV up to 500MB) and URL ingestion.
- Live background job polling linked to the 3D Processing Core visualization.

### 5. AI Video Workspace (Flagship 3-Column Experience)
- **Left Column:** Timestamped chapters and verbatim dialogue transcript with real-time keyword filtering.
- **Center Column:** Synchronized media player with HTTP 206 Partial Content Range streaming, **3D Spatial Chapter Timeline**, executive summary, and key takeaways.
- **Right Column:** Source-grounded AI Chat assistant with clickable `[MM:SS]` citations, Research Notes editor with timestamp pinning, and Bookmarks.

### 6. Personal Knowledge Library
- Searchable archive of all extracted knowledge assets with toggle between Grid View and 3D Topology View.

---

## 🏗️ Repository Structure

```
VYORA-AI/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI routes & endpoints
│   │   ├── config.py                   # Environment configuration & key resolution
│   │   ├── database.py                 # SQLite database & demo seeding
│   │   ├── models/
│   │   │   └── schemas.py              # Pydantic schemas (Chapters, Transcripts, OCR, Q&A)
│   │   └── services/
│   │       ├── gemini_extractor.py     # Multimodal analysis engine via Google GenAI SDK
│   │       ├── qa_service.py           # Grounded RAG with clickable citations
│   │       ├── media_service.py        # HTTP Range video/audio streaming
│   │       └── pipeline_service.py     # Background job scheduler & stage tracker
│   ├── migrations/
│   │   └── 001_initial_schema.sql      # Supabase PostgreSQL schema with Row Level Security (RLS)
│   ├── samples/                        # Bundled demonstration media
│   ├── data_cache/                     # Pre-computed extractions for instant demo
│   ├── requirements.txt
│   ├── run.py
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/
│   │   │   │   ├── VyoraKnowledgeCore.tsx   # Signature 3D metallic core
│   │   │   │   ├── SpatialTimeline3D.tsx    # 3D chapter timeline for workspace
│   │   │   │   ├── KnowledgeMap3D.tsx       # 3D connected knowledge topology
│   │   │   │   └── ProcessingCore3D.tsx     # 3D stage-adaptive processing core
│   │   │   ├── pages/
│   │   │   │   ├── LandingPage.tsx          # Cinematic landing page
│   │   │   │   ├── AuthPage.tsx             # Split-layout authentication page
│   │   │   │   ├── DashboardPage.tsx        # Command center with 3D map
│   │   │   │   ├── ImportPage.tsx           # Ingestion & live 3D processing
│   │   │   │   ├── WorkspacePage.tsx        # 3-column AI Video Workspace
│   │   │   │   └── LibraryPage.tsx          # Personal Knowledge Library
│   │   │   ├── Header.tsx                   # Top navigation bar
│   │   │   ├── VideoPlayer.tsx              # HTML5 player with seek control
│   │   │   ├── SettingsModal.tsx            # API key manager
│   │   │   └── ExportModal.tsx              # Markdown & JSON exporter
│   │   ├── lib/
│   │   │   ├── api.ts                       # API client with Vite proxy
│   │   │   └── types.ts                     # TypeScript definitions
│   │   ├── App.tsx                          # Master app layout & router
│   │   └── index.css                        # Tailwind dark cinematic theme
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** & `npm`
- **Google Gemini API Key** (Free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey))

---

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
# Windows (PowerShell):
python -m venv .venv
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI backend
python run.py
```
*Backend runs on `http://127.0.0.1:8000` (Interactive API docs at `/docs`).*

---

### 2. Frontend Setup

In a new terminal:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
*Web application runs on `http://localhost:5173/`.*

---

## ⚡ Instant Demo Experience

Open `http://localhost:5173/` and click **"Launch Interactive Demo Keynote"**. The app immediately loads the bundled keynote: *"Architecting Real-Time Multimodal AI Systems with Gemini 3.8 Flash"* without requiring an API key.

---

## 📄 License

MIT License. Designed and built with ❤️ by [Kumar Shaurya](https://github.com/Kshaurya-07).
