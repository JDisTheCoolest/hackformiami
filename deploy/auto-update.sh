#!/usr/bin/env bash
# Run as the SAME non-root account that owns /opt/hackformiami and its SSH deploy key.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=8"
cd /opt/hackformiami
status_dir=/var/lib/hackformiami-update
mkdir -p "$status_dir"
say() { printf '%s | %s\n' "$(date -u +%FT%TZ)" "$*" > "$status_dir/status"; }
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  say "Skipped: local changes present"; exit 0
fi
branch="$(git branch --show-current)"
if [[ "$branch" != main ]]; then say "Skipped: not on main branch"; exit 0; fi
if ! git fetch --quiet origin main; then say "GitHub fetch failed; check SSH key/network"; exit 1; fi
before="$(git rev-parse HEAD)"
after="$(git rev-parse refs/remotes/origin/main)"
if [[ "$before" == "$after" ]]; then say "Up to date ($before)"; exit 0; fi
if ! git merge-base --is-ancestor "$before" "$after"; then say "Attention: diverged history; deployment refused"; exit 1; fi
count="$(git rev-list --count "$before..$after")"
say "Update available: $count commit(s). Review and deploy in the Manager."
