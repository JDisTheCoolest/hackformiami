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
    chmod 644 "$ENV"
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
    chmod 644 "$ENV"
    systemctl try-restart hackformiami-camera.service || true
    echo "Camera interval set to $SECONDS seconds"
    ;;
  location)
    LAT="$2"; LNG="$3"; AREA="$4"
    python3 - "$LAT" "$LNG" "$AREA" <<'PY'
import sys
lat, lng = map(float, sys.argv[1:3])
area=sys.argv[3]
assert -90 <= lat <= 90 and -180 <= lng <= 180
assert len(area) <= 80 and chr(10) not in area and chr(13) not in area
PY
    tmp=$(mktemp)
    grep -Ev "^(CAM_LAT|CAM_LNG|CAM_AREA)=" "$ENV" > "$tmp" || true
    printf 'CAM_LAT=%s\nCAM_LNG=%s\nCAM_AREA=%s\n' "$LAT" "$LNG" "$AREA" >> "$tmp"
    cat "$tmp" > "$ENV"; rm -f "$tmp"; chmod 644 "$ENV"
    systemctl try-restart hackformiami-camera.service || true
    echo "Camera location saved"
    ;;
  start|stop|restart)
    systemctl "$ACTION" hackformiami-camera.service
    echo "Camera service: $ACTION"
    ;;
  audio-device)
    DEVICE="${2:-}"
    [[ "$DEVICE" =~ ^[a-zA-Z0-9_:,.-]{1,80}$ ]] || { echo "Invalid ALSA device"; exit 2; }
    tmp=$(mktemp)
    grep -v "^ALSA_DEVICE=" "$ENV" > "$tmp" || true
    printf "ALSA_DEVICE=%s\n" "$DEVICE" >> "$tmp"
    cat "$tmp" > "$ENV"; rm -f "$tmp"; chmod 644 "$ENV"
    systemctl try-restart hackformiami-speaker.service || true
    echo "Audio device set to $DEVICE"
    ;;
  speaker-test)
    /usr/bin/python3 /opt/hackformiami/hardware/speaker.py --test
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
