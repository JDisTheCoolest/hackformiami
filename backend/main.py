"""
Miami Alert Hub - backend (FastAPI)

Run locally:   uvicorn main:app --reload --port 8000
Run on the Pi: uvicorn main:app --host 0.0.0.0 --port 8000
Docs:          http://localhost:8000/docs

Without GEMINI_API_KEY the server runs in MOCK mode (fake AI results),
so the website and the speaker can be built before the AI part is ready.
"""
import io
import logging
import os
import time
from typing import Optional
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import core

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PHOTO_DIR = DATA_DIR / "photos"
SITE_DIR = BASE_DIR.parent / "website"     # landing page (Magzhan) -> served at /
APP_DIR = BASE_DIR.parent / "app"          # web app (photo/text reports, map) -> served at /app
PHOTO_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMMA_MODEL = os.getenv("GEMMA_MODEL", "gemma-4-31b-it")   # or gemma-4-26b-a4b-it (faster)
ALERT_THRESHOLD = int(os.getenv("ALERT_THRESHOLD", "3"))   # reports needed to trigger an alert
ALERT_RADIUS_M = float(os.getenv("ALERT_RADIUS_M", "1000"))
ALERT_WINDOW_MIN = int(os.getenv("ALERT_WINDOW_MIN", "60"))
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.5"))
NOAA_STATION = os.getenv("NOAA_STATION", "8723214")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")                 # protects /api/reset and /api/alerts/test
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "gemma-4-26b-a4b-it")
FLASH_MODEL = os.getenv("FLASH_MODEL", "")   # optional non-Gemma last resort, e.g. gemini-3.5-flash-lite; off = Gemma 4 only
MODEL_TIMEOUT_S = int(os.getenv("MODEL_TIMEOUT_S", "20"))          # per attempt; gemma-4-31b can hang
MAX_IMAGE_PX = 1024
MAX_PHOTO_MB = 10
MOCK = not GEMINI_API_KEY

store = core.Store(DATA_DIR / "db.json")

_client = None
if not MOCK:
    from google import genai
    from google.genai import types
    _client = genai.Client(api_key=GEMINI_API_KEY)


log = logging.getLogger("uvicorn.error")


def shrink(img: bytes, mime: str):
    """Downscale to max 1024px JPEG: less to upload, faster for the model."""
    try:
        from PIL import Image, ImageOps
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(img)))
        im.thumbnail((MAX_IMAGE_PX, MAX_IMAGE_PX))
        out = io.BytesIO()
        im.convert("RGB").save(out, "JPEG", quality=85)
        return out.getvalue(), "image/jpeg"
    except Exception:  # e.g. HEIC without a decoder: send the original
        return img, mime


def call_model(model: str, parts: list) -> dict:
    # Gemma 4 only accepts thinkingLevel "minimal"; the SDK has no field for it, so use extra_body.
    extra = {"generationConfig": {"thinkingConfig": {"thinkingLevel": "minimal"}}} if model.startswith("gemma") else None
    cfg = types.GenerateContentConfig(
        temperature=0.2,
        http_options=types.HttpOptions(timeout=MODEL_TIMEOUT_S * 1000, extra_body=extra))
    resp = _client.models.generate_content(model=model, contents=parts, config=cfg)
    return core.parse_model_json(resp.text)


def analyze_report(img: Optional[bytes], mime: str, text: str) -> dict:
    """Photo, text, or both -> Gemma 4 (retry, then fallbacks) -> normalized analysis."""
    has_photo = img is not None
    if MOCK:
        return core.mock_analysis(len(store.data["reports"]))
    parts = []
    if has_photo:
        img, mime = shrink(img, mime)
        parts.append(types.Part.from_bytes(data=img, mime_type=mime))
    parts.append(core.build_prompt(text, has_photo))
    last = None
    for model in filter(None, (GEMMA_MODEL, GEMMA_MODEL, FALLBACK_MODEL, FLASH_MODEL)):
        t0 = time.time()
        try:
            analysis = core.normalize_analysis(call_model(model, parts), has_photo)
            analysis["model"] = model
            log.info("analysis ok model=%s %.1fs", model, time.time() - t0)
            return analysis
        except Exception as exc:
            last = exc
            log.warning("analysis failed model=%s %.1fs: %s", model, time.time() - t0, str(exc)[:120])
    raise last


