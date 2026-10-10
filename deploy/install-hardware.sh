#!/usr/bin/env bash
set -euo pipefail
cd /opt/hackformiami
sudo apt-get update
sudo apt-get install -y espeak-ng pulseaudio-utils alsa-utils python3-requests python3-opencv fswebcam v4l-utils
sudo install -d -m 0755 /var/lib/hackformiami-hardware
sudo install -d -m 0750 /etc/hackformiami
if [[ ! -f /etc/hackformiami/hardware.env ]]; then
  sudo tee /etc/hackformiami/hardware.env >/dev/null <<'ENV'
SERVER_URL=http://127.0.0.1:8000
CAPTURE=usb
CAM_DEVICE=
INTERVAL=10
PREVIEW_INTERVAL=2
CAMERA_SNAPSHOT_PATH=/var/lib/hackformiami-hardware/latest.jpg
CAM_AI_ENABLED=1
CAM_LAT=0
CAM_LNG=0
CAM_AREA=Unconfigured camera
REPORTER_ID=pi-cam-1
SPEAK_LANGS=en
POLL_SECONDS=5
ALSA_DEVICE=default
ENV
fi
# Preserve existing local configuration while adding new safe defaults.
grep -q '^CAPTURE=' /etc/hackformiami/hardware.env || echo 'CAPTURE=usb' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^CAM_DEVICE=' /etc/hackformiami/hardware.env || echo 'CAM_DEVICE=' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
grep -q '^PREVIEW_INTERVAL=' /etc/hackformiami/hardware.env || echo 'PREVIEW_INTERVAL=2' | sudo tee -a /etc/hackformiami/hardware.env >/dev/null
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
