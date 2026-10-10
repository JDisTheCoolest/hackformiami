# Raspberry Pi hardware alarms

The code is deployed, but services are OFF until a local operator enables them.

- `hardware/camera.py`: keeps one V4L2 camera handle open, drops queued frames, publishes the newest atomic JPEG, and independently submits frames for AI every `INTERVAL` seconds. Slow AI requests do not stall preview capture.
- `backend/main.py`: two consecutive positive fight frames produce a tentative `possible_fight` alert; cooldown 300 seconds.
- `backend/core.py`: ten distinct non-camera reporter IDs within 1 km/60 minutes must qualify as the same moderate/severe hazard with sufficient AI confidence. **Reporter ID can currently be forged**: do not deploy as an unattended public evacuation alarm without validated user identities and operator review.
- `hardware/speaker.py`: polls latest alert every 5 seconds; reads the first new alert after startup, does not replay historical alerts from startup, and persists its last ID.
- No automatic report test alerts are emitted by camera in MOCK AI mode.

## First-time installation
```bash
cd /opt/hackformiami && git pull --ff-only
sudo bash deploy/install-hardware.sh
sudoedit /etc/hackformiami/hardware.env
sudoedit /etc/hackformiami/backend.env
```
Set real coordinates (CAM_LAT, CAM_LNG), CAM_AREA, and `ALERT_THRESHOLD=10`. No tokens in GitHub. Restart the backend after changing the threshold:
```bash
sudo systemctl restart hackformiami-site
```
Start with `CAMERA_FPS=15`, `CAMERA_WIDTH=640`, `CAMERA_HEIGHT=480`, and `CAMERA_JPEG_QUALITY=80`. Try 30 FPS only after measuring CPU, dropped frames, bandwidth, and latency. `INTERVAL=10` independently controls paid AI analysis. Pausing AI in the Manager does not stop preview capture.

For a USB webcam, set:

```text
CAPTURE=usb
# Optional stable path from: ls -l /dev/v4l/by-id/
CAM_DEVICE=/dev/v4l/by-id/usb-YOUR_CAMERA-video-index0
```

Leave `CAM_DEVICE` empty to rediscover `/dev/v4l/by-id/*` and `/dev/video*` automatically after disconnects. Use `CAPTURE=csi` only for a Raspberry Pi CSI camera. Test speaker locally with `espeak-ng "This is a Four Forces speaker test."` and check audio routing with `aplay -l`.

For a supervised local test, start with:
```bash
sudo systemctl start hackformiami-speaker
sudo systemctl start hackformiami-camera
sudo systemctl status hackformiami-camera hackformiami-speaker --no-pager
```
After verification, choose `sudo systemctl enable hackformiami-camera hackformiami-speaker` to enable startup at boot.

## Measure the live pipeline

Check negotiated webcam modes and service telemetry:

```bash
v4l2-ctl --device /dev/video0 --list-formats-ext
watch -n 1 'cat /var/lib/hackformiami-hardware/status.json; echo; ps -C python3 -o pid,%cpu,%mem,rss,cmd'
sudo journalctl -u hackformiami-camera -f
```

In an authenticated browser, compare a visible clock in the camera image with the current clock to estimate end-to-end latency. DevTools Network shows stream transfer size over time; divide the byte delta by elapsed seconds for bandwidth. Test one, then multiple browser sessions and confirm `viewers` returns to zero after closing them. Cloudflare or the client network may buffer or limit a long-lived response, so validate through the public domain before claiming a sustained frame rate or sub-500 ms latency.

When code under `hardware/` updates, restart the services to load changes. Heavy 10-second AI calls can cause latency, rate limits and cost. Automatic siren output is **not a substitute for a building-approved emergency system**.
