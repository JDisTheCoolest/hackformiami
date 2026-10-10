#!/usr/bin/env bash
set -euo pipefail
cd /opt/hackformiami
sudo apt-get update
sudo apt-get install -y espeak-ng alsa-utils python3-requests fswebcam
sudo install -d -m 0755 /var/lib/hackformiami-hardware
sudo install -d -m 0750 /etc/hackformiami
if [[ ! -f /etc/hackformiami/hardware.env ]]; then
  sudo tee /etc/hackformiami/hardware.env >/dev/null <<'ENV'
SERVER_URL=http://127.0.0.1:8000
INTERVAL=10
PREVIEW_INTERVAL=2
CAMERA_SNAPSHOT_PATH=/var/lib/hackformiami-hardware/latest.jpg
CAM_AI_ENABLED=0
CAM_LAT=0
CAM_LNG=0
CAM_AREA=Unconfigured camera
REPORTER_ID=pi-cam-1
SPEAK_LANGS=en
POLL_SECONDS=5
ENV
fi
sudo chmod 644 /etc/hackformiami/hardware.env
# No API secrets belong in hardware.env; the manager reads this file to show settings.
for unit in camera speaker; do
  sudo tee "/etc/systemd/system/hackformiami-$unit.service" >/dev/null <<EOF
[Unit]
Description=HackForMiami $unit hardware
After=hackformiami-site.service
Requires=hackformiami-site.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hackformiami
EnvironmentFile=/etc/hackformiami/hardware.env
EnvironmentFile=/etc/hackformiami/backend.env
ExecStart=/usr/bin/python3 -u /opt/hackformiami/hardware/$unit.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
done
sudo systemctl daemon-reload
echo "Installed camera and speaker services. They are NOT enabled yet."
echo "Set real CAM_LAT CAM_LNG CAM_AREA in /etc/hackformiami/hardware.env."
echo "Test speaker: espeak-ng 'This is a Four Forces speaker test.'"
echo "Then enable: sudo systemctl enable --now hackformiami-camera hackformiami-speaker"
