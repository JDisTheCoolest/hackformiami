"""
Miami Alert Hub - backend (FastAPI)

Run locally:   uvicorn main:app --reload --port 8000
Run on the Pi: uvicorn main:app --host 0.0.0.0 --port 8000
Docs:          http://localhost:8000/docs

Without GEMINI_API_KEY the server runs in MOCK mode (fake AI results),
so the website and the speaker can be built before the AI part is ready.
"""
import os
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
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
MAX_PHOTO_MB = 10
MOCK = not GEMINI_API_KEY

store = core.Store(DATA_DIR / "db.json")

_client = None
if not MOCK:
    from google import genai
    from google.genai import types
    _client = genai.Client(api_key=GEMINI_API_KEY)


def analyze_report(img: Optional[bytes], mime: str, text: str) -> dict:
    """Photo, text, or both -> one Gemma 4 call -> normalized analysis."""
    has_photo = img is not None
    if MOCK:
        return core.mock_analysis(len(store.data["reports"]))
    contents = []
    if has_photo:
        contents.append(types.Part.from_bytes(data=img, mime_type=mime))
    contents.append(core.build_prompt(text, has_photo))
    resp = _client.models.generate_content(
        model=GEMMA_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(temperature=0.2),
    )
    return core.normalize_analysis(core.parse_model_json(resp.text), has_photo)


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
def create_report(lat: float = Form(...), lng: float = Form(...), area: str = Form(""),
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

    try:
        analysis = analyze_report(img, mime, text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI analysis failed, please try again ({exc})")

    rid = core.new_id("r")
    photo_url = None
    if img is not None:
        ext = {"image/png": ".png", "image/webp": ".webp", "image/heic": ".heic"}.get(mime, ".jpg")
        (PHOTO_DIR / f"{rid}{ext}").write_bytes(img)
        photo_url = f"/photos/{rid}{ext}"

    report = {
        "id": rid, "lat": lat, "lng": lng, "area": area.strip()[:80],
        "text": text, "photo_url": photo_url, "created_at": core.now_iso(),
        "analysis": analysis, "mock": MOCK,
    }
    store.add_report(report)
    alert = core.maybe_create_alert(store, report, ALERT_THRESHOLD, ALERT_RADIUS_M,
                                    ALERT_WINDOW_MIN, MIN_CONFIDENCE)
    return {"report": report, "alert": alert}


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
