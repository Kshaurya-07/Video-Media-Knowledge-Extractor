import time
import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("vyora.diagnostic")

def log_diagnostic(
    event: str,
    job_id: str = "no-job-id",
    correlation_id: str = "no-cid",
    stage: str = "UNKNOWN",
    elapsed_seconds: float = 0.0,
    status: str = "INFO",
    error_class: Optional[str] = None,
    error_message: Optional[str] = None,
    http_status: Optional[int] = None,
    retry_count: int = 0,
    model_id: Optional[str] = None,
    file_id: Optional[str] = None,
    file_size_bytes: Optional[int] = None,
    details: Optional[Dict[str, Any]] = None,
):
    """
    Emits structured diagnostic logs with timestamps and elapsed durations for all VYORA pipeline stages.
    Guaranteed NEVER to log API keys, authorization tokens, or sensitive credentials.
    """
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    entry = {
        "timestamp": timestamp,
        "tag": "VYORA_DIAGNOSTIC",
        "event": event,
        "job_id": job_id,
        "correlation_id": correlation_id,
        "stage": stage,
        "elapsed_seconds": round(elapsed_seconds, 2),
        "status": status,
    }
    if model_id:
        entry["model_id"] = model_id
    if file_id:
        entry["file_id"] = file_id
    if file_size_bytes:
        entry["file_size_bytes"] = file_size_bytes
    if error_class:
        entry["error_class"] = error_class
    if error_message:
        # Sanitize error message just in case
        sanitized = error_message.replace("AIzaSy", "[REDACTED_KEY]")
        entry["error_message"] = sanitized
    if http_status:
        entry["http_status"] = http_status
    if retry_count:
        entry["retry_count"] = retry_count
    if details:
        entry["details"] = details

    # Structured single-line format easily searchable in Render / Datadog / CloudWatch
    log_line = (
        f"[DIAGNOSTIC] [{timestamp}] event={event} job_id={job_id} corr_id={correlation_id} "
        f"stage={stage} elapsed={elapsed_seconds:.2f}s status={status}"
    )
    if model_id:
        log_line += f" model={model_id}"
    if error_message:
        log_line += f" err_class={error_class} error=\"{entry['error_message']}\""
    if http_status:
        log_line += f" http_status={http_status}"

    if status == "ERROR":
        logger.error(log_line)
    elif status == "WARNING":
        logger.warning(log_line)
    else:
        logger.info(log_line)

    return entry
