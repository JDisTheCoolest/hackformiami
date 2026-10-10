#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/hackformiami"
if [[ ! -f "$REPO_DIR/manager/server.py" ]]; then
  echo "Expected $REPO_DIR/manager/server.py. Clone/update the repository first." >&2
  exit 1
fi
sudo apt-get update
sudo apt-get install -y python3 git ca-certificates curl

DEPLOY_USER="${SUDO_USER:-$(id -un)}"
if [[ "$DEPLOY_USER" == root ]]; then echo "Run this installer as the regular Pi Git account, not as root." >&2; exit 1; fi
sudo install -d -m 0755 -o "$DEPLOY_USER" -g "$(id -gn "$DEPLOY_USER")" /var/lib/hackformiami-update

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

sudo install -m 0755 "$REPO_DIR/deploy/auto-update.sh" /usr/local/bin/hackformiami-auto-update
sudo install -m 0755 "$REPO_DIR/deploy/post-update.sh" /usr/local/bin/hackformiami-post-update
sudo tee /etc/systemd/system/hackformiami-update.service >/dev/null <<SERVICE_UPDATE
[Unit]
Description=HackForMiami GitHub auto-update check
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
User=$DEPLOY_USER
Group=$(id -gn "$DEPLOY_USER")
ExecStart=/usr/local/bin/hackformiami-auto-update
ExecStartPost=+/usr/local/bin/hackformiami-post-update
TimeoutStartSec=25
NoNewPrivileges=true
SERVICE_UPDATE
sudo tee /etc/systemd/system/hackformiami-update.timer >/dev/null <<'TIMER'
[Unit]
Description=Check HackForMiami GitHub every 30 seconds

[Timer]
OnBootSec=30s
OnUnitInactiveSec=30s
AccuracySec=1s
Unit=hackformiami-update.service

[Install]
WantedBy=timers.target
TIMER
sudo systemctl daemon-reload
sudo systemctl enable --now hackformiami-manager
sudo systemctl restart hackformiami-manager
sudo systemctl enable --now hackformiami-update.timer
sudo systemctl start hackformiami-update.service
echo "Manager installed. Local check: curl http://127.0.0.1:8787/health"
echo "Configure Cloudflare Tunnel to HTTP://localhost:8787 and require Cloudflare Access."
