import os
import uuid
import shutil
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, Header, Request, Response, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from google import genai

from app.config import UPLOAD_DIR, SAMPLES_DIR, DATA_CACHE_DIR, get_api_key
from app.models.schemas import (
    MediaMetadata,
    MediaAnalysisResult,
    ChatRequest,
    ChatResponse,
    VerifyKeyRequest,
    VerifyKeyResponse,
)
from app.services.media_service import (
    get_media_path,
    get_media_mime_type,
    range_stream,
    format_seconds,
)
from app.services.gemini_extractor import (
    extract_media_knowledge,
    get_cached_result,
    save_cache_result,
)
from app.services.qa_service import answer_media_question

app = FastAPI(
    title="VYORA AI — Video & Media Knowledge Extractor API",
    description="Multimodal knowledge extraction, chapter segmentation, OCR, and Q&A powered by Google Gemini",
    version="1.0.0"
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    has_env_key = bool(get_api_key())
    return {
        "status": "healthy",
        "service": "VYORA AI Media Knowledge Extractor",
        "has_api_key_configured": has_env_key
    }

@app.post("/api/verify-key", response_model=VerifyKeyResponse)
async def verify_api_key(req: VerifyKeyRequest):
    if not req.api_key or not req.api_key.strip():
        return VerifyKeyResponse(valid=False, message="API key is empty")
    try:
        client = genai.Client(api_key=req.api_key.strip())
        # Try a quick ping or lightweight model query
        models_pager = client.models.list(config={"page_size": 3})
        models = list(models_pager)
        if models:
            return VerifyKeyResponse(valid=True, message=f"Valid Gemini API Key. Connected successfully ({len(models)} models listed).")
        return VerifyKeyResponse(valid=True, message="Connected to Gemini API.")
    except Exception as e:
        return VerifyKeyResponse(valid=False, message=f"Verification failed: {str(e)}")

@app.post("/api/upload", response_model=MediaMetadata)
async def upload_media(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())[:12]
    orig_name = file.filename or "media_file.mp4"
    suffix = Path(orig_name).suffix.lower()
    if not suffix:
        suffix = ".mp4"

    save_path = UPLOAD_DIR / f"{file_id}{suffix}"

    # Save uploaded file
    file_size = 0
    with open(save_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            buffer.write(chunk)

    mime_type = get_media_mime_type(save_path)
    is_video = mime_type.startswith("video/")

    # Fallback duration estimate
    estimated_duration = 180.0

    return MediaMetadata(
        file_id=file_id,
        filename=orig_name,
        media_type="video" if is_video else "audio",
        duration_seconds=estimated_duration,
        duration_formatted=format_seconds(estimated_duration),
        file_size_bytes=file_size,
    )

@app.post("/api/extract/{file_id}", response_model=MediaAnalysisResult)
async def extract_knowledge(
    file_id: str,
    x_gemini_api_key: Optional[str] = Header(None)
):
    result = await extract_media_knowledge(file_id, api_key=x_gemini_api_key)
    return result

@app.get("/api/analysis/{file_id}", response_model=MediaAnalysisResult)
async def get_analysis(file_id: str):
    cached = get_cached_result(file_id)
    if not cached:
        raise HTTPException(status_code=404, detail="No extracted knowledge found for this media ID.")
    return cached

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_media(
    req: ChatRequest,
    x_gemini_api_key: Optional[str] = Header(None)
):
    key = req.api_key or x_gemini_api_key
    response = await answer_media_question(
        file_id=req.file_id,
        question=req.message,
        history=req.history,
        api_key=key
    )
    return response

@app.api_route("/api/media/{file_id}", methods=["GET", "HEAD"])
async def stream_media(file_id: str, request: Request):
    """
    Stream media files with HTTP 206 Partial Content and HEAD request support.
    """
    media_path = get_media_path(file_id)
    range_header = request.headers.get("range")
    
    stream_generator, start, end, file_size, content_type = range_stream(media_path, range_header)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str((end - start) + 1),
        "Content-Type": content_type,
    }

    if request.method == "HEAD":
        return Response(status_code=status.HTTP_200_OK, headers=headers, media_type=content_type)

    status_code = status.HTTP_206_PARTIAL_CONTENT if range_header else status.HTTP_200_OK

    return StreamingResponse(
        stream_generator(),
        status_code=status_code,
        headers=headers,
        media_type=content_type
    )

@app.get("/api/samples")
async def list_sample_media():
    samples = []
    for f in SAMPLES_DIR.iterdir():
        if f.suffix.lower() in ['.mp4', '.webm', '.mov', '.mp3', '.wav']:
            samples.append({
                "id": f.stem,
                "name": f.name,
                "type": "video" if get_media_mime_type(f).startswith("video/") else "audio",
                "size": f.stat().st_size
            })
    return samples
