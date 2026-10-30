import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Model configuration
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# Upload and storage directories
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

SAMPLES_DIR = BASE_DIR / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

DATA_CACHE_DIR = BASE_DIR / "data_cache"
DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)

def get_api_key(explicit_key: str | None = None) -> str | None:
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
