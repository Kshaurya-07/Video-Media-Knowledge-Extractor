# VYORA AI — Deployment Guide for Render

This guide outlines how to deploy VYORA AI to [Render](https://render.com) using either the automated Blueprint or manual service setup.

---

## Option 1: Automated Blueprint Deployment (`render.yaml`)

1. Push your changes to your GitHub repository.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** and select **Blueprint**.
3. Connect your GitHub repository: `https://github.com/Kshaurya-07/Video-Media-Knowledge-Extractor`.
4. Render will parse `render.yaml` and configure two services:
   - **`vyora-backend`** (Python Web Service)
   - **`vyora-frontend`** (Static Site)
5. Under `vyora-backend`, enter your **`GEMINI_API_KEY`**.
6. Click **Apply**. Render will build and deploy both services automatically with environment linkages configured.

---

## Option 2: Manual Dashboard Deployment

### 1. Backend Web Service (`vyora-backend`)
- **Service Type**: Web Service
- **Environment**: Python
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/api/health`
- **Environment Variables**:
  - `PYTHON_VERSION`: `3.12.0`
  - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
  - `GEMINI_MODEL`: `gemini-3.8-flash`
  - `MODEL_CACHE_TTL_SECONDS`: `3600`

### 2. Frontend Static Site (`vyora-frontend`)
- **Service Type**: Static Site
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `./dist`
- **Rewrite Rule**:
  - Source: `/*`
  - Destination: `/index.html`
- **Environment Variables**:
  - `VITE_API_URL`: `https://vyora-backend.onrender.com` *(Replace with your actual backend URL. Can be with or without trailing `/api`; the client normalizes it automatically)*

---

## Server API Key vs. User Key Configuration

1. **Server-Side Key**: When `GEMINI_API_KEY` is set in the Render Web Service environment, the backend automatically detects it and advertises `server_api_key_configured: true`. All visitors immediately see **"Server API Active"** in the top navigation bar and can analyze media without entering a key.
2. **User-Side Key Override**: Users can optionally configure a personal Google AI Studio key in the Settings modal if they wish to use their own quota.
3. **Stale Job Auto-Recovery**: If a Render instance restarts during a video extraction, orphaned jobs in the database are automatically marked `FAILED` with a clear message and retry action, preventing jobs from remaining stuck at `QUEUED / 10%`.

---

## Unified Single-Service Deployment Option
If you prefer running a single Render Web Service instead of two:
- **Build Command**: `npm run build && pip install -r backend/requirements.txt`
- **Start Command**: `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
- The FastAPI backend includes automatic SPA fallback mounting that serves `./dist` directly.
