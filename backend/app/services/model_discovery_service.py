import os
import time
import hashlib
import logging
import concurrent.futures
from typing import Dict, List, Optional, Set, Tuple, Any
from datetime import datetime, timezone

from google import genai
from google.genai import types

from app.config import DEFAULT_MODEL, get_api_key

logger = logging.getLogger("vyora.model_discovery")

# Configurable Cache TTL (default: 3600 seconds / 1 hour)
MODEL_CACHE_TTL_SECONDS = int(os.getenv("MODEL_CACHE_TTL_SECONDS", "3600"))

# Curated multimodal fallback models (in preferential order) used if listing API is unreachable
CURATED_MULTIMODAL_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

# Patterns for models that CANNOT support multimodal video understanding or are deprecated/fictional
INCOMPATIBLE_NAME_PATTERNS = [
    "embedding",
    "imagen",
    "veo",
    "whisper",
    "chirp",
    "aqa",
    "bison",
    "gecko",
    "gemini-1.0-pro",
    "gemini-1.0-ultra",
    "gemini-3.8",
    "medlm",
]

class DiscoveredModelInfo:
    def __init__(
        self,
        model_id: str,
        display_name: str,
        description: str = "",
        input_token_limit: int = 0,
        output_token_limit: int = 0,
        supported_actions: Optional[List[str]] = None,
        is_compatible: bool = True,
        compatibility_reason: str = "Multimodal content generation supported",
        tier_score: int = 500,
    ):
        self.model_id = model_id
        self.display_name = display_name
        self.description = description
        self.input_token_limit = input_token_limit
        self.output_token_limit = output_token_limit
        self.supported_actions = supported_actions or []
        self.is_compatible = is_compatible
        self.compatibility_reason = compatibility_reason
        self.tier_score = tier_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "display_name": self.display_name,
            "description": self.description,
            "input_token_limit": self.input_token_limit,
            "output_token_limit": self.output_token_limit,
            "supported_actions": self.supported_actions,
            "is_compatible": self.is_compatible,
            "compatibility_reason": self.compatibility_reason,
            "tier_score": self.tier_score,
        }

class ModelCacheEntry:
    def __init__(self, key_hash: str):
        self.key_hash = key_hash
        self.timestamp = 0.0
        self.discovered_models: List[DiscoveredModelInfo] = []
        self.compatible_models: List[DiscoveredModelInfo] = []
        self.selected_model: str = DEFAULT_MODEL
        self.selection_mode: str = "automatic"
        self.status: str = "pending_key"
        self.message: str = "No API key configured"
        self.last_checked: str = ""
        self.blacklisted_models: Set[str] = set()

# In-memory discovery cache keyed by API key hash
_MODEL_CACHE: Dict[str, ModelCacheEntry] = {}

def get_key_hash(api_key: Optional[str]) -> str:
    """Generate non-reversible hash of API key for isolated multi-user cache lookup."""
    if not api_key or not api_key.strip():
        return "unauthenticated_default"
    return hashlib.sha256(api_key.strip().encode("utf-8")).hexdigest()[:16]

def normalize_model_id(raw_name: str) -> str:
    """Normalize model identifier by stripping Google resource prefixes."""
    if not raw_name:
        return ""
    clean = raw_name.strip()
    if clean.startswith("models/"):
        clean = clean[len("models/"):]
    elif "publishers/google/models/" in clean:
        clean = clean.split("/")[-1]
    return clean

def format_model_display_name(model_id: str, raw_display: Optional[str] = None) -> str:
    """Provide a clean, human-readable display name for the model."""
    if raw_display and raw_display.strip():
        return raw_display.strip()
    if model_id == "gemini-2.0-flash":
        return "Gemini 2.0 Flash"
    if model_id == "gemini-1.5-flash":
        return "Gemini 1.5 Flash"
    if model_id == "gemini-1.5-pro":
        return "Gemini 1.5 Pro"
    if model_id == "gemini-2.5-flash":
        return "Gemini 2.5 Flash"
    return model_id.replace("-", " ").title()

