#!/usr/bin/env bash
set -euo pipefail
# Native GUI checks desktop.py for changes itself and reloads in the user's session.
# No system-wide web manager restart is needed.
rm -f /var/lib/hackformiami-update/restart-required
if [[ -f /var/lib/hackformiami-update/site-update-required ]] && systemctl is-enabled --quiet hackformiami-site.service; then
  rm -f /var/lib/hackformiami-update/site-update-required
  systemctl start --no-block hackformiami-site-build.service
fi
