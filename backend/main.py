"""
Miami Alert Hub - backend (FastAPI)

Run locally:   uvicorn main:app --reload --port 8000
Run on the Pi: uvicorn main:app --host 0.0.0.0 --port 8000
Docs:          http://localhost:8000/docs

Without GEMINI_API_KEY the server runs in MOCK mode (fake AI results),
so the website and the speaker can be built before the AI part is ready.
"""
import os
import json
import threading
import urllib.error
import urllib.request
from typing import Optional
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env.local")
    load_dotenv()
except ImportError:
    pass

import core
from ai import GEMMA_MODEL, MOCK, analyze_report

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
PHOTO_DIR = DATA_DIR / "photos"
SITE_DIR = BASE_DIR.parent / "web" / "dist"  # Vite production website served at /
APP_DIR = BASE_DIR.parent / "app"          # web app (photo/text reports, map) -> served at /app
PHOTO_DIR.mkdir(parents=True, exist_ok=True)

ALERT_THRESHOLD = int(os.getenv("ALERT_THRESHOLD", "10"))   # reports needed to trigger an alert
ALERT_RADIUS_M = float(os.getenv("ALERT_RADIUS_M", "1000"))
ALERT_WINDOW_MIN = int(os.getenv("ALERT_WINDOW_MIN", "60"))
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.5"))
NOAA_STATION = os.getenv("NOAA_STATION", "8723214")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")                 # protects /api/reset and /api/alerts/test
MAX_PHOTO_MB = 10
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

store = core.Store(DATA_DIR / "db.json")


def verified_supabase_user(authorization: str):
    """Validate a bearer token with Supabase Auth; never trust client session state alone."""
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="missing bearer token")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="authentication is not configured")
    request = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            user = json.loads(response.read())
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError):
        raise HTTPException(status_code=401, detail="invalid or expired session") from None
    if not user.get("id"):
        raise HTTPException(status_code=401, detail="invalid session")
    return user


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


def resume_analyzing():
    """After a restart, re-run analysis for reports left in status "analyzing" (no gray pins stuck)."""
    mimes = {".png": "image/png", ".webp": "image/webp", ".heic": "image/heic"}
    for r in [r for r in store.data["reports"] if r.get("status") == "analyzing"]:
        img, mime = None, "image/jpeg"
        if r.get("photo_url"):
            p = PHOTO_DIR / Path(r["photo_url"]).name
            if p.exists():
                img, mime = p.read_bytes(), mimes.get(p.suffix, "image/jpeg")
        if img is None and not r.get("text"):
            store.update(r, status="failed", error="photo lost before analysis")
            continue
        process_report(r["id"], img, mime, r.get("text", ""))


app = FastAPI(title="Miami Alert Hub API")


@app.on_event("startup")
def _resume():
    threading.Thread(target=resume_analyzing, daemon=True).start()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True, "mock": MOCK, "model": GEMMA_MODEL,
            "alert_threshold": ALERT_THRESHOLD, "alert_radius_m": ALERT_RADIUS_M,
            "alert_window_min": ALERT_WINDOW_MIN}


@app.get("/api/auth/me")
def authenticated_user(authorization: str = Header(None)):
    user = verified_supabase_user(authorization)
    return {"id": user["id"], "email": user.get("email")}


@app.post("/api/reports")
def create_report(background: BackgroundTasks, lat: float = Form(...), lng: float = Form(...), area: str = Form(""),
                  text: str = Form(""), source: str = Form("neighbor"), reporter_id: str = Form(""),
                  photo: Optional[UploadFile] = File(None)):
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
        "text": text, "source": "camera" if source == "camera" else "neighbor",
        "reporter_id": reporter_id.strip()[:64], "photo_url": photo_url, "created_at": core.now_iso(),
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
if (APP_DIR / "index.html").exists():
    app.mount("/app", StaticFiles(directory=APP_DIR, html=True), name="app")
elif (SITE_DIR / "index.html").exists():
    @app.get("/app/{path:path}", include_in_schema=False)
    def app_spa(path: str):
        return FileResponse(SITE_DIR / "index.html")

if (SITE_DIR / "index.html").exists():
    @app.get("/login", include_in_schema=False)
    @app.get("/signup", include_in_schema=False)
    @app.get("/auth/confirm", include_in_schema=False)
    @app.get("/account", include_in_schema=False)
    @app.get("/reports", include_in_schema=False)
    @app.get("/reports/new", include_in_schema=False)
    @app.get("/alerts", include_in_schema=False)
    @app.get("/settings", include_in_schema=False)
    def auth_spa():
        return FileResponse(SITE_DIR / "index.html")
if SITE_DIR.exists():  # must stay last: serves the landing page for "/"
    app.mount("/", StaticFiles(directory=SITE_DIR, html=True), name="website")
