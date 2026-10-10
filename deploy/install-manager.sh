#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/hackformiami"
if [[ ! -f "$REPO_DIR/manager/server.py" ]]; then
  echo "Expected $REPO_DIR/manager/server.py. Clone/update the repository first." >&2
  exit 1
fi
sudo apt-get update
sudo apt-get install -y python3 python3-tk git ca-certificates curl

DEPLOY_USER="${SUDO_USER:-$(id -un)}"
if [[ "$DEPLOY_USER" == root ]]; then echo "Run this installer as the regular Pi Git account, not as root." >&2; exit 1; fi
sudo install -d -m 0755 -o "$DEPLOY_USER" -g "$(id -gn "$DEPLOY_USER")" /var/lib/hackformiami-update

# The desktop manager runs in the user's graphical login, never as a web server.
sudo systemctl disable --now hackformiami-manager.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/hackformiami-manager.service
mkdir -p "$HOME/.local/share/applications" "$HOME/.config/autostart" "$HOME/.local/bin"
cat > "$HOME/.local/bin/hackformiami-manager" <<'LAUNCH'
#!/usr/bin/env bash
exec /usr/bin/python3 -B /opt/hackformiami/manager/desktop.py
LAUNCH
chmod +x "$HOME/.local/bin/hackformiami-manager"
cat > "$HOME/.local/share/applications/hackformiami-manager.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=HackForMiami Manager
Comment=Local Raspberry Pi organizer console
Exec=$HOME/.local/bin/hackformiami-manager
Icon=utilities-system-monitor
Terminal=false
Categories=Utility;Development;
StartupNotify=true
EOF
cp "$HOME/.local/share/applications/hackformiami-manager.desktop" "$HOME/.config/autostart/hackformiami-manager.desktop"

sudo install -m 0700 "$REPO_DIR/deploy/install-cloudflared.sh" /usr/local/sbin/hackformiami-cloudflared-install
sudo install -m 0700 "$REPO_DIR/deploy/install-site.sh" /usr/local/sbin/hackformiami-site-install
sudo install -m 0755 "$REPO_DIR/deploy/auto-update.sh" /usr/local/bin/hackformiami-auto-update
sudo install -m 0755 "$REPO_DIR/deploy/post-update.sh" /usr/local/bin/hackformiami-post-update
sudo install -m 0755 "$REPO_DIR/deploy/safe-deploy.sh" /usr/local/sbin/hackformiami-safe-deploy
sudo install -m 0700 "$REPO_DIR/deploy/supabase-migrations.sh" /usr/local/sbin/hackformiami-supabase-migrations
mkdir -p "$HOME/.config/hackformiami"
chmod 700 "$HOME/.config/hackformiami"
if [[ ! -f "$HOME/.config/hackformiami/manager.env" ]]; then
  (umask 077; printf '%s\n' '# Optional local-only server credentials' 'SUPABASE_SERVICE_ROLE_KEY=' 'SUPABASE_DB_URL=' > "$HOME/.config/hackformiami/manager.env")
fi
chmod 600 "$HOME/.config/hackformiami/manager.env"
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
sudo tee /etc/systemd/system/hackformiami-site-build.service >/dev/null <<'BUILDER'
[Unit]
Description=Build HackForMiami website after GitHub update
After=network-online.target
ConditionPathExists=/etc/hackformiami/backend.env

[Service]
Type=oneshot
WorkingDirectory=/opt/hackformiami
ExecStart=/bin/bash -c 'cd /opt/hackformiami/web && npm ci && npm run build && /opt/hackformiami/.venv/bin/pip install -r /opt/hackformiami/backend/requirements.txt'
ExecStartPost=/bin/systemctl try-restart hackformiami-site.service
TimeoutStartSec=900
BUILDER
sudo systemctl daemon-reload
sudo systemctl enable --now hackformiami-update.timer
sudo systemctl start hackformiami-update.service
echo "Desktop manager installed. Launch from Applications > HackForMiami Manager, or run: ~/.local/bin/hackformiami-manager"
echo "The app autostarts at desktop login. The Cloudflare Tunnel is reserved for your future public site."
