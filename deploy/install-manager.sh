#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/hackformiami"
if [[ ! -f "$REPO_DIR/manager/server.py" ]]; then
  echo "Expected $REPO_DIR/manager/server.py. Clone/update the repository first." >&2
  exit 1
fi
sudo apt-get update
sudo apt-get install -y python3 git ca-certificates curl

sudo tee /etc/systemd/system/hackformiami-manager.service >/dev/null <<'SERVICE'
[Unit]
Description=HackForMiami Private Raspberry Pi Manager
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/hackformiami
Environment=PYTHONDONTWRITEBYTECODE=1
Environment=HFM_REPO=/opt/hackformiami
ExecStart=/usr/bin/python3 -B /opt/hackformiami/manager/server.py
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_UNIX
ReadOnlyPaths=/opt/hackformiami

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable --now hackformiami-manager
sudo systemctl restart hackformiami-manager
echo "Manager installed. Local check: curl http://127.0.0.1:8787/health"
echo "Configure Cloudflare Tunnel to HTTP://localhost:8787 and require Cloudflare Access."
