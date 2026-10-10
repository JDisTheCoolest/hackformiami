#!/usr/bin/env bash
set -euo pipefail
# Native GUI checks desktop.py for changes itself and reloads in the user's session.
# No system-wide web manager restart is needed.
rm -f /var/lib/hackformiami-update/restart-required
