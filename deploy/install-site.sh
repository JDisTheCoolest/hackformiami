#!/usr/bin/env bash
set -euo pipefail
cd /opt/hackformiami
# Per-machine secrets are kept outside the Git worktree.
sudo install -d -m 0750 -o root -g root /etc/hackformiami
if [[ ! -f /etc/hackformiami/backend.env ]]; then
  token="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
  sudo sh -c 'umask 077; cat > /etc/hackformiami/backend.env' <<EOF
GEMINI_API_KEY=
GEMMA_MODEL=gemma-4-26b-a4b-it
ALERT_THRESHOLD=10
ADMIN_TOKEN=$token
EOF
fi
sudo chmod 600 /etc/hackformiami/backend.env
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip nodejs npm curl
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)' 2>/dev/null; then
  echo "Installing Node.js 22 for Vite 8..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)'
fi
python3 -m venv /opt/hackformiami/.venv
/opt/hackformiami/.venv/bin/pip install -r backend/requirements.txt
(cd web && npm ci && npm run build)
sudo tee /etc/systemd/system/hackformiami-site.service >/dev/null <<'SERVICE'
[Unit]
Description=HackForMiami public website, API and Gemma integration
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hackformiami/backend
EnvironmentFile=/etc/hackformiami/backend.env
ExecStart=/opt/hackformiami/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE
sudo systemctl daemon-reload
sudo systemctl enable --now hackformiami-site.service
sudo systemctl restart hackformiami-site.service
echo "Website/API on http://127.0.0.1:8000; use Cloudflare Tunnel to expose it."
echo "Edit AI secrets locally: sudoedit /etc/hackformiami/backend.env ; then sudo systemctl restart hackformiami-site"