def assess_model_compatibility(
    model_id: str,
    supported_actions: List[str],
    input_tokens: int,
    blacklisted: Set[str]
) -> Tuple[bool, str, int]:
    """
    Assess if model is suitable for multimodal video/audio extraction and Q&A.
    Returns (is_compatible, reason, tier_score).
    """
    mid_lower = model_id.lower()

    # 1. Blacklist check
    if model_id in blacklisted:
        return False, f"Model '{model_id}' previously failed runtime execution and was blacklisted", 0

    # 2. Incompatible name patterns (embeddings, image-only, audio-only, deprecated)
    for pattern in INCOMPATIBLE_NAME_PATTERNS:
        if pattern in mid_lower:
            return False, f"Incompatible model type or deprecated model (matches '{pattern}')", 0

    # 3. Must be a Gemini model
    if not mid_lower.startswith("gemini"):
        return False, "Not a Gemini family generation model", 0

    # 4. Check supported actions if provided
    if supported_actions:
        actions_lower = [a.lower() for a in supported_actions]
        has_gen_content = any("generatecontent" in a or "generate_content" in a for a in actions_lower)
        if not has_gen_content:
            return False, "Model does not support generateContent operation", 0

    # 5. Token limit check (video inputs require at least 32,000 tokens context)
    if input_tokens > 0 and input_tokens < 32000:
        return False, f"Context window ({input_tokens} tokens) too small for media analysis", 0

    # 6. Compute scoring tier for intelligent ranking
    # Flash models are prioritized for video processing: fast, massive 1M context, cost-efficient
    score = 500
    if "2.0-flash" in mid_lower:
        score = 1000
    elif "1.5-flash" in mid_lower:
        score = 900
    elif "flash" in mid_lower:
        score = 800
    elif "2.0-pro" in mid_lower:
        score = 750
    elif "1.5-pro" in mid_lower:
        score = 700
    elif "pro" in mid_lower:
        score = 650

    return True, "Compatible for multimodal media understanding and structured generation", score

