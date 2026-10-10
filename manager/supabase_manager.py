"""Safe, dependency-free Supabase diagnostics for the local desktop manager."""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

EXPECTED_TABLES = (
    "profiles", "incident_reports", "alerts", "user_alerts",
    "notification_preferences", "saved_locations", "report_attachments",
)
EXPECTED_BUCKETS = ("report-images",)
PUBLIC_URL_KEYS = ("NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL")
PUBLIC_KEY_KEYS = ("NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY")


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        return values
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key.strip()):
            values[key.strip()] = value.strip().strip("'\"")
    return values


def configuration(root: Path) -> dict[str, str]:
    # Process values win. The per-user file is local-only and may hold admin access.
    values = read_env(root / ".env.local")
    values.update(read_env(Path("/etc/hackformiami/backend.env")))
    values.update(read_env(Path.home() / ".config" / "hackformiami" / "manager.env"))
    values.update(os.environ)
    return values


def _first(values: dict[str, str], names: tuple[str, ...]) -> str:
    return next((values.get(name, "").strip() for name in names if values.get(name, "").strip()), "")


def _request(url: str, key: str, path: str, method: str = "GET", body=None, timeout: int = 7):
    data = None if body is None else json.dumps(body).encode()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read(1024 * 1024)
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        try:
            payload = json.loads(exc.read(4096))
        except Exception:
            payload = None
        return exc.code, payload


def _safe_error(exc: Exception) -> str:
    if isinstance(exc, urllib.error.URLError):
        return "DNS, TLS, or network connection failed"
    if isinstance(exc, TimeoutError):
        return "connection timed out"
    return "unexpected connection error"


def diagnostics(root: Path) -> dict:
    values = configuration(root)
    url, public_key = _first(values, PUBLIC_URL_KEYS).rstrip("/"), _first(values, PUBLIC_KEY_KEYS)
    service_key = values.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    result = {
        "status": "Unknown", "project_url": url or "Not configured", "auth": "Unknown",
        "jwt_endpoint": "Unknown", "tables": {}, "buckets": {}, "user_count": None,
        "admin_configured": bool(service_key), "diagnostic": "Not checked",
    }
    if not url or not public_key:
        result.update(status="Misconfigured", auth="Misconfigured", jwt_endpoint="Misconfigured",
                      diagnostic="Missing public Supabase URL or publishable key")
        return result
    if not url.startswith("https://"):
        result.update(status="Misconfigured", diagnostic="Supabase URL must use HTTPS")
        return result
    try:
        code, _ = _request(url, public_key, "/auth/v1/settings")
        result["auth"] = "Connected" if code == 200 else ("Misconfigured" if code in (401, 403) else "Disconnected")
        result["jwt_endpoint"] = backend_auth_health()
        for table in EXPECTED_TABLES:
            code, _ = _request(url, public_key, f"/rest/v1/{table}?select=*&limit=0", method="GET")
            result["tables"][table] = "Available" if code in (200, 206) else ("Restricted" if code in (401, 403) else "Missing")
        bucket_key = service_key or public_key
        code, buckets = _request(url, bucket_key, "/storage/v1/bucket")
        if code == 200 and isinstance(buckets, list):
            names = {str(item.get("name")) for item in buckets}
            result["buckets"] = {name: ("Available" if name in names else "Missing") for name in EXPECTED_BUCKETS}
        else:
            result["buckets"] = {name: "Unknown (not authorized)" for name in EXPECTED_BUCKETS}
        if service_key:
            code, users = _request(url, service_key, "/auth/v1/admin/users?per_page=1")
            if code == 200 and isinstance(users, dict):
                result["user_count"] = users.get("total") or users.get("total_count")
        ok = result["auth"] == "Connected"
        result["status"] = "Connected" if ok else result["auth"]
        result["diagnostic"] = "Public API reachable" if ok else "Supabase rejected the configured public credentials"
    except Exception as exc:
        result.update(status="Disconnected", auth="Disconnected", diagnostic=_safe_error(exc))
    return result


def backend_auth_health() -> str:
    try:
        request = urllib.request.Request("http://127.0.0.1:8000/api/auth/health")
        with urllib.request.urlopen(request, timeout=4) as response:
            payload = json.loads(response.read())
        return "Connected" if response.status == 200 and payload.get("configured") and payload.get("supabase_reachable") else "Misconfigured"
    except Exception:
        return "Disconnected"


def migration_files(root: Path) -> list[dict[str, str]]:
    items = []
    for path in sorted((root / "supabase" / "migrations").glob("*.sql")):
        match = re.match(r"(\d+)_", path.name)
        items.append({"version": match.group(1) if match else path.stem, "name": path.name, "status": "Unknown"})
    return items


def list_users(root: Path, page: int = 1) -> list[dict]:
    values = configuration(root)
    url = _first(values, PUBLIC_URL_KEYS).rstrip("/")
    key = values.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("Server-only Supabase administration is not configured")
    code, payload = _request(url, key, f"/auth/v1/admin/users?page={page}&per_page=100")
    if code != 200 or not isinstance(payload, dict):
        raise RuntimeError("Supabase denied the user administration request")
    safe = []
    for user in payload.get("users", []):
        safe.append({"id": user.get("id", ""), "email": user.get("email", ""),
                     "created_at": user.get("created_at", ""), "verified": bool(user.get("email_confirmed_at")),
                     "status": "Disabled" if user.get("banned_until") else "Active"})
    return safe


def set_user_disabled(root: Path, user_id: str, disabled: bool) -> None:
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", user_id):
        raise ValueError("Invalid user ID")
    values = configuration(root)
    url = _first(values, PUBLIC_URL_KEYS).rstrip("/")
    key = values.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("Server-only Supabase administration is not configured")
    code, _ = _request(url, key, f"/auth/v1/admin/users/{user_id}", method="PUT",
                       body={"ban_duration": "876000h" if disabled else "none"})
    if code not in (200, 201):
        raise RuntimeError("Supabase denied the account update")
