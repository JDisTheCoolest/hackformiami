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
import os
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

import requests

SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000").rstrip("/")
INTERVAL = max(10.0, float(os.getenv("INTERVAL", "10")))          # seconds; free Gemma tier has rate limits
PREVIEW_INTERVAL = max(1.0, float(os.getenv("PREVIEW_INTERVAL", "2")))
REPORTER_ID = os.getenv("REPORTER_ID", "pi-cam-1")
LAT = float(os.getenv("CAM_LAT", "25.7650"))            # where the camera is mounted
LNG = float(os.getenv("CAM_LNG", "-80.1880"))
AREA = os.getenv("CAM_AREA", "Brickell Bay Dr")
CAPTURE = os.getenv("CAPTURE", "auto")
CAM_DEVICE = os.getenv("CAM_DEVICE", "").strip()
VIDEO_ROOT = Path(os.getenv("VIDEO_DEVICE_ROOT", "/dev"))
FAILURE_LOG_INTERVAL = max(10.0, float(os.getenv("CAM_FAILURE_LOG_INTERVAL", "60")))
SKIP_UNCHANGED = os.getenv("SKIP_UNCHANGED", "1") == "1"  # don't resend an identical frame
ONCE = os.getenv("ONCE", "0") == "1"                      # take one photo and exit (testing)
SNAPSHOT_PATH = Path(os.getenv("CAMERA_SNAPSHOT_PATH", "/var/lib/hackformiami-hardware/latest.jpg"))
_capture_log = {"last": 0.0, "failed": False}


def video_devices(root: Path = VIDEO_ROOT) -> list[Path]:
    """Return stable V4L2 paths first, rediscovering devices after disconnects."""
    found: list[Path] = []
    configured = Path(CAM_DEVICE) if CAM_DEVICE else None
    if configured and configured.exists():
        found.append(configured)
    by_id = root / "v4l" / "by-id"
    if by_id.is_dir():
        found.extend(sorted(path for path in by_id.iterdir() if path.exists()))
    found.extend(sorted(root.glob("video*"), key=lambda p: (len(p.name), p.name)))
    unique: list[Path] = []
    seen: set[str] = set()
    for path in found:
        try:
            identity = str(path.resolve())
        except OSError:
            identity = str(path)
        if identity not in seen:
            seen.add(identity)
            unique.append(path)
    return unique


def capture_methods() -> list[str]:
    mode = CAPTURE.lower()
    if mode in ("usb", "v4l2"):
        return ["fswebcam", "opencv"]
    if mode in ("csi", "libcamera"):
        return ["rpicam", "libcam"]
    if mode != "auto":
        return [mode]
    # A detected V4L2 device is strong evidence of a USB webcam; do not probe CSI first.
    return ["fswebcam", "opencv", "rpicam", "libcam"] if video_devices() else ["rpicam", "libcam", "fswebcam", "opencv"]


def _log_capture_result(error: str | None) -> None:
    now = time.monotonic()
    if error:
        if not _capture_log["failed"] or now - _capture_log["last"] >= FAILURE_LOG_INTERVAL:
            print(f"Camera capture unavailable: {error}. Will keep retrying.", flush=True)
            _capture_log["last"] = now
        _capture_log["failed"] = True
    elif _capture_log["failed"]:
        print("Camera capture recovered.", flush=True)
        _capture_log["failed"] = False


def capture(path: Path) -> bool:
    """Capture a fresh JPEG. A prior file is removed so it can never become a fake frame."""
    errors: list[str] = []
    for m in capture_methods():
        devices = video_devices() if m in ("fswebcam", "opencv") else [None]
        if m in ("fswebcam", "opencv") and not devices:
            errors.append("no V4L2 devices found")
            continue
        for device in devices:
            try:
                path.unlink(missing_ok=True)
                if m == "rpicam" and shutil.which("rpicam-still"):
                    subprocess.run(["rpicam-still", "-n", "-t", "1000", "--width", "1280",
                                    "--height", "960", "-o", str(path)], check=True, capture_output=True)
                elif m == "libcam" and shutil.which("libcamera-still"):
                    subprocess.run(["libcamera-still", "-n", "-t", "1000", "--width", "1280",
                                    "--height", "960", "-o", str(path)], check=True, capture_output=True)
                elif m == "fswebcam" and shutil.which("fswebcam"):
                    subprocess.run(["fswebcam", "-q", "-d", str(device), "-r", "1280x960", "--no-banner", str(path)],
                                   check=True, capture_output=True)
                elif m == "opencv":
                    import cv2
                    cam = cv2.VideoCapture(str(device), cv2.CAP_V4L2)
                    try:
                        cam.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, 960)
                        ok, frame = False, None
                        for _ in range(5):
                            ok, frame = cam.read()
                    finally:
                        cam.release()
                    if not ok:
                        raise RuntimeError("V4L2 returned no frame")
                    if not cv2.imwrite(str(path), frame):
                        raise RuntimeError("JPEG encoding failed")
                else:
                    if m in ("rpicam", "libcam", "fswebcam"):
                        errors.append(f"{m} command is not installed")
                    continue
                if path.exists() and path.stat().st_size > 0:
                    _log_capture_result(None)
                    return True
            except Exception as exc:
                detail = getattr(exc, "stderr", b"")
                if isinstance(detail, bytes):
                    detail = detail.decode(errors="replace")
                errors.append(f"{m} on {device or 'CSI'}: {str(detail or exc).strip()[:160]}")
    path.unlink(missing_ok=True)
    _log_capture_result("; ".join(errors[-4:]) or "no supported camera backend found")
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