def discover_available_models(
    client: genai.Client,
    api_key: str,
    force_refresh: bool = False
) -> ModelCacheEntry:
    """
    Query Google's official Model-Listing API, handle pagination, filter capabilities,
    and cache the results for the configured TTL.
    """
    key_hash = get_key_hash(api_key)
    now = time.time()

    cache_entry = _MODEL_CACHE.get(key_hash)
    if cache_entry is None:
        cache_entry = ModelCacheEntry(key_hash)
        _MODEL_CACHE[key_hash] = cache_entry

    # Check cache freshness
    if not force_refresh and cache_entry.timestamp > 0 and (now - cache_entry.timestamp) < MODEL_CACHE_TTL_SECONDS:
        return cache_entry

    logger.info(f"[VYORA AI] Discovering Gemini models from Google API (key_hash={key_hash})...")
    discovered: List[DiscoveredModelInfo] = []

    try:
        # Call Google GenAI SDK models.list with pagination config using a bounded worker
        def _fetch_all_models():
            items = []
            models_pager = client.models.list(config={"page_size": 50})
            for m in models_pager:
                items.append(m)
            return items

        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        try:
            future = executor.submit(_fetch_all_models)
            raw_models = future.result(timeout=4.0)
            executor.shutdown(wait=False)
        except concurrent.futures.TimeoutError:
            executor.shutdown(wait=False, cancel_futures=True)
            raise TimeoutError("models.list API call timed out after 4.0 seconds")
        except Exception:
            executor.shutdown(wait=False, cancel_futures=True)
            raise
        
        # Process discovered models
        for m in raw_models:
            raw_name = getattr(m, "name", "") or ""
            model_id = normalize_model_id(raw_name)
            if not model_id:
                continue

            display_name = format_model_display_name(model_id, getattr(m, "display_name", None))
            description = getattr(m, "description", "") or ""
            input_tokens = getattr(m, "input_token_limit", 0) or 0
            output_tokens = getattr(m, "output_token_limit", 0) or 0
            supported_actions = list(getattr(m, "supported_actions", []) or [])

            is_compat, reason, score = assess_model_compatibility(
                model_id=model_id,
                supported_actions=supported_actions,
                input_tokens=input_tokens,
                blacklisted=cache_entry.blacklisted_models
            )

            discovered.append(DiscoveredModelInfo(
                model_id=model_id,
                display_name=display_name,
                description=description,
                input_token_limit=input_tokens,
                output_token_limit=output_tokens,
                supported_actions=supported_actions,
                is_compatible=is_compat,
                compatibility_reason=reason,
                tier_score=score
            ))

        cache_entry.status = "connected"
        cache_entry.message = f"Discovered {len(discovered)} models from Google Gemini API."

    except Exception as exc:
        err_str = str(exc)
        logger.warning(f"[VYORA AI] models.list API call encountered error: {err_str}")
        if "401" in err_str or "API_KEY_INVALID" in err_str:
            cache_entry.status = "unauthenticated"
            cache_entry.message = "Gemini API key is invalid or unauthenticated."
            cache_entry.discovered_models = []
            cache_entry.compatible_models = []
            cache_entry.timestamp = now
            cache_entry.last_checked = datetime.now(timezone.utc).isoformat()
            return cache_entry

        # Fallback to curated candidates if network/permission prevents listing but key may be valid
        logger.info("[VYORA AI] Using curated multimodal candidate pool as fallback for listing.")
        for cid in CURATED_MULTIMODAL_MODELS:
            is_compat, reason, score = assess_model_compatibility(
                model_id=cid,
                supported_actions=["generateContent"],
                input_tokens=1048576,
                blacklisted=cache_entry.blacklisted_models
            )
            discovered.append(DiscoveredModelInfo(
                model_id=cid,
                display_name=format_model_display_name(cid),
                description="Google multimodal foundation model",
                input_token_limit=1048576,
                output_token_limit=8192,
                supported_actions=["generateContent"],
                is_compatible=is_compat,
                compatibility_reason=reason,
                tier_score=score
            ))
        cache_entry.status = "configured"
        cache_entry.message = f"Connected using curated candidates ({len(discovered)} available)."

    # Filter compatible models
    compatible = [m for m in discovered if m.is_compatible]

    # Check for administrator preferred model override
    env_preferred = os.getenv("PREFERRED_GEMINI_MODEL") or os.getenv("GEMINI_MODEL")
    selected = None
    selection_mode = "automatic"

    if env_preferred:
        norm_pref = normalize_model_id(env_preferred)
        matching_pref = next((m for m in compatible if m.model_id == norm_pref), None)
        if matching_pref and norm_pref not in cache_entry.blacklisted_models:
            selected = matching_pref.model_id
            selection_mode = "preferred_override"
            logger.info(f"[VYORA AI] Admin preferred model '{selected}' is verified compatible and selected.")

    # If no preferred model or preferred was incompatible/blacklisted, select highest-scoring compatible model
    if not selected:
        if compatible:
            # Sort descending by tier score
            compatible.sort(key=lambda m: m.tier_score, reverse=True)
            selected = compatible[0].model_id
            selection_mode = "automatic"
            logger.info(f"[VYORA AI] Automatically selected highest-ranked compatible model '{selected}' (score={compatible[0].tier_score}).")
        else:
            selected = DEFAULT_MODEL
            selection_mode = "fallback"
            cache_entry.status = "no_compatible_model"
            cache_entry.message = "No compatible multimodal Gemini models discovered for this project."

    cache_entry.timestamp = now
    cache_entry.discovered_models = discovered
    cache_entry.compatible_models = compatible
    cache_entry.selected_model = selected
    cache_entry.selection_mode = selection_mode
    cache_entry.last_checked = datetime.now(timezone.utc).isoformat()

    return cache_entry

