import json
import pytest
from app.services.gemini_extractor import repair_truncated_json, clean_json_text

def test_clean_json_text_removes_markdown():
    wrapped = "```json\n{\"foo\": \"bar\"}\n```"
    assert clean_json_text(wrapped) == '{"foo": "bar"}'

def test_repair_truncated_json_already_valid():
    valid = '{"title": "Demo", "count": 42}'
    assert repair_truncated_json(valid) == valid

def test_repair_truncated_json_mid_string():
    truncated = '{"title": "Demo Video", "chapters": [{"title": "Intro", "summary": "Discussing neural nets'
    repaired = repair_truncated_json(truncated)
    parsed = json.loads(repaired)
    assert parsed["title"] == "Demo Video"
    assert len(parsed["chapters"]) == 1
    assert parsed["chapters"][0]["title"] == "Intro"

def test_repair_truncated_json_dangling_comma():
    truncated = '{"items": ["item1", "item2", '
    repaired = repair_truncated_json(truncated)
    parsed = json.loads(repaired)
    assert parsed["items"] == ["item1", "item2"]

def test_repair_truncated_json_nested_objects():
    truncated = '{"metadata": {"duration": 120.0, "details": {"source": "youtube'
    repaired = repair_truncated_json(truncated)
    parsed = json.loads(repaired)
    assert parsed["metadata"]["duration"] == 120.0
    assert "source" in parsed["metadata"]["details"]
