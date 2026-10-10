#!/usr/bin/env bash
set -euo pipefail
# Called through pkexec; connector token is read from stdin (not stored in Git).
if [[ $(id -u) != 0 ]]; then echo "Root authentication required" >&2; exit 1; fi
IFS= read -r token
if [[ ! "$token" =~ ^[a-zA-Z0-9_.=-]{50,4096}$ ]]; then echo "Invalid token format" >&2; exit 2; fi
if ! command -v cloudflared >/dev/null; then
  install -d -m 0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  printf 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main\n' >/etc/apt/sources.list.d/cloudflared.list
  apt-get update
  apt-get install -y cloudflared
fi
if systemctl is-active --quiet cloudflared; then
  echo "cloudflared service already running; do not overwrite an existing connector." >&2
  exit 3
fi
# Cloudflare's installer persists the token in its root-owned service config.
cloudflared service install "$token" >/dev/null
systemctl enable --now cloudflared
echo "Tunnel connector installed. Configure the hostname route in Cloudflare dashboard."
