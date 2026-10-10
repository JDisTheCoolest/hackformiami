#!/usr/bin/env bash
# Privileged action bridge for local Pi desktop manager.
set -euo pipefail
ACTION="${1:-}"
ENV=/etc/hackformiami/hardware.env
[[ -f "$ENV" ]] || { echo "Run deploy/install-hardware.sh first"; exit 1; }
case "$ACTION" in
  ai-on|ai-off)
    VALUE=0; [[ "$ACTION" == ai-on ]] && VALUE=1
    tmp=$(mktemp)
    grep -v '^CAM_AI_ENABLED=' "$ENV" > "$tmp" || true
    printf 'CAM_AI_ENABLED=%s\n' "$VALUE" >> "$tmp"
    cat "$tmp" > "$ENV"
    rm -f "$tmp"
    chmod 600 "$ENV"
    echo "Camera AI $([[ "$VALUE" == 1 ]] && echo enabled || echo paused)"
    ;;
  interval)
    SECONDS="${2:-}"
    [[ "$SECONDS" =~ ^[0-9]+$ ]] && (( SECONDS >= 10 && SECONDS <= 3600 )) || { echo "Interval must be 10–3600 seconds"; exit 1; }
    tmp=$(mktemp)
    grep -v '^INTERVAL=' "$ENV" > "$tmp" || true
    printf 'INTERVAL=%s\n' "$SECONDS" >> "$tmp"
    cat "$tmp" > "$ENV"
    rm -f "$tmp"
    chmod 600 "$ENV"
    systemctl try-restart hackformiami-camera.service || true
    echo "Camera interval set to $SECONDS seconds"
    ;;
  start|stop|restart)
    systemctl "$ACTION" hackformiami-camera.service
    echo "Camera service: $ACTION"
    ;;
  speaker-start|speaker-stop)
    systemctl "${ACTION#speaker-}" hackformiami-speaker.service
    echo "Speaker: $ACTION"
    ;;
  *)
    echo "Unknown command" >&2
    exit 2
    ;;
esac
