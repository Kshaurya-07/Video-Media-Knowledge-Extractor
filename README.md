# VYORA AI — Video & Media Knowledge Extractor ⚡

An intelligent, full-stack multimodal knowledge extraction platform powered by **Google Gemini 2.5 / 2.0 Flash**. Transform lectures, keynotes, meetings, technical demos, podcasts, and video tutorials into structured, actionable, and conversational knowledge assets.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Gemini](https://img.shields.io/badge/Google_Gemini-2.5_Flash-4285F4?logo=google&logoColor=white)](https://aistudio.google.com)

---

## 🌟 Key Features

1. **Multimodal Direct Media Ingestion**
   - Ingests raw video (`.mp4`, `.webm`, `.mov`, `.mkv`) and audio (`.mp3`, `.wav`, `.m4a`) directly using the Google GenAI Files API.
   - Eliminates fragile multi-model cascades (ASR + Vision OCR + LLM) by reasoning over interleaved visual and auditory streams simultaneously.

2. **Timestamped Chapter Segmentation**
   - Automatically detects thematic boundaries and generates chronological chapters with start/end bounds and key moments.
   - Click any chapter to jump the player directly to that segment.

3. **Synchronized, Searchable Transcript**
   - Full dialogue transcription with speaker identification and timestamp badges.
   - Real-time text search with instant query highlighting and one-click copy.

4. **Visual Scene & On-Screen OCR Analysis**
   - Detects technical slides, architecture diagrams, live code editors, and whiteboard formulas.
   - Extracts on-screen text and code verbatim with precise temporal references.

5. **Entity & Concept Mapping + Action Items**
   - Extracts key entities (people, technologies, frameworks, metrics, tools) with mention frequencies and timeline tags.
   - Identifies actionable next steps and recommendations with interactive task checkboxes.

6. **Conversational Video Q&A with Clickable Citations**
   - Ask complex questions about any moment in the video.
   - Answers cite specific timestamps `[MM:SS]` that seek the video player to the exact explanation on click.

7. **Multi-Format Knowledge Export**
   - Export synthesized intelligence into clean Markdown (`.md`) or raw JSON (`.json`) with a single click.

---

## 🏗️ Architecture

```
VYORA-AI/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI routes (Upload, Extract, Media Stream, Chat, Health)
│   │   ├── config.py              # Configuration & API Key management
│   │   ├── models/
│   │   │   └── schemas.py         # Pydantic data schemas
│   │   └── services/
│   │       ├── gemini_extractor.py# Multimodal analysis engine using Google GenAI SDK
│   │       ├── qa_service.py      # Conversational RAG with citation generation
│   │       └── media_service.py   # HTTP Range streaming & file management
│   ├── samples/                   # Bundled demo media files
│   ├── data_cache/                # Pre-computed extractions for instant preview
│   ├── requirements.txt           # Python dependencies
│   ├── run.py                     # Entrypoint server script
│   └── .env.example               # Environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/            # Header, VideoPlayer, Uploader, Tabs, Modals
│   │   ├── lib/                   # API client & TypeScript interfaces
│   │   ├── App.tsx                # Master workspace layout
│   │   └── index.css              # Custom Tailwind theme styling
│   ├── package.json
│   ├── vite.config.ts             # Dev server with proxy to backend
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

# Create a virtual environment
python -m venv .venv

# Activate the virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Set your Gemini API key in backend/.env:
# GEMINI_API_KEY=AIzaSy...
```

Run the backend server:
```bash
python run.py
```
*The FastAPI backend will start at `http://127.0.0.1:8000` (API documentation available at `/docs`).*

---

### 2. Frontend Setup

In a new terminal window:

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
*The web application is now live at `http://localhost:5173/`.*

---

## ⚡ Instant Demo (Zero API Key Setup Needed)

If you want to immediately experience the platform before uploading a large video or entering an API key:
1. Open `http://localhost:5173/`.
2. Click **"Launch Demo"** on the home screen.
3. The platform instantly loads the bundled technical keynote: *"Architecting Real-Time Multimodal AI Systems with Gemini 2.5"*.
4. Test clicking chapters, scrubbing through the transcript, inspecting visual OCR cards, and testing the conversational assistant!

---

## 🔑 Configuring Your Gemini API Key

You can configure your API key in two ways:
1. **In the Web UI (Recommended):** Click **"Enter API Key"** in the top navigation bar. Enter your key, click **Verify & Connect**, and it is securely saved in your browser session.
2. **In Environment Variables:** Create a `.env` file in the `backend/` folder:
   ```env
   GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
   GEMINI_MODEL=gemini-2.5-flash
   ```

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check and API key readiness probe |
| `/api/verify-key` | `POST` | Validates a Gemini API key with live model list ping |
| `/api/upload` | `POST` | Uploads an audio/video file for analysis |
| `/api/extract/{file_id}` | `POST` | Triggers multimodal extraction with Gemini 2.5 |
| `/api/analysis/{file_id}` | `GET` | Retrieves cached knowledge extraction payload |
| `/api/chat` | `POST` | Ask questions with timestamp citations |
| `/api/media/{file_id}` | `GET, HEAD`| Streams media with HTTP 206 Partial Content (seeking) |
| `/api/samples` | `GET` | Lists built-in sample media files |

---

## 📄 License

MIT License. Designed and built with ❤️ by [Kshaurya](https://github.com/Kshaurya-07).
