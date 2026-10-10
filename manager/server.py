#!/usr/bin/env python3
"""Read-only Raspberry Pi management dashboard. Bind to loopback only."""
import html
import json
import os
import shutil
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(os.environ.get("HFM_REPO", "/opt/hackformiami"))
HOST = "127.0.0.1"
PORT = int(os.environ.get("HFM_MANAGER_PORT", "8787"))

def command(*args):
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=3, cwd=ROOT)
        return (p.stdout or p.stderr).strip()[:250] if p.returncode == 0 else "unavailable"
    except (OSError, subprocess.TimeoutExpired):
        return "unavailable"

def snapshot():
    usage = shutil.disk_usage("/")
    return {
        "project": "HackForMiami",
        "hostname": os.uname().nodename,
        "uptime": round(float(Path("/proc/uptime").read_text().split()[0]) / 3600, 1),
        "disk_used_percent": round(100 * usage.used / usage.total, 1),
        "commit": command("git", "rev-parse", "--short", "HEAD"),
        "branch": command("git", "branch", "--show-current"),
        "cloudflared": command("systemctl", "is-active", "cloudflared"),
        "manager": "active",
        "timestamp": int(time.time()),
    }

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/", "/health"):
            self.send_error(404)
            return
        state = snapshot()
        if self.path == "/health":
            body = json.dumps({"status": "ok", "service": "hackformiami-manager"}).encode()
            content_type = "application/json"
        else:
            items = "".join(
                f"<div class='metric'><span>{html.escape(str(k).replace('_',' ').title())}</span>"
                f"<strong>{html.escape(str(v))}</strong></div>"
                for k, v in state.items()
            )
            body = ("""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30"><title>HackForMiami | Pi Manager</title>
<style>body{font-family:system-ui;background:#0b1220;color:#f3f7ff;margin:0;padding:35px}
main{max-width:820px;margin:auto}h1{letter-spacing:-.04em}p{color:#9ab0cf}
section{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:13px}
.metric{background:#17243b;border:1px solid #304463;border-radius:14px;padding:20px}
span{color:#9ab0cf;display:block;margin-bottom:12px}strong{font-size:21px;overflow-wrap:anywhere}
small{color:#9ab0cf}</style></head><body><main><h1>HackForMiami</h1>
<p>Raspberry Pi manager · Read-only · Refreshes every 30 seconds</p><section>"""
            + items + "</section><p><small>Private service — protect the tunnel hostname with Cloudflare Access.</small></p></main></body></html>").encode()
            content_type = "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
