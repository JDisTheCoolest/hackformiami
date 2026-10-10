#!/usr/bin/env bash
# Check or apply only checked-in migrations using an authorized PostgreSQL URL.
set -euo pipefail
repo=/opt/hackformiami
deploy_user="${HFM_DEPLOY_USER:-nacker}"
config="/home/$deploy_user/.config/hackformiami/manager.env"
mode="${1:-status}"
[[ -r "$config" ]] || { echo "MISCONFIGURED: $config is not readable"; exit 3; }
SUPABASE_DB_URL="$(python3 - "$config" <<'PY'
import sys
for line in open(sys.argv[1], encoding="utf-8"):
    if line.strip().startswith("SUPABASE_DB_URL="):
        print(line.split("=", 1)[1].strip().strip("'\"")); break
PY
)"
[[ -n "${SUPABASE_DB_URL:-}" ]] || { echo "MISCONFIGURED: SUPABASE_DB_URL is missing"; exit 3; }
command -v psql >/dev/null && command -v pg_dump >/dev/null || { echo "MISCONFIGURED: install postgresql-client"; exit 3; }
tmp="$(mktemp -d)"; chmod 700 "$tmp"; trap 'rm -rf -- "$tmp"' EXIT
printf '[deploy]\nconninfo=%s\n' "$SUPABASE_DB_URL" > "$tmp/pg_service.conf"; chmod 600 "$tmp/pg_service.conf"
export PGSERVICEFILE="$tmp/pg_service.conf"
unset SUPABASE_DB_URL
history="$(psql service=deploy -Atqc "select to_regclass('supabase_migrations.schema_migrations') is not null")"
for table in profiles incident_reports alerts user_alerts notification_preferences saved_locations report_attachments; do
  exists="$(psql service=deploy -Atqc "select to_regclass('public.$table') is not null")"
  [[ "$exists" == t ]] && echo "TABLE OK $table" || echo "WARNING missing table $table"
done
for policy in 'own profile' 'own reports' 'read alerts' 'own alert state' 'own preferences' 'own locations' 'own report attachments'; do
  exists="$(psql service=deploy -v policy="$policy" -Atqc "select exists(select 1 from pg_policies where schemaname='public' and policyname=:'policy')")"
  [[ "$exists" == t ]] && echo "POLICY OK $policy" || echo "WARNING missing policy $policy"
done
pending=()
for file in "$repo"/supabase/migrations/*.sql; do
  [[ -e "$file" ]] || continue
  name="$(basename "$file")"; version="${name%%_*}"
  if [[ "$history" == t ]] && psql service=deploy -Atqc "select 1 from supabase_migrations.schema_migrations where version='$version'" | grep -qx 1; then
    echo "APPLIED $name"
  else
    echo "PENDING $name"; pending+=("$file")
  fi
done
[[ "$mode" == status ]] && exit 0
[[ "$mode" == apply ]] || { echo "Usage: supabase-migrations.sh status|apply"; exit 64; }
[[ ${#pending[@]} -gt 0 ]] || { echo "No pending migrations."; exit 0; }
backup_dir="/var/backups/hackformiami"; install -d -m 0700 "$backup_dir"
backup="$backup_dir/supabase-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump service=deploy --format=custom --file="$backup"
chmod 600 "$backup"; echo "Backup completed: $backup"
psql service=deploy -v ON_ERROR_STOP=1 -qc 'create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);'
for file in "${pending[@]}"; do
  name="$(basename "$file")"; version="${name%%_*}"
  psql service=deploy -v ON_ERROR_STOP=1 -v version="$version" -v name="$name" \
    --single-transaction --file="$file" \
    -c "insert into supabase_migrations.schema_migrations(version, statements, name) values (:'version', array[]::text[], :'name') on conflict (version) do nothing"
  echo "APPLIED $name"
done
