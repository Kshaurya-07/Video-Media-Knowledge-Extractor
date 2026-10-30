import time
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.model_discovery_service import (
    discover_available_models,
    blacklist_failed_model,
    assess_model_compatibility,
    invalidate_model_cache,
    get_active_model_selection,
    get_model_status_payload,
    get_key_hash,
    _MODEL_CACHE,
    ModelCacheEntry,
)

client = TestClient(app)

class MockModelItem:
    def __init__(self, name: str, supported_actions=None, input_tokens=1048576, output_tokens=8192, display_name=None):
        self.name = name
        self.display_name = display_name or name
        self.description = "Test model description"
        self.supported_actions = supported_actions or ["generateContent"]
        self.input_token_limit = input_tokens
        self.output_token_limit = output_tokens

def test_assess_model_compatibility_filters_incompatible():
    """Verify non-video and non-generative models are properly excluded."""
    # 1. Embedding model
    is_compat, reason, score = assess_model_compatibility("text-embedding-004", ["embedContent"], 2048, set())
    assert not is_compat
    assert "embedding" in reason.lower()

    # 2. Image generation model
    is_compat, reason, score = assess_model_compatibility("imagen-3.0-generate-002", ["generateImages"], 2048, set())
    assert not is_compat
    assert "imagen" in reason.lower()

    # 3. Incompatible/Fictional 3.8-flash model
    is_compat, reason, score = assess_model_compatibility("gemini-3.8-flash", ["generateContent"], 1048576, set())
    assert not is_compat
    assert "incompatible" in reason.lower()

    # 4. Valid 2.0 Flash model (Top priority tier 1000)
    is_compat, reason, score = assess_model_compatibility("gemini-2.0-flash", ["generateContent"], 1048576, set())
    assert is_compat
    assert score == 1000

    # 5. Valid 1.5 Flash model (High-quota tier 900)
    is_compat, reason, score = assess_model_compatibility("gemini-1.5-flash", ["generateContent"], 1048576, set())
    assert is_compat
    assert score == 900

    # 6. Valid 1.5 Pro model (Reasoning fallback tier 700)
    is_compat, reason, score = assess_model_compatibility("gemini-1.5-pro", ["generateContent"], 2097152, set())
    assert is_compat
    assert score == 700

def test_model_discovery_pagination():
    """Verify discovery iterates through multiple pages from official SDK pager."""
    page_1 = [
        MockModelItem("models/gemini-1.5-flash", ["generateContent"]),
        MockModelItem("models/text-embedding-004", ["embedContent"]),
    ]
    page_2 = [
        MockModelItem("models/gemini-2.0-flash", ["generateContent"]),
        MockModelItem("models/imagen-3.0", ["generateImages"]),
    ]

    mock_client = MagicMock()
    # Pager iterable yields all items across pages
    mock_client.models.list.return_value = iter(page_1 + page_2)

    entry = discover_available_models(mock_client, "test_pager_key", force_refresh=True)
    assert entry.status == "connected"
    assert len(entry.discovered_models) == 4
    assert len(entry.compatible_models) == 2
    # Gemini 2.0 Flash scored highest (1000 vs 900), so it must be selected
    assert entry.selected_model == "gemini-2.0-flash"
    assert entry.selection_mode == "automatic"

def test_model_discovery_caching_and_ttl():
    """Verify cache prevents redundant API calls and refreshes when invalidated."""
    mock_client = MagicMock()
    mock_client.models.list.return_value = [
        MockModelItem("models/gemini-2.0-flash", ["generateContent"]),
    ]

    test_key = "cache_test_key_123"
    invalidate_model_cache(test_key)

    # First call triggers list API
    entry1 = discover_available_models(mock_client, test_key, force_refresh=False)
    assert mock_client.models.list.call_count == 1

    # Second call uses cache within TTL
    entry2 = discover_available_models(mock_client, test_key, force_refresh=False)
    assert mock_client.models.list.call_count == 1
    assert entry1.timestamp == entry2.timestamp

    # Force refresh makes a new call
    discover_available_models(mock_client, test_key, force_refresh=True)
    assert mock_client.models.list.call_count == 2

def test_blacklist_failed_model_fallback():
    """Verify blacklisting a failing model evicts it and falls back to next best candidate."""
    mock_client = MagicMock()
    mock_client.models.list.return_value = [
        MockModelItem("models/gemini-2.0-flash", ["generateContent"]),
        MockModelItem("models/gemini-1.5-flash", ["generateContent"]),
        MockModelItem("models/gemini-1.5-pro", ["generateContent"]),
    ]

    test_key = "fallback_test_key_456"
    entry = discover_available_models(mock_client, test_key, force_refresh=True)
    assert entry.selected_model == "gemini-2.0-flash"

    # Simulate runtime 503 Overloaded on gemini-2.0-flash
    next_model = blacklist_failed_model("gemini-2.0-flash", api_key=test_key, reason="503 Model Overloaded")
    assert next_model == "gemini-1.5-flash"
    assert entry.selected_model == "gemini-1.5-flash"
    assert entry.selection_mode == "fallback"
    assert "gemini-2.0-flash" in entry.blacklisted_models

    # Simulate another failure on gemini-1.5-flash
    next_model2 = blacklist_failed_model("gemini-1.5-flash", api_key=test_key, reason="503 Service Unavailable")
    assert next_model2 == "gemini-1.5-pro"
    assert entry.selected_model == "gemini-1.5-pro"

def test_api_cache_refresh_endpoint():
    """Verify POST /api/system/model-cache/refresh triggers cache eviction and returns fresh status."""
    response = client.post("/api/system/model-cache/refresh")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "Google Gemini"
    assert "selected_model" in data
    assert "display_model" in data
    assert "selection_mode" in data
    assert "last_checked" in data
    assert "candidate_models" in data