def process_report(rid: str, img: Optional[bytes], mime: str, text: str):
    """Background task: analyze, update the stored report, then run the alert check."""
    report = next((r for r in store.data["reports"] if r["id"] == rid), None)
    if report is None:  # /api/reset ran meanwhile
        return
    try:
        analysis = analyze_report(img, mime, text)
    except Exception as exc:
        store.update(report, status="failed", error=str(exc)[:300])
        return
    store.update(report, status="done", analysis=analysis)
    core.maybe_create_alert(store, report, ALERT_THRESHOLD, ALERT_RADIUS_M,
                            ALERT_WINDOW_MIN, MIN_CONFIDENCE)


def check_admin(token):
    if ADMIN_TOKEN and token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="bad admin token")


app = FastAPI(title="Miami Alert Hub API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True, "mock": MOCK, "model": GEMMA_MODEL,
            "alert_threshold": ALERT_THRESHOLD, "alert_radius_m": ALERT_RADIUS_M,
            "alert_window_min": ALERT_WINDOW_MIN}


@app.post("/api/reports")
def create_report(background: BackgroundTasks, lat: float = Form(...), lng: float = Form(...), area: str = Form(""),
                  text: str = Form(""), photo: Optional[UploadFile] = File(None)):
    """A report = photo, text, or both (voice: the app turns speech into text first)."""
    text = text.strip()[:1000]
    img, mime = None, "image/jpeg"
    if photo is not None and photo.filename:
        mime = photo.content_type or "image/jpeg"
        if not mime.startswith("image/"):
            raise HTTPException(status_code=400, detail="file must be an image")
        img = photo.file.read()
        if len(img) > MAX_PHOTO_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"photo larger than {MAX_PHOTO_MB} MB")
    if img is None and not text:
        raise HTTPException(status_code=400, detail="send a photo, a text, or both")

    rid = core.new_id("r")
    photo_url = None
    if img is not None:
        ext = {"image/png": ".png", "image/webp": ".webp", "image/heic": ".heic"}.get(mime, ".jpg")
        (PHOTO_DIR / f"{rid}{ext}").write_bytes(img)
        photo_url = f"/photos/{rid}{ext}"

    report = {
        "id": rid, "lat": lat, "lng": lng, "area": area.strip()[:80],
        "text": text, "photo_url": photo_url, "created_at": core.now_iso(),
        "status": "analyzing", "analysis": None, "mock": MOCK,
    }
    store.add_report(report)
    background.add_task(process_report, rid, img, mime, text)
    return {"report": report, "alert": None}


@app.get("/api/reports")
def list_reports(hours: int = 24):
    from datetime import datetime, timedelta
    cutoff = datetime.now(core.MIAMI_TZ) - timedelta(hours=hours)
    items = [r for r in store.data["reports"] if core.parse_iso(r["created_at"]) >= cutoff]
    return list(reversed(items))


@app.get("/api/alerts")
def list_alerts():
    return list(reversed(store.data["alerts"]))


@app.get("/api/alerts/latest")
def latest_alert():
    alerts = store.data["alerts"]
    return {"alert": alerts[-1] if alerts else None}


@app.post("/api/alerts/test")
def test_alert(type: str = "flood", area: str = "", x_admin_token: str = Header(None)):
    check_admin(x_admin_token)
    return {"alert": core.make_test_alert(store, type, area)}


@app.get("/api/tide")
def tide():
    return core.get_tide(NOAA_STATION)


@app.post("/api/reset")
def reset(x_admin_token: str = Header(None)):
    check_admin(x_admin_token)
    store.reset()
    return {"ok": True}


app.mount("/photos", StaticFiles(directory=PHOTO_DIR), name="photos")
if APP_DIR.exists():
    app.mount("/app", StaticFiles(directory=APP_DIR, html=True), name="app")
if SITE_DIR.exists():  # must stay last: serves the landing page for "/"
    app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="website")
