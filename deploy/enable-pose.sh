#!/usr/bin/env bash
# Opt-in CPU pose backend. Run only on a Pi with adequate free RAM/disk.
set -euo pipefail
cd /opt/hackformiami
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip
sudo install -d -m 0755 hardware/models
python3 -m venv --system-site-packages hardware/pose-venv
hardware/pose-venv/bin/python -m pip install --upgrade pip
hardware/pose-venv/bin/python -m pip install 'ultralytics>=8.3,<9' requests
if [[ ! -s hardware/models/yolo11n-pose.pt ]]; then
  curl --fail --location --retry 3 --max-time 180 -o hardware/models/yolo11n-pose.pt.tmp \
    https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n-pose.pt
  mv hardware/models/yolo11n-pose.pt.tmp hardware/models/yolo11n-pose.pt
fi
hardware/pose-venv/bin/python -c 'from ultralytics import YOLO; YOLO("hardware/models/yolo11n-pose.pt"); print("Pose model loaded successfully")'
sudo mkdir -p /etc/systemd/system/hackformiami-camera.service.d
printf '[Service]\nExecStart=\nExecStart=/opt/hackformiami/hardware/pose-venv/bin/python -u /opt/hackformiami/hardware/camera.py\n' | sudo tee /etc/systemd/system/hackformiami-camera.service.d/pose.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart hackformiami-camera
echo 'YOLO pose enabled. Verify status and tracking model in camera logs.'
