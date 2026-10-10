#!/usr/bin/env bash
set -euo pipefail
flag=/var/lib/hackformiami-update/restart-required
if [[ -f "$flag" ]]; then
  systemctl restart hackformiami-manager.service
  rm -f "$flag"
fi
