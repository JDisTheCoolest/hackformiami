#!/usr/bin/env bash
# Explicit, fast-forward-only application deployment. Never resets or cleans files.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=8"
repo=/opt/hackformiami
log_dir=/var/lib/hackformiami-update
log_file="$log_dir/deploy.log"
mode="${1:-preview}"
mkdir -p "$log_dir"
exec > >(tee -a "$log_file") 2>&1
cd "$repo"
echo "$(date -u +%FT%TZ) deployment $mode started"
repo_user="${HFM_DEPLOY_USER:-nacker}"
if [[ "$(id -un)" == "$repo_user" ]]; then
  gitrun() { git -C "$repo" "$@"; }
else
  gitrun() { sudo -u "$repo_user" git -C "$repo" "$@"; }
fi

if [[ -n "$(gitrun status --porcelain)" ]]; then
  echo "REFUSED: local changes or untracked files are present."; exit 2
fi
branch="$(gitrun branch --show-current)"
if [[ -z "$branch" ]]; then echo "REFUSED: detached HEAD."; exit 2; fi
gitrun fetch --prune origin "$branch"
local_head="$(gitrun rev-parse HEAD)"
remote_head="$(gitrun rev-parse "origin/$branch")"
if ! gitrun merge-base --is-ancestor "$local_head" "$remote_head"; then
  echo "REFUSED: local and remote history diverged."; exit 2
fi
echo "Branch: $branch"
echo "Commits pending:"
gitrun log --oneline --decorate "$local_head..$remote_head" || true
if [[ "$mode" == preview ]]; then exit 0; fi
if [[ "$mode" != apply ]]; then echo "Usage: safe-deploy.sh preview|apply"; exit 64; fi
if [[ "$local_head" == "$remote_head" ]]; then echo "Already up to date."; exit 0; fi

gitrun merge --ff-only "$remote_head"
npm --prefix web ci
npm --prefix web run build
if [[ ! -x .venv/bin/pip ]]; then python3 -m venv .venv; fi
.venv/bin/pip install -r backend/requirements.txt
systemctl restart hackformiami-site.service
for attempt in {1..15}; do
  if curl -fsS --max-time 4 http://127.0.0.1:8000/api/health >/dev/null; then
    echo "SUCCESS: deployed $(gitrun rev-parse --short HEAD) and verified API health."
    exit 0
  fi
  sleep 2
done
echo "FAILED: service restarted but health verification did not pass."
systemctl status hackformiami-site.service --no-pager || true
exit 1
