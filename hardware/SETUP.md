# Raspberry Pi hardware alarms

The code is deployed, but services are OFF until a local operator enables them.

- `hardware/camera.py`: publishes an atomic preview frame every `PREVIEW_INTERVAL` seconds and independently submits frames for AI every `INTERVAL` seconds. Slow AI requests do not stall preview capture.
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
`PREVIEW_INTERVAL=2` provides a low-frame-rate live preview suitable for a Raspberry Pi and USB camera. `INTERVAL=10` independently controls paid AI analysis. Pausing AI in the Manager does not stop preview capture.
Test speaker locally: `espeak-ng "This is a Four Forces speaker test."`. Check your output routing with `aplay -l`. Confirm `rpicam-still` or `fswebcam` is available and that the camera points only where you have permission to record.

For a supervised local test, start with:
```bash
sudo systemctl start hackformiami-speaker
sudo systemctl start hackformiami-camera
sudo systemctl status hackformiami-camera hackformiami-speaker --no-pager
```
After verification, choose `sudo systemctl enable hackformiami-camera hackformiami-speaker` to enable startup at boot.

When code under `hardware/` updates, restart the services to load changes. Heavy 10-second AI calls can cause latency, rate limits and cost. Automatic siren output is **not a substitute for a building-approved emergency system**.
