#!/usr/bin/env bash
set -euo pipefail
cd /opt/hackformiami
sudo apt-get update
sudo apt-get install -y espeak-ng pulseaudio-utils alsa-utils python3-requests python3-opencv fswebcam v4l-utils curl ffmpeg python3-venv
# Speech runtime for natural online voices, isolated from the camera runtime.
if [[ ! -x /opt/hackformiami/hardware/voice-venv/bin/edge-tts ]]; then
  sudo python3 -m venv /opt/hackformiami/hardware/voice-venv
  sudo /opt/hackformiami/hardware/voice-venv/bin/pip install 'edge-tts>=6,<8'
fi
sudo chmod -R a+rX /opt/hackformiami/hardware/voice-venv

# Small local MobileNet SSD: detects only Pascal VOC class 15 (person).
# Download model files once. Keep model weights on Pi, never upload video for person boxes.
MODEL_DIR=/opt/hackformiami/hardware/models
sudo install -d -m 0755 "$MODEL_DIR"
for FILE in deploy.prototxt mobilenet_iter_73000.caffemodel; do
  if [[ ! -s "$MODEL_DIR/$FILE" ]]; then
    TMP="$(mktemp)"
    if curl --fail --location --retry 3 --connect-timeout 15 --max-time 180 \
      "https://cdn.jsdelivr.net/gh/chuanqi305/MobileNet-SSD@master/$FILE" -o "$TMP"; then
      sudo install -m 0644 "$TMP" "$MODEL_DIR/$FILE"
    else
      echo "Failed to download $FILE; camera tracking needs these weights." >&2
      rm -f "$TMP"
      exit 1
    fi
    rm -f "$TMP"
  fi
done
[[ $(stat -c %s "$MODEL_DIR/mobilenet_iter_73000.caffemodel") -gt 10000000 ]] || { echo "Model weights are incomplete" >&2; exit 1; }
sudo install -d -m 0755 /var/lib/hackformiami-hardware
sudo install -d -m 0750 /etc/hackformiami
if [[ ! -f /etc/hackformiami/hardware.env ]]; then
  sudo tee /etc/hackformiami/hardware.env >/dev/null <<'ENV'
SERVER_URL=http://127.0.0.1:8000
CAPTURE=usb
CAM_DEVICE=
INTERVAL=10
CAMERA_FPS=15
CAMERA_WIDTH=640
CAMERA_HEIGHT=480
CAMERA_JPEG_QUALITY=80
PREVIEW_INTERVAL=0.5
CAMERA_SNAPSHOT_PATH=/var/lib/hackformiami-hardware/latest.jpg
CAMERA_STATUS_PATH=/var/lib/hackformiami-hardware/status.json
CAM_AI_ENABLED=1
CAM_LAT=0
CAM_LNG=0
CAM_AREA=Unconfigured camera
REPORTER_ID=pi-cam-1
SPEAK_LANGS=en
POLL_SECONDS=5
ALSA_DEVICE=default
TTS_PROVIDER=edge
ENV
fi
# Preserve existing local configuration while adding new safe defaults.
grep -q '^CAPTURE=' /etc/hackformiami/hardware.env || echo 'CAPTURE=usb' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAM_DEVICE=' /etc/hackformiami/hardware.env || echo 'CAM_DEVICE=' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAMERA_FPS=' /etc/hackformiami/hardware.env || echo 'CAMERA_FPS=15' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAMERA_WIDTH=' /etc/hackformiami/hardware.env || echo 'CAMERA_WIDTH=640' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAMERA_HEIGHT=' /etc/hackformiami/hardware.env || echo 'CAMERA_HEIGHT=480' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAMERA_JPEG_QUALITY=' /etc/hackformiami/hardware.env || echo 'CAMERA_JPEG_QUALITY=80' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAMERA_STATUS_PATH=' /etc/hackformiami/hardware.env || echo 'CAMERA_STATUS_PATH=/var/lib/hackformiami-hardware/status.json' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^PREVIEW_INTERVAL=' /etc/hackformiami/hardware.env || echo 'PREVIEW_INTERVAL=0.5' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^TTS_PROVIDER=' /etc/hackformiami/hardware.env || echo 'TTS_PROVIDER=edge' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
sudo chmod 644 /etc/hackformiami/hardware.env
# No API secrets belong in hardware.env; the manager reads this file to show settings.
# Camera keeps its backend secret environment; speaker uses the logged-in user's
# PipeWire/PulseAudio session so the system default Bluetooth sink is honored.
sudo tee /etc/systemd/system/hackformiami-camera.service >/dev/null <<'CAMUNIT'
[Unit]
Description=HackForMiami camera hardware
After=hackformiami-site.service
Requires=hackformiami-site.service
[Service]
Type=simple
User=root
WorkingDirectory=/opt/hackformiami
EnvironmentFile=/etc/hackformiami/hardware.env
EnvironmentFile=/etc/hackformiami/backend.env
ExecStart=/usr/bin/python3 -u /opt/hackformiami/hardware/camera.py
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
CAMUNIT
AUDIO_USER="${SUDO_USER:-$(id -un)}"
if [[ "$AUDIO_USER" == root ]]; then AUDIO_USER=nacker; fi
AUDIO_UID="$(id -u "$AUDIO_USER")"
sudo tee /etc/systemd/system/hackformiami-speaker.service >/dev/null <<EOF
[Unit]
Description=HackForMiami Bluetooth/default system audio alerts
After=hackformiami-site.service
Requires=hackformiami-site.service
[Service]
Type=simple
User=$AUDIO_USER
Environment=XDG_RUNTIME_DIR=/run/user/$AUDIO_UID
Environment=PULSE_SERVER=unix:/run/user/$AUDIO_UID/pulse/native
WorkingDirectory=/opt/hackformiami
EnvironmentFile=/etc/hackformiami/hardware.env
ExecStart=/usr/bin/python3 -u /opt/hackformiami/hardware/speaker.py
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
echo "Installed camera and speaker services. They are NOT enabled yet."
echo "Set real CAM_LAT CAM_LNG CAM_AREA in /etc/hackformiami/hardware.env."
echo "Test speaker: espeak-ng 'This is a Four Forces speaker test.'"
echo "Then enable: sudo systemctl enable --now hackformiami-camera hackformiami-speaker"