def get_active_model_selection(
    api_key: Optional[str] = None,
    force_refresh: bool = False,
    allow_network: bool = True,
) -> Tuple[str, str, ModelCacheEntry]:
    """
    Get the currently active selected model and selection mode for inference.
    Returns (selected_model_id, selection_mode, cache_entry).
    """
    resolved_key = get_api_key(api_key)
    key_hash = get_key_hash(resolved_key)

    if not resolved_key:
        entry = _MODEL_CACHE.get(key_hash)
        if not entry:
            entry = ModelCacheEntry(key_hash)
            entry.selected_model = DEFAULT_MODEL
            entry.selection_mode = "automatic"
            entry.status = "pending_key"
            entry.message = "No Gemini API key provided. Please configure an API key in Settings."
            entry.last_checked = datetime.now(timezone.utc).isoformat()
            _MODEL_CACHE[key_hash] = entry
        return entry.selected_model, entry.selection_mode, entry

    entry = _MODEL_CACHE.get(key_hash)
    if not allow_network:
        if not entry:
            entry = ModelCacheEntry(key_hash)
            entry.selected_model = DEFAULT_MODEL
            entry.selection_mode = "automatic"
            entry.status = "configured"
            entry.message = "Gemini API key configured."
            entry.last_checked = datetime.now(timezone.utc).isoformat()
            _MODEL_CACHE[key_hash] = entry
        return entry.selected_model, entry.selection_mode, entry

    if not force_refresh and entry and (time.time() - entry.timestamp) < MODEL_CACHE_TTL_SECONDS and entry.timestamp > 0:
        return entry.selected_model, entry.selection_mode, entry

    try:
        client = genai.Client(api_key=resolved_key.strip())
        cache_entry = discover_available_models(client, resolved_key, force_refresh=force_refresh)
        return cache_entry.selected_model, cache_entry.selection_mode, cache_entry
    except Exception as e:
        logger.error(f"[VYORA AI] Failed to initialize client for model discovery: {e}")
        entry = ModelCacheEntry(key_hash)
        entry.selected_model = DEFAULT_MODEL
        entry.selection_mode = "fallback"
        entry.status = "error"
        entry.message = f"Error during model discovery: {str(e)}"
        entry.last_checked = datetime.now(timezone.utc).isoformat()
        _MODEL_CACHE[key_hash] = entry
        return entry.selected_model, entry.selection_mode, entry

def blacklist_failed_model(
    model_id: str,
    api_key: Optional[str] = None,
    reason: str = "Runtime error or 404"
) -> Optional[str]:
    """
    Mark a model as failed/unusable for the current key/session and automatically
    select the next best compatible candidate.
    Returns the newly selected model ID, or None if no alternatives exist.
    """
    resolved_key = get_api_key(api_key)
    key_hash = get_key_hash(resolved_key)
    entry = _MODEL_CACHE.get(key_hash)

    if not entry:
        entry = ModelCacheEntry(key_hash)
        _MODEL_CACHE[key_hash] = entry

    norm_id = normalize_model_id(model_id)
    entry.blacklisted_models.add(norm_id)
    logger.warning(f"[VYORA AI] Blacklisted model '{norm_id}' (reason: {reason}). Evicting from active candidates.")

    # Re-evaluate compatible models without the blacklisted model
    remaining = [m for m in entry.compatible_models if m.model_id != norm_id and m.model_id not in entry.blacklisted_models]
    entry.compatible_models = remaining

    if remaining:
        remaining.sort(key=lambda m: m.tier_score, reverse=True)
        new_selected = remaining[0].model_id
        entry.selected_model = new_selected
        entry.selection_mode = "fallback"
        logger.info(f"[VYORA AI] Successfully fell back to next compatible candidate '{new_selected}'.")
        return new_selected

    # If cache is exhausted, try curated list excluding blacklisted
    curated_remaining = [cid for cid in CURATED_MULTIMODAL_MODELS if cid not in entry.blacklisted_models]
    if curated_remaining:
        new_selected = curated_remaining[0]
        entry.selected_model = new_selected
        entry.selection_mode = "fallback"
        logger.info(f"[VYORA AI] Fell back to curated candidate '{new_selected}'.")
        return new_selected

    entry.status = "no_compatible_model"
    entry.message = "All candidate Gemini models exhausted or unavailable."
    return None

