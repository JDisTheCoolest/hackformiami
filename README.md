# 4forces — Hack for Miami

**4forces** is a Raspberry Pi-hosted community hazard-reporting and experimental camera-monitoring project built for Hack for Miami. The public website is deployed at **https://4forces.app**. Its theme, **Four Forces, One City**, covers water, air, land, and fire risks around Miami.

> **Project status:** Prototype. Camera person detection, pose estimation, and possible-fight alerts are experimental. This is not a certified emergency detection, dispatch, or evacuation system. AI can miss events or produce false alarms.

## Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | **React 19, TypeScript 6, Vite 8** | Website and authenticated camera dashboard |
| Interface | **Tailwind CSS 4, Lucide React, Inter Tight, clsx, tailwind-merge** | Styling, icons, typography, conditional classes |
| Navigation | **React Router 7** | Frontend routes |
| Maps | **Leaflet** | Location-oriented visualizations |
| Authentication | **Supabase JS / Supabase Auth** | Login and validated API camera access |
| Backend | **Python, FastAPI, Uvicorn, python-multipart** | Reports, alerts, camera APIs, streaming |
| AI API | **Google GenAI Python SDK; Gemma models** | Image/report interpretation and sampled-frame possible-fight classification |
| Image processing | **Pillow, OpenCV, NumPy** | Image resizing, capture and local computer vision |
| Local person model (fallback) | **MobileNet-SSD / OpenCV DNN (Caffe)** | Local person-class detection |
| Optional local pose model | **Ultralytics YOLO11n-pose, PyTorch CPU** | Local person boxes and body keypoints |
| Temporary tracking | **Custom Python centroid association** | Short-lived person IDs and rolling frame history |
| Camera | **USB V4L2/OpenCV**, with **fswebcam, rpicam-still, libcamera-still** fallbacks | Raspberry Pi video/frame capture |
| Live preview | **JPEG snapshots and MJPEG over HTTP** | Authenticated camera stream |
| Speaker | **eSpeak NG, paplay, PipeWire/PulseAudio** | Speech alerts using the desktop user's default audio sink, including Bluetooth |
| Optional indicators | **gpiozero** | GPIO LEDs, if connected and configured |
| Hosting | **Raspberry Pi Linux, systemd services, Cloudflare Tunnel** | Run web/API and camera/speaker processes on the Pi and expose the website |
| Management | **Tkinter, pkexec / narrowly scoped privileged helper** | Private native desktop hardware controls |
| Development/testing | **npm, ESLint, Playwright, Git/GitHub** | Building, linting, testing and deployment |

The web dependency versions are declared in [web/package.json](web/package.json). Python API dependencies are in [backend/requirements.txt](backend/requirements.txt). Hardware packages and optional pose dependencies are installed by the scripts in [deploy/](deploy/).

## AI and camera pipeline

1. The Pi captures camera frames locally. Camera capture FPS and tracking intervals are configurable; configured rates are targets, not measured inference throughput.
2. The local detector identifies candidate people. The optional **YOLO11n-pose** backend produces body-joint coordinates; if unavailable, the code falls back to **MobileNet-SSD**.
3. A custom tracker associates nearby bounding boxes across frames, assigns **temporary session-only IDs**, and retains a short rolling image buffer **in RAM**. IDs are **not** face recognition and can change after occlusion.
4. Rapid movements of nearby tracked people are **review candidates**, not proof of violence. The current code does **not** include a trained and validated temporal fight-classification model or ByteTrack.
5. Independently, when cloud camera AI is enabled, sampled frames can be sent to the backend for Gemma report/fight classification. The fight API requires two positive classifications within its configured time window before creating an unverified possible-fight alert, with a cooldown.
6. The speaker service polls for alerts and uses eSpeak NG through the **logged-in user's default audio device**. The authenticated dashboard displays live video and tracking boxes.

**Important:** Local pose/movement candidates do **not currently** automatically trigger a high-confidence fight alarm. No benchmarked fight-detection accuracy, latency, or guaranteed frame rate is claimed. Cloud model calls may consume quota; cloud camera AI can be paused separately from live preview.

## Application architecture

- `web/` — React/Vite website, Supabase-backed auth flows and authenticated camera UI.
- `backend/main.py` — FastAPI routes for hazard reports, alerts, optional tide information, snapshot/live camera and tracking metadata.
- `backend/ai.py` and `backend/fight.py` — Gemma-assisted report analysis and single-frame possible-fight checks.
- `backend/core.py` — community report correlation and alert generation.
- `hardware/camera.py` — camera capture, local tracking worker, recent snapshot and sampled API uploads.
- `hardware/local_tracking.py` — local person detector, temporary IDs, pose metadata and RAM frame history.
- `hardware/speaker.py` — alert polling, speech and optional LED outputs.
- `manager/desktop.py` — local Tkinter manager; intended for Pi Connect/private access, **not** public web exposure.
- `deploy/` — installation, update, service and hardware control scripts.

Report data is stored locally by the backend in a JSON-based store; this project does not claim a production-grade database or verified identity for every submitted community report.

## Raspberry Pi setup and updates

Use the deployment scripts appropriate for your existing Pi installation. For an already configured checkout:

```bash
cd /opt/hackformiami
git pull --ff-only
sudo bash deploy/install-hardware.sh
sudo systemctl restart hackformiami-camera hackformiami-speaker
```

The optional pose runtime is **not automatically enabled** just by installing the hardware dependencies:

```bash
cd /opt/hackformiami
bash deploy/enable-pose.sh
```

That creates `hardware/pose-venv`, downloads `yolo11n-pose.pt`, and overrides the camera service interpreter. It requires sufficient disk space and CPU/RAM. Its measured FPS on the actual Pi must be checked.

Check logs:

```bash
sudo journalctl -u hackformiami-camera -n 50 --no-pager
sudo journalctl -u hackformiami-speaker -n 50 --no-pager
```

The camera reports its active detection backend in tracking metadata. Never commit `/etc/hackformiami/backend.env`, API keys, auth tokens, or other credentials.

## Safety and privacy

- Camera tracking IDs are temporary and should not be treated as personal identities.
- Camera feeds and tracking metadata require authenticated access; do not publish an unauthenticated surveillance endpoint.
- Human review and incident-response procedures are necessary before treating a camera-generated warning as fact.
- Never use the project alone for emergency dispatch, policing, or evacuation decisions.

## License

See [LICENSE](LICENSE).
