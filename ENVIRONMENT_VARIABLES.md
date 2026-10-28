# VYORA AI — Environment Variables Specification

This document details every environment variable utilized across VYORA AI services.

---

## Backend Web Service (`vyora-backend`)

| Variable | Required | Default | Scope | Purpose & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Yes** (in production) | `None` | **Secret** (Server-side) | Primary Google Gemini API key used for multimodal video ingestion, chapter generation, and Q&A inference. |
| `GEMINI_MODEL` | No | `gemini-3.8-flash` | Public / Non-secret | Preferred default model for inference. If unavailable to the key, the dynamic model discovery service automatically falls back to compatible verified models (`gemini-2.0-flash`, `gemini-1.5-flash`, etc.). |
| `MODEL_CACHE_TTL_SECONDS` | No | `3600` (1 hour) | Non-secret | Duration to cache compatible Gemini models from the Google Model Listing API to avoid redundant requests on page load. |
| `PORT` | Injected by host | `8000` | Non-secret | TCP port for the FastAPI Uvicorn server to bind. Render injects `$PORT` automatically. |
| `PYTHON_VERSION` | No | `3.12.0` | Non-secret | Python runtime version specified in `render.yaml`. |

---

## Frontend Static Site (`vyora-frontend`)

| Variable | Required | Default | Scope | Purpose & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_URL` | **Yes** (in production) | Local `/api` proxy | Public / Client-side | The public base URL pointing to the deployed `vyora-backend` web service (e.g. `https://vyora-backend.onrender.com`). **Never contains secret API keys.** |

---

## Security Invariants

1. **Client Isolation**: The `GEMINI_API_KEY` is **strictly server-side** and is never passed in client HTML or Vite public bundles (`VITE_GEMINI_API_KEY` is never used).
2. **Dynamic Fallbacks**: If `GEMINI_API_KEY` is missing in the environment, the application still boots cleanly into interactive demo mode and prompts the user in Settings rather than crashing.
3. **SSRF Restrictions**: Remote video downloads enforce a 500 MB hard limit and reject all private, loopback, link-local, and cloud metadata (`169.254.169.254`) IP addresses.