def send(image: bytes) -> None:
    resp = requests.post(
        f"{SERVER_URL}/api/reports",
        data={"lat": LAT, "lng": LNG, "area": AREA,
              "source": "camera", "reporter_id": REPORTER_ID},
        files={"photo": ("camera.jpg", image, "image/jpeg")},
        timeout=60,
    )
    if resp.status_code != 200:
        print(f"server answered {resp.status_code}: {resp.text[:200]}")
        return
    # Local, authenticated camera classification for possible physical fights.
    token = os.getenv("ADMIN_TOKEN", "")
    if token:
        try:
            f = requests.post(f"{SERVER_URL}/api/camera/fight",
                files={"photo": ("camera.jpg", image, "image/jpeg")},
                headers={"X-Admin-Token": token}, timeout=60)
            if f.ok:
                result = f.json()
                print("Fight AI:",result,flush=True)
                if result.get("announced"): print("Possible fight alert queued for speaker",flush=True)
            else:
                print("Fight classifier returned", f.status_code, f.text[:200],flush=True)
        except requests.RequestException as exc:
            print("Fight classifier unavailable:", exc,flush=True)
    else:
        print("Fight AI skipped: no ADMIN_TOKEN in camera service",flush=True)
    body = resp.json()
    print("Submitted camera report:", body.get("report", {}).get("id"), "- AI analysis queued")


def publish_snapshot(image: bytes) -> None:
    """Atomically publish a complete frame for FastAPI readers."""
    target = SNAPSHOT_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".tmp")
    tmp.write_bytes(image)
    tmp.chmod(0o644)
    tmp.replace(target)


def capture_frame(path: Path) -> bytes | None:
    """Capture and publish only a newly produced frame; failures return no AI input."""
    if not capture(path):
        return None
    try:
        image = path.read_bytes()
        if not image:
            return None
        publish_snapshot(image)
        return image
    except OSError as exc:
        _log_capture_result(f"could not publish snapshot: {exc}")
        return None


def main():
    print(f"Camera {REPORTER_ID} at {AREA} ({LAT}, {LNG}) -> preview every {PREVIEW_INTERVAL:.0f}s; AI every {INTERVAL:.0f}s")
    last_hash = None
    last_analysis = 0.0
    analysis_thread = None
    shot = Path(tempfile.gettempdir()) / "miami_alert_cam.jpg"
    while True:
        started = time.time()
        image = capture_frame(shot)
        if image:
            due = time.monotonic() - last_analysis >= INTERVAL
            busy = analysis_thread is not None and analysis_thread.is_alive()
            if image and due and not busy:
                last_analysis = time.monotonic()
                if not ai_enabled():
                    print("Camera AI paused; preview remains active, zero model calls", flush=True)
                else:
                    digest = hashlib.sha256(image).hexdigest()
                    if SKIP_UNCHANGED and digest == last_hash:
                        print("frame unchanged, skipped")
                    else:
                        last_hash = digest
                        def analyze(frame=image):
                            try:
                                send(frame)
                            except requests.RequestException as exc:
                                print("server not reachable:", exc)
                        analysis_thread = threading.Thread(target=analyze, daemon=True)
                        analysis_thread.start()
        if ONCE:
            if analysis_thread is not None:
                analysis_thread.join()
            break
        time.sleep(max(0.1, PREVIEW_INTERVAL - (time.time() - started)))


if __name__ == "__main__":
    main()
