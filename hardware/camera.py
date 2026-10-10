"""
Miami Alert Hub - street camera for Raspberry Pi (JD).

Every INTERVAL seconds: take a photo -> POST /api/reports as source=camera.
The backend runs Gemma 4 on it exactly like a photo from a neighbor.
One camera counts as ONE source for alerts (reporter_id), so it can't
trigger an alert alone - it needs neighbors (or other cameras) to agree.

Run:
    pip install requests
    SERVER_URL=http://localhost:8000 CAM_LAT=25.7650 CAM_LNG=-80.1880 \
    CAM_AREA="Brickell Bay Dr" python3 camera.py

Camera backends tried in order (set CAPTURE=... to force one):
    rpicam  -> rpicam-still   (Pi Camera Module, Raspberry Pi OS Bookworm)
    libcam  -> libcamera-still (older Raspberry Pi OS)
    fswebcam -> USB webcam     (sudo apt install fswebcam)
    opencv  -> any webcam      (pip install opencv-python-headless)
Demo tip: point the camera at a laptop/phone screen showing a flooded street.
"""
import hashlib
import urllib.parse
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import requests

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000").rstrip("/")
INTERVAL = max(10.0, float(os.getenv("INTERVAL", "10")))          # seconds; free Gemma tier has rate limits
REPORTER_ID = os.getenv("REPORTER_ID", "pi-cam-1")
LAT = float(os.getenv("CAM_LAT", "25.7650"))            # where the camera is mounted
LNG = float(os.getenv("CAM_LNG", "-80.1880"))
AREA = os.getenv("CAM_AREA", "Brickell Bay Dr")
CAPTURE = os.getenv("CAPTURE", "auto")
SKIP_UNCHANGED = os.getenv("SKIP_UNCHANGED", "1") == "1"  # don't resend an identical frame
ONCE = os.getenv("ONCE", "0") == "1"                      # take one photo and exit (testing)


def capture(path: Path) -> bool:
    """Take one JPEG photo into `path`. Returns True on success."""
    methods = [CAPTURE] if CAPTURE != "auto" else ["rpicam", "libcam", "fswebcam", "opencv"]
    for m in methods:
        try:
            if m == "rpicam" and shutil.which("rpicam-still"):
                subprocess.run(["rpicam-still", "-n", "-t", "1000", "--width", "1280",
                                "--height", "960", "-o", str(path)], check=True, capture_output=True)
            elif m == "libcam" and shutil.which("libcamera-still"):
                subprocess.run(["libcamera-still", "-n", "-t", "1000", "--width", "1280",
                                "--height", "960", "-o", str(path)], check=True, capture_output=True)
            elif m == "fswebcam" and shutil.which("fswebcam"):
                subprocess.run(["fswebcam", "-q", "-r", "1280x960", "--no-banner", str(path)],
                               check=True, capture_output=True)
            elif m == "opencv":
                import cv2
                cam = cv2.VideoCapture(int(os.getenv("CAM_INDEX", "0")))
                for _ in range(5):              # let auto-exposure settle
                    ok, frame = cam.read()
                cam.release()
                if not ok:
                    continue
                cv2.imwrite(str(path), frame)
            else:
                continue
            if path.exists() and path.stat().st_size > 0:
                return True
        except Exception as exc:
            print(f"capture with {m} failed: {exc}")
    return False


def ai_enabled() -> bool:
    # Re-read every cycle so the GUI can pause paid analysis without restarting.
    try:
        settings = Path("/etc/hackformiami/hardware.env").read_text()
        for line in settings.splitlines():
            if line.startswith("CAM_AI_ENABLED="):
                return line.partition("=")[2].strip().lower() in ("1", "yes", "true", "on")
    except OSError:
        pass
    return False


def send(path: Path) -> None:
    with path.open("rb") as f:
        resp = requests.post(
            f"{SERVER_URL}/api/reports",
            data={"lat": LAT, "lng": LNG, "area": AREA,
                  "source": "camera", "reporter_id": REPORTER_ID},
            files={"photo": (path.name, f, "image/jpeg")},
            timeout=60,
        )
    if resp.status_code != 200:
        print(f"server answered {resp.status_code}: {resp.text[:200]}")
        return
    # Local, authenticated camera classification for possible physical fights.
    token = os.getenv("ADMIN_TOKEN", "")
    if token:
        with path.open("rb") as frame:
            try:
                f = requests.post(f"{SERVER_URL}/api/camera/fight",
                    files={"photo": (path.name, frame, "image/jpeg")},
                    headers={"X-Admin-Token": token}, timeout=60)
                if f.ok and f.json().get("announced"):
                    print("Possible fight alert queued for speaker")
                elif not f.ok:
                    print("Fight classifier returned", f.status_code)
            except requests.RequestException as exc:
                print("Fight classifier unavailable:", exc)
    body = resp.json()
    print("Submitted camera report:", body.get("report", {}).get("id"), "- AI analysis queued")


def main():
    print(f"Camera {REPORTER_ID} at {AREA} ({LAT}, {LNG}) -> {SERVER_URL} every {INTERVAL:.0f}s")
    last_hash = None
    shot = Path(tempfile.gettempdir()) / "miami_alert_cam.jpg"
    while True:
        started = time.time()
        if not ai_enabled():
            print("Camera AI paused; no photos uploaded, no model calls", flush=True)
        elif capture(shot):
            digest = hashlib.sha256(shot.read_bytes()).hexdigest()
            if SKIP_UNCHANGED and digest == last_hash:
                print("frame unchanged, skipped")
            else:
                last_hash = digest
                try:
                    send(shot)
                except requests.RequestException as exc:
                    print("server not reachable:", exc)
        else:
            print("no camera found - check the cable / CAPTURE setting")
        if ONCE:
            break
        time.sleep(max(1.0, INTERVAL - (time.time() - started)))


if __name__ == "__main__":
    main()
