#!/usr/bin/env python3
"""Private, read-only HackForMiami Pi GUI. Cloudflare Access is required for remote use."""
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

def run(args):
    try:
        p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=3, check=False)
        return (p.stdout.strip() or p.stderr.strip())[:200] if p.returncode == 0 else "unavailable"
    except (OSError, subprocess.TimeoutExpired):
        return "unavailable"

def read(path):
    try:
        return Path(path).read_text()
    except OSError:
        return ""

def state():
    d = shutil.disk_usage("/")
    mem = dict(line.split(":", 1) for line in read("/proc/meminfo").splitlines() if ":" in line)
    total = int(mem.get("MemTotal", "0 kB").strip().split()[0])
    available = int(mem.get("MemAvailable", "0 kB").strip().split()[0])
    try:
        load = list(os.getloadavg())
    except OSError:
        load = [0, 0, 0]
    return {
        "hostname": os.uname().nodename,
        "uptime_hours": round(float(read("/proc/uptime").split()[0]) / 3600, 1),
        "disk_percent": round(d.used / d.total * 100, 1),
        "disk_free_gb": round(d.free / 1000000000, 1),
        "ram_percent": round((total - available) / total * 100, 1) if total else 0,
        "ram_total_gb": round(total / 1000000, 1),
        "load": [round(x, 2) for x in load],
        "branch": run(["git", "branch", "--show-current"]),
        "commit": run(["git", "rev-parse", "--short", "HEAD"]),
        "working_tree": run(["git", "status", "--porcelain"]) or "clean",
        "remote": "JDisTheCoolest/hackformiami",
        "cloudflared": run(["systemctl", "is-active", "cloudflared"]),
        "manager": "active",
        "updated": int(time.time()),
    }

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>HackForMiami · Pi Control</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#e9f2ff;background:#07121e}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 85% 0%,#163b49 0%,#0b1929 35%,#07121e 73%);min-height:100vh}
.layout{display:grid;grid-template-columns:230px 1fr;min-height:100vh}
aside{border-right:1px solid #284153;padding:28px 18px;background:#091825b8}
.brand{font-size:21px;font-weight:850;letter-spacing:-.9px;margin-bottom:9px}.brand b{color:#54e3d0}
.subtitle,.muted{color:#91acbc}.subtitle{font-size:12px}
.nav{margin-top:38px;display:grid;gap:7px}
.nav a{color:#acc2d1;text-decoration:none;border-radius:11px;padding:13px 12px;font-weight:650;font-size:14px}
.nav a:hover,.nav a.active{color:#dffffa;background:#16423e}
.sidefoot{margin-top:40px;font-size:12px;line-height:1.8;color:#84a6b5}
main{width:100%;max-width:1280px;padding:36px clamp(20px,4vw,64px);margin:auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}
.eyebrow{text-transform:uppercase;letter-spacing:2.5px;font-size:11px;color:#54d9c5;font-weight:800}
h1{font-size:clamp(27px,4vw,42px);letter-spacing:-1.7px;margin:7px 0}h2{font-size:18px;letter-spacing:-.5px;margin:0 0 18px}
p{color:#94adbf;margin:7px 0}.live{border:1px solid #2b655e;background:#13312f;color:#6be9bc;border-radius:100px;padding:9px 14px;font-size:12px;font-weight:750}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:28px}
.card,.panel{background:#101f30dd;border:1px solid #294052;border-radius:17px;padding:22px}
.label{font-size:13px;color:#96aebe;font-weight:650}.value{font-size:30px;font-weight:850;letter-spacing:-1px;margin:14px 0 4px}
.small{font-size:12px;color:#7e9cad}.bar{height:7px;border-radius:99px;background:#283d4a;margin-top:17px;overflow:hidden}.fill{height:100%;width:0;background:linear-gradient(90deg,#1dc9c0,#6ee7af);transition:width .5s}
.split{display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin-top:16px}.rows{display:grid;gap:17px}
.line{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-bottom:15px;border-bottom:1px solid #293d4d}
.line:last-child{padding-bottom:0;border-bottom:0}
.key{color:#9fb7c9;font-size:14px}.val{font-size:14px;font-weight:760;overflow-wrap:anywhere}
.pill{border:1px solid #345448;border-radius:80px;color:#7be9b5;padding:6px 10px;font-size:12px;font-weight:700}
.bad{color:#ffb4a7;border-color:#885149}.warning{color:#f7cd8e;border-color:#866b44}
.section{margin-top:18px}.action{display:inline-flex;align-items:center;gap:8px;padding:11px 15px;background:#174d48;border:1px solid #286b5c;border-radius:10px;color:#bcfff2;font-weight:700;text-decoration:none;font-size:13px;margin-top:12px}
button{background:#164b46;border:1px solid #286c60;color:#c3fff4;font-weight:750;border-radius:10px;padding:10px 16px;cursor:pointer}button:hover{background:#206158}
.notice{padding:13px 16px;border:1px solid #715d3d;background:#3a2c1c66;border-radius:11px;color:#f2ca8e;font-size:12px;margin-top:17px}
code{font-size:12px;color:#b1e9db;word-break:break-word}
@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.split{grid-template-columns:1fr}}
@media(max-width:650px){.layout{display:block}aside{padding:16px;border-right:0;border-bottom:1px solid #294052}.nav{display:flex;gap:4px;margin-top:13px;overflow-x:auto}.nav a{padding:9px}.sidefoot{display:none}main{padding:25px 17px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.card,.panel{padding:16px}.value{font-size:24px}}
</style></head><body><div class="layout">
<aside><div class="brand">⚡ Hack<b>ForMiami</b></div><div class="subtitle">RASPBERRY PI MANAGER</div>
<nav class="nav"><a class="active" href="#overview">◈ Overview</a><a href="#services">◉ Services</a><a href="#deployment">⌘ Deployment</a></nav>
<div class="sidefoot">Private management interface<br>Read-only diagnostics<br>Cloudflare Access recommended</div></aside>
<main id="overview"><div class="top"><div><div class="eyebrow">Infrastructure / Server overview</div><h1>Control center</h1><p>Live telemetry from your HackForMiami Raspberry Pi.</p></div><div><span id="live" class="live">● Connecting</span> <button id="refresh" type="button">↻ Refresh</button></div></div>
<div class="grid">
<div class="card"><div class="label">CPU load · 1 min</div><div class="value" id="cpu">—</div><div class="small">System load average</div></div>
<div class="card"><div class="label">Memory used</div><div class="value" id="ram">—</div><div class="small" id="rammeta">—</div><div class="bar"><div id="rambar" class="fill"></div></div></div>
<div class="card"><div class="label">Disk used</div><div class="value" id="disk">—</div><div class="small" id="diskmeta">—</div><div class="bar"><div id="diskbar" class="fill"></div></div></div>
<div class="card"><div class="label">System uptime</div><div class="value" id="uptime">—</div><div class="small">Hours since startup</div></div></div>
<div class="split">
<section class="panel" id="services"><h2>Services</h2><div class="rows">
<div class="line"><span class="key">Manager web interface</span><span id="manager" class="pill">Checking</span></div>
<div class="line"><span class="key">Cloudflare Tunnel connector</span><span id="tunnel" class="pill warning">Checking</span></div>
<div class="line"><span class="key">Hostname</span><span id="hostname" class="val">—</span></div>
</div><div class="notice">Remote access must be protected with Cloudflare Access. A running tunnel alone does not authenticate users.</div></section>
<section class="panel" id="deployment"><h2>GitHub deployment</h2><div class="rows">
<div class="line"><span class="key">Repository</span><span class="val">JDisTheCoolest/hackformiami</span></div>
<div class="line"><span class="key">Branch</span><span id="branch" class="val">—</span></div>
<div class="line"><span class="key">Commit</span><code id="commit">—</code></div>
<div class="line"><span class="key">Working tree</span><span id="dirty" class="val">—</span></div>
</div><a class="action" href="https://github.com/JDisTheCoolest/hackformiami" target="_blank" rel="noopener noreferrer">↗ Open repository</a></section></div>
<section class="panel section"><h2>Deployment operations</h2><p>This interface deliberately does not run shell commands, restart services, or accept deployment tokens. Update through the Pi terminal using the checked-in installation script.</p>
<code>cd /opt/hackformiami && git pull --ff-only && bash deploy/install-manager.sh</code>
<p id="updated" class="small" style="margin-top:18px">Waiting for system data…</p></section>
</main></div>
<script>
const el=id=>document.getElementById(id);
const value=(id,x)=>el(id).textContent=x;
function badge(id,status){const e=el(id);e.textContent=status; e.className='pill'+(status==='active'?'':' bad')}
async function refresh(){
try{
const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
const d=await r.json();
value('cpu',String(d.load[0]));value('ram',d.ram_percent+'%');value('rammeta',d.ram_total_gb+' GB RAM total');
value('disk',d.disk_percent+'%');value('diskmeta',d.disk_free_gb+' GB available');
el('rambar').style.width=d.ram_percent+'%';el('diskbar').style.width=d.disk_percent+'%';
value('uptime',d.uptime_hours+'h');value('hostname',d.hostname);
value('branch',d.branch);value('commit',d.commit);value('dirty',d.working_tree==='clean'?'Clean':'Changes detected');
badge('manager',d.manager);badge('tunnel',d.cloudflared);
value('live','● Online');value('updated','Last updated: '+new Date(d.updated*1000).toLocaleString());
}catch(e){value('live','● Offline');value('updated','Unable to retrieve status: '+e.message)}
}
el('refresh').addEventListener('click',refresh);refresh();setInterval(refresh,15000);
</script></body></html>"""

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/health":
            data, mime = json.dumps({"status": "ok", "service": "hackformiami-manager"}).encode(), "application/json"
        elif path == "/api/status":
            data, mime = json.dumps(state()).encode(), "application/json"
        elif path == "/":
            data, mime = PAGE.encode(), "text/html; charset=utf-8"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        for k, v in [
            ("Content-Type", mime), ("Content-Length", str(len(data))),
            ("Cache-Control", "no-store"), ("X-Content-Type-Options", "nosniff"),
            ("Referrer-Policy", "no-referrer"),
            ("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"),
        ]: self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
