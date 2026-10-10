# Hardware (JD) — Raspberry Pi camera + speaker

Both scripts only talk to the backend API (`backend/API.md`). They do **not** need
the app or the website — start them as soon as the backend runs.

## camera.py — street camera ("a neighbor that never sleeps")
Takes a photo every 60 s and sends it to `POST /api/reports` with
`source=camera` and `reporter_id=pi-cam-1`. Gemma 4 analyzes it like any neighbor's photo.
```bash
pip install requests
SERVER_URL=http://localhost:8000 CAM_LAT=25.7650 CAM_LNG=-80.1880 CAM_AREA="Brickell Bay Dr" \
  ONCE=1 python3 hardware/camera.py      # one test shot
SERVER_URL=http://localhost:8000 python3 hardware/camera.py   # run forever
```
Works with the Pi Camera Module (`rpicam-still` / `libcamera-still`), a USB webcam
(`fswebcam`) or OpenCV. Force one with `CAPTURE=rpicam|libcam|fswebcam|opencv`.
Demo: point it at a screen showing a flooded street.

## speaker.py — alert speaker + LEDs
Polls `GET /api/alerts/latest` every 5 s. New alert → siren + reads it in EN / ES / HT.
LEDs (GPIO 17/27/22): green = clear, yellow = king tide risk, red = active alert.
```bash
sudo apt install -y espeak-ng alsa-utils
pip install requests gpiozero
SERVER_URL=http://localhost:8000 python3 hardware/speaker.py
espeak-ng --voices | grep -E " (en|es|ht)"   # if no "ht" voice: SPEAK_LANGS=en,es
```
Test without waiting for real reports: `curl -X POST http://localhost:8000/api/alerts/test`

## Alert rule (backend)
3 independent sources (distinct `reporter_id`) reporting the same hazard within 1 km / 60 min.
One camera = one source, so the camera alone never triggers an alert.