def invalidate_model_cache(api_key: Optional[str] = None):
    """Evict model discovery cache entry, forcing a fresh query on next request."""
    resolved_key = get_api_key(api_key)
    key_hash = get_key_hash(resolved_key)
    if key_hash in _MODEL_CACHE:
        del _MODEL_CACHE[key_hash]
        logger.info(f"[VYORA AI] Invalidated model discovery cache for key_hash={key_hash}.")

def get_model_status_payload(api_key: Optional[str] = None, allow_network: bool = False) -> Dict[str, Any]:
    """
    Generate public-safe model status JSON payload for the GET /api/system/model-status endpoint.
    Guarantees no API secrets, credentials, or private keys are exposed.
    """
    resolved_key = get_api_key(api_key)
    server_key = get_api_key()
    has_server_key = bool(server_key and server_key.strip())
    has_user_key = bool(api_key and api_key.strip())
    has_key = bool(resolved_key and resolved_key.strip())
    selected_model, selection_mode, cache_entry = get_active_model_selection(
        resolved_key,
        allow_network=allow_network
    )

    candidates = [
        {
            "model_id": m.model_id,
            "display_name": m.display_name,
            "tier_score": m.tier_score,
            "input_token_limit": m.input_token_limit,
        }
        for m in cache_entry.compatible_models
    ]

    return {
        "provider": "Google Gemini",
        "selection_mode": selection_mode,
        "selected_model": selected_model,
        "configured_model": selected_model,
        "display_model": format_model_display_name(selected_model),
        "status": cache_entry.status,
        "has_api_key": has_key,
        "server_api_key_configured": has_server_key,
        "user_api_key_provided": has_user_key,
        "model_verified": cache_entry.status in ("connected", "configured"),
        "last_checked": cache_entry.last_checked or datetime.now(timezone.utc).isoformat(),
        "compatible_models_count": len(cache_entry.compatible_models),
        "candidate_models": candidates,
        "message": cache_entry.message,
    }

def verify_gemini_key_lightweight(api_key: str) -> Tuple[bool, str, Optional[str]]:
    """
    Fast, bounded API-key verification (< 4.0s).
    Does NOT perform exhaustive model list pagination.
    Distinguishes invalid keys, quota exhaustion, network errors, and timeouts.
    Returns (is_valid, message, model_name).
    """
    clean_key = api_key.strip()
    if not clean_key:
        return False, "API key is empty.", None

    try:
        def _check():
            client = genai.Client(api_key=clean_key)
            model_info = client.models.get(model="gemini-2.0-flash")
            return getattr(model_info, "display_name", "Gemini 2.0 Flash")

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_check)
            display_name = future.result(timeout=4.0)

        return True, f"API key successfully verified. Connected to Google Gemini ({display_name}).", "gemini-2.0-flash"

    except concurrent.futures.TimeoutError:
        return False, "Verification timed out connecting to Google Gemini API (network delay). Please retry.", None
    except Exception as exc:
        err_str = str(exc)
        logger.warning(f"[VYORA AI] Key verification check returned: {err_str}")
        if "401" in err_str or "API_KEY_INVALID" in err_str or "PERMISSION_DENIED" in err_str or "unauthenticated" in err_str.lower():
            return False, "Invalid API key. Please verify your credentials in Google AI Studio.", None
        elif "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
            return False, "API quota exhausted. Check your Google AI Studio plan and rate limits.", None
        elif "404" in err_str or "NOT_FOUND" in err_str:
            return True, "API key is valid (authenticated with Google AI Studio).", DEFAULT_MODEL
        elif "Connection" in err_str or "Failed to establish" in err_str or "getaddrinfo" in err_str:
            return False, "Network connection error reaching Google Gemini API. Please check server connectivity.", None
        return False, f"Key verification failed: {err_str[:120]}", None
