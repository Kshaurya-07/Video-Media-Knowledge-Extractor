import httpx
import time
import json
import sys

BASE_URL = "https://vyora-backend-whzy.onrender.com"

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)

def test_live_production():
    client = httpx.Client(timeout=60.0)

    # 1. Health Check
    log("--> STEP 1: Probing Production Health Endpoint...")
    res = client.get(f"{BASE_URL}/api/health")
    log(f"Status Code: {res.status_code}")
    log(f"Health Response: {res.text}")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    assert health_data["status"] == "healthy"

    # 2. Ingest Public YouTube Video
    log("\n--> STEP 2: Ingesting Public YouTube Video...")
    yt_payload = {
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up"
    }
    res = client.post(f"{BASE_URL}/api/ingest/url", json=yt_payload)
    log(f"Ingest Status: {res.status_code}")
    log(f"Ingest Response: {res.text}")
    assert res.status_code == 200, f"YouTube Ingestion failed: {res.text}"
    yt_data = res.json()
    yt_file_id = yt_data["file_id"]
    log(f"Registered YouTube File ID: {yt_file_id}")

    # 3. Upload Real MP4 Video
    log("\n--> STEP 3: Uploading Real MP4 Video (backend/samples/big_buck_bunny.mp4)...")
    with open("backend/samples/big_buck_bunny.mp4", "rb") as f:
        files = {"file": ("big_buck_bunny.mp4", f, "video/mp4")}
        res = client.post(f"{BASE_URL}/api/upload", files=files)
    log(f"Upload Status: {res.status_code}")
    log(f"Upload Response: {res.text}")
    assert res.status_code == 200, f"MP4 Upload failed: {res.text}"
    mp4_meta = res.json()
    mp4_file_id = mp4_meta["file_id"]
    log(f"Uploaded MP4 File ID: {mp4_file_id} (Inspected Duration: {mp4_meta.get('duration_formatted')} / {mp4_meta.get('duration_seconds')}s)")

    # 4. Trigger Gemini Extraction on Uploaded MP4
    log(f"\n--> STEP 4: Starting Processing Job for MP4 file_id={mp4_file_id}...")
    start_payload = {"file_id": mp4_file_id}
    res = client.post(f"{BASE_URL}/api/process/start", json=start_payload)
    log(f"Start Status: {res.status_code}")
    log(f"Start Response: {res.text}")
    assert res.status_code == 200, f"Start job failed: {res.text}"
    job_info = res.json()
    job_id = job_info["job_id"]
    log(f"Job ID: {job_id}")

    # 5. Poll Job Status Transitions
    log("\n--> STEP 5: Polling Job Status Transitions...")
    last_stage = None
    max_wait = 180
    start_time = time.time()
    final_job = None

    while time.time() - start_time < max_wait:
        res = client.get(f"{BASE_URL}/api/jobs/{job_id}")
        if res.status_code == 200:
            job = res.json()
            stage = job.get("stage")
            pct = job.get("progress_percent")
            msg = job.get("message")
            model = job.get("selected_model")

            if stage != last_stage:
                log(f"[STAGE TRANSITION] {stage} ({pct}%) - Model: {model} - {msg}")
                last_stage = stage
            else:
                log(f"  ... {stage} ({pct}%) - {msg}")

            if stage in ("COMPLETED", "FAILED"):
                final_job = job
                break
        else:
            log(f"Poll warning: HTTP {res.status_code} {res.text}")

        time.sleep(3)

    log(f"\nFinal Job Status: {json.dumps(final_job, indent=2)}")

    # 6. Retrieve Extracted Project Knowledge
    log(f"\n--> STEP 6: Retrieving Project Knowledge for project_id={mp4_file_id}...")
    res = client.get(f"{BASE_URL}/api/projects/{mp4_file_id}")
    log(f"Project Query Status: {res.status_code}")
    if res.status_code == 200:
        proj_data = res.json()
        log(f"Title: {proj_data.get('title')}")
        log(f"Duration: {proj_data.get('duration_formatted')}")
        log(f"Summary: {proj_data.get('overview')}")
        log(f"Key Takeaways: {proj_data.get('key_takeaways')}")
        log(f"Chapter Count: {len(proj_data.get('chapters', []))}")
        for idx, ch in enumerate(proj_data.get('chapters', [])[:5]):
            log(f"  Chapter {idx+1}: [{ch.get('start_time_formatted')} - {ch.get('end_time_formatted')}] {ch.get('title')}: {ch.get('summary')}")
    else:
        log(f"Project query response: {res.text}")

if __name__ == "__main__":
    test_live_production()
