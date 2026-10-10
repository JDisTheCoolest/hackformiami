#!/usr/bin/env python3
"""Native HackForMiami Pi Manager — local desktop only, no HTTP server."""
import os
import shutil
import subprocess
import sys
import tkinter as tk
from pathlib import Path
from tkinter import ttk, messagebox
import re
import threading
import webbrowser

ROOT = Path("/opt/hackformiami")
SOURCE = ROOT / "manager" / "desktop.py"
UPDATES = Path("/var/lib/hackformiami-update/status")
BG, PANEL, PANEL2 = "#0a1423", "#152439", "#1b3048"
FG, MUTED, ACCENT = "#eaf4ff", "#9fb4ca", "#59dfc5"

def cmd(*args):
    try:
        p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=5)
        return (p.stdout.strip() or p.stderr.strip())[:180] if p.returncode == 0 else "unavailable"
    except (OSError, subprocess.TimeoutExpired):
        return "unavailable"

def state():
    disk = shutil.disk_usage("/")
    mem = {}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if ":" in line:
                key, val = line.split(":", 1)
                mem[key] = int(val.strip().split()[0])
        uptime = round(float(Path("/proc/uptime").read_text().split()[0])/3600,1)
    except (OSError, ValueError, IndexError):
        uptime = 0
    total = mem.get("MemTotal", 0)
    avail = mem.get("MemAvailable", 0)
    try: load = round(os.getloadavg()[0], 2)
    except OSError: load = 0
    try: update = UPDATES.read_text().strip()
    except OSError: update = "No update check yet"
    return {
        "CPU load": str(load),
        "RAM usage": f"{(total-avail)*100/total:.1f}%" if total else "N/A",
        "Disk usage": f"{disk.used*100/disk.total:.1f}%",
        "Uptime": f"{uptime} hours",
        "Host": os.uname().nodename,
        "Branch": cmd("git","branch","--show-current"),
        "Commit": cmd("git","rev-parse","--short","HEAD"),
        "Git changes": cmd("git","status","--porcelain") or "Clean",
        "Cloudflare": cmd("systemctl","is-active","cloudflared"),
        "Update timer": cmd("systemctl","is-active","hackformiami-update.timer"),
        "Last update": update,
    }

class Manager(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("HackForMiami — Organizer Manager")
        self.geometry("1150x750")
        self.minsize(850, 550)
        self.configure(bg=BG)
        self.origin_mtime = SOURCE.stat().st_mtime_ns
        self.views = {}
        self.selected = tk.StringVar(value="Dashboard")
        side = tk.Frame(self, bg="#0e1c2d", width=230)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        tk.Label(side, text="⚡ HACK FOR MIAMI", bg="#0e1c2d", fg=ACCENT, font=("DejaVu Sans", 15, "bold")).pack(anchor="w", padx=20, pady=(27, 4))
        tk.Label(side, text="PRIVATE PI DESKTOP MANAGER", bg="#0e1c2d", fg=MUTED, font=("DejaVu Sans", 9)).pack(anchor="w", padx=20, pady=(0, 27))
        for name in ("Dashboard", "Website & AI", "Events", "Content & Media", "Registrations", "Deployment", "Cloudflare", "Backups", "Settings"):
            tk.Button(side, text="  "+name, anchor="w", bg="#0e1c2d", fg=FG, activebackground="#22463f", activeforeground=FG,
                      relief="flat", bd=0, padx=13, pady=14, font=("DejaVu Sans", 11),
                      command=lambda n=name:self.show(n)).pack(fill="x", padx=9, pady=1)
        tk.Label(side,text="Local only • Pi Connect compatible",bg="#0e1c2d",fg=MUTED,font=("DejaVu Sans",9),wraplength=195).pack(side="bottom",padx=10,pady=23)
        self.content = tk.Frame(self, bg=BG)
        self.content.pack(side="left", fill="both", expand=True, padx=32, pady=28)
        self.show("Dashboard")
        self.after(1000, self.refresh)

    def clear(self):
        for widget in self.content.winfo_children(): widget.destroy()

    def heading(self, name, description):
        tk.Label(self.content,text=name,bg=BG,fg=FG,font=("DejaVu Sans",25,"bold")).pack(anchor="w")
        tk.Label(self.content,text=description,bg=BG,fg=MUTED,font=("DejaVu Sans",10)).pack(anchor="w",pady=(5,22))

    def show(self, name):
        self.selected.set(name)
        self.clear()
        if name == "Dashboard":
            self.heading("Overview","Live Raspberry Pi and deployment diagnostics")
            self.data = tk.Frame(self.content,bg=BG)
            self.data.pack(fill="both",expand=True)
            self.render_data()
            tk.Button(self.content,text="Refresh now",command=self.render_data,bg="#176657",fg=FG,relief="flat",padx=20,pady=12).pack(anchor="w",pady=15)
        elif name == "Website & AI":
            self.site_screen()
        elif name == "Deployment":
            self.heading("GitHub deployment","Automatic 30-second GitHub checks")
            self.data = tk.Frame(self.content,bg=BG)
            self.data.pack(fill="both",expand=True)
            self.render_data(keys=["Branch","Commit","Git changes","Update timer","Last update"])
            tk.Label(self.content,text="GitHub main is fast-forwarded when clean; no forced overwrite of local edits.",bg=BG,fg=MUTED,wraplength=650).pack(anchor="w")
        elif name == "Cloudflare":
            self.cloudflare_screen()
        else:
            self.heading(name, "Organizer workspace")
            panel=tk.Frame(self.content,bg=PANEL,padx=28,pady=28)
            panel.pack(fill="x")
            tk.Label(panel,text=name+" is ready for future integration.",bg=PANEL,fg=FG,font=("DejaVu Sans",15,"bold")).pack(anchor="w")
            tk.Label(panel,text="This manager does not invent a backend or modify the HackForMiami website. This section will connect when the corresponding application module exists.",bg=PANEL,fg=MUTED,wraplength=600,justify="left").pack(anchor="w",pady=(12,0))

    def site_screen(self):
        self.heading("Website & AI", "Run the Vite website, FastAPI endpoints and Gemma analysis on this Pi")
        area=tk.Frame(self.content,bg=PANEL,padx=24,pady=22)
        area.pack(fill="both",expand=True)
        self.site_status=tk.StringVar(value="Checking backend and model configuration...")
        tk.Label(area,textvariable=self.site_status,bg=PANEL,fg=ACCENT,font=("DejaVu Sans",11),wraplength=630,justify="left").pack(anchor="w",pady=9)
        tk.Label(area,text="Local service: http://127.0.0.1:8000  ·  Public Cloudflare route should point here.",bg=PANEL,fg=MUTED,wraplength=620,justify="left").pack(anchor="w",pady=8)
        tk.Button(area,text="Install / update website and API",bg="#176657",fg=FG,relief="flat",padx=13,pady=11,command=self.install_site).pack(anchor="w",pady=10)
        tk.Button(area,text="Check service and AI mode",bg=PANEL2,fg=FG,relief="flat",padx=13,pady=10,command=self.check_site).pack(anchor="w",pady=7)
        tk.Label(area,text="AI configuration: the backend uses GEMINI_API_KEY from /etc/hackformiami/backend.env. With no key, it explicitly runs in MOCK mode (sample results).",bg=PANEL,fg=MUTED,wraplength=650,justify="left").pack(anchor="w",pady=12)
        tk.Label(area,text="To set the AI key securely, use the Pi terminal: sudoedit /etc/hackformiami/backend.env\nThen: sudo systemctl restart hackformiami-site",bg=PANEL,fg="#f1d395",wraplength=650,justify="left").pack(anchor="w",pady=12)
        tk.Label(area,text="The current app/ directory contains no functional reporting frontend yet, so /app/ may still be unavailable even when the landing page and API work.",bg=PANEL,fg=MUTED,wraplength=650,justify="left").pack(anchor="w")
        self.check_site()

    def check_site(self):
        def worker():
            status=cmd("systemctl","is-active","hackformiami-site")
            try:
                from urllib.request import urlopen
                with urlopen("http://127.0.0.1:8000/api/health",timeout=4) as resp:
                    import json
                    d=json.load(resp)
                output=f"Website/API service: {status} | API: healthy | AI mode: {'MOCK (no key)' if d.get('mock') else 'Configured ('+str(d.get('model'))+')'}"
            except Exception as e:
                output=f"Website/API service: {status} | API unreachable: {str(e)[:100]}"
            self.after(0,lambda:self.site_status.set(output) if self.selected.get()=="Website & AI" else None)
        threading.Thread(target=worker,daemon=True).start()

    def install_site(self):
        if not messagebox.askyesno("Install website","Build React site, install Python dependencies and configure a local FastAPI system service? Admin authorization is required."):return
        self.site_status.set("Installing dependencies and building website...")
        def worker():
            try:
                p=subprocess.run(["pkexec","/usr/local/sbin/hackformiami-site-install"],capture_output=True,text=True,timeout=720)
                result="Website/API installed; check health." if p.returncode==0 else "Install error: "+(p.stderr or p.stdout)[-400:]
            except (OSError,subprocess.TimeoutExpired) as e:result=str(e)
            self.after(0,lambda:(self.site_status.set(result),self.check_site()))
        threading.Thread(target=worker,daemon=True).start()

    def cloudflare_screen(self):
        self.heading("Cloudflare Tunnel", "Connect your public HackForMiami site to a Cloudflare-managed hostname")
        self.cf_status = tk.StringVar(value="Checking connector...")
        self.cf_result = tk.StringVar(value="Cloudflare Tunnel credentials stay on this Pi, never in GitHub.")
        self.cf_token = tk.StringVar()
        self.cf_port = tk.StringVar(value="8000")
        frame=tk.Frame(self.content,bg=PANEL,padx=22,pady=19)
        frame.pack(fill="both",expand=True)
        def label(text):
            tk.Label(frame,text=text,bg=PANEL,fg=FG,font=("DejaVu Sans",11,"bold"),anchor="w").pack(anchor="w",pady=(12,5))
        label("1. Create a remotely managed tunnel")
        tk.Label(frame,text="Open Zero Trust → Networks → Tunnels → Create tunnel. Choose Cloudflared, then copy the connector token (not the entire shell command).",bg=PANEL,fg=MUTED,wraplength=620,justify="left").pack(anchor="w")
        tk.Button(frame,text="Open Cloudflare Zero Trust ↗",command=lambda:webbrowser.open("https://one.dash.cloudflare.com/"),bg="#176657",fg=FG,relief="flat",padx=13,pady=9).pack(anchor="w",pady=8)
        label("2. Install connector on this Pi")
        tk.Label(frame,textvariable=self.cf_status,bg=PANEL,fg=ACCENT).pack(anchor="w")
        tk.Label(frame,text="Paste only the tunnel token (usually a long eyJ... value). The GUI will request your system authorization and start cloudflared.",bg=PANEL,fg=MUTED,wraplength=620,justify="left").pack(anchor="w")
        ent=tk.Entry(frame,textvariable=self.cf_token,show="•",width=60,bg=PANEL2,fg=FG,insertbackground=FG,relief="flat",font=("DejaVu Sans",11))
        ent.pack(anchor="w",fill="x",pady=8,ipady=8)
        tk.Button(frame,text="Install / connect tunnel",command=self.install_tunnel,bg="#176657",fg=FG,relief="flat",padx=13,pady=10).pack(anchor="w")
        label("3. Route the public website")
        tk.Label(frame,text="In Cloudflare's tunnel settings, add a published application route. Use HTTPS hostname you control; service Type HTTP, URL http://127.0.0.1:8000. The local backend/site service must also be started separately.",bg=PANEL,fg=MUTED,wraplength=620,justify="left").pack(anchor="w")
        tk.Label(frame,text="Do NOT route this desktop manager through the tunnel. Keep it accessible through Pi Connect.",bg=PANEL,fg="#f2c789",wraplength=620,justify="left").pack(anchor="w",pady=8)
        tk.Button(frame,text="Check connection",command=self.check_tunnel,bg=PANEL2,fg=FG,relief="flat",padx=13,pady=9).pack(anchor="w",pady=5)
        tk.Label(frame,textvariable=self.cf_result,bg=PANEL,fg=MUTED,wraplength=620,justify="left").pack(anchor="w",pady=8)
        self.check_tunnel()

    def check_tunnel(self):
        def work():
            installed=shutil.which("cloudflared") is not None
            service=cmd("systemctl","is-active","cloudflared")
            local=cmd("curl","-fsS","-o","/dev/null","-w","%{http_code}","--max-time","3","http://127.0.0.1:8000/api/health")
            def paint():
                if not self.selected.get()=="Cloudflare":return
                self.cf_status.set(f"cloudflared: {'installed' if installed else 'missing'} | service: {service}")
                self.cf_result.set(f"Local website/backend at port 8000: HTTP {local}. Check your Cloudflare hostname externally after routing.")
            self.after(0,paint)
        threading.Thread(target=work,daemon=True).start()

    def install_tunnel(self):
        token=self.cf_token.get().strip()
        if not re.fullmatch(r"[A-Za-z0-9_\\-.=]{50,4096}",token):
            messagebox.showerror("Invalid token","Paste only the Cloudflare tunnel connector token, not a command or URL.")
            return
        if not messagebox.askyesno("Install Cloudflare Tunnel","Authorize installation of this Cloudflare connector as a system service on this Pi?"):
            return
        self.cf_token.set("")
        self.cf_result.set("Requesting system authentication...")
        def work():
            try:
                p=subprocess.run(["pkexec","/usr/local/sbin/hackformiami-cloudflared-install"],input=token+"\\n",text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
                msg="Tunnel connector installed successfully." if p.returncode==0 else "Install failed: "+(p.stderr or p.stdout)[-400:]
            except (OSError, subprocess.TimeoutExpired) as ex:msg="Installer unavailable: "+str(ex)
            self.after(0,lambda: (self.cf_result.set(msg),self.check_tunnel()))
        threading.Thread(target=work,daemon=True).start()

    def render_data(self, keys=None):
        if not hasattr(self,"data") or not self.data.winfo_exists(): return
        for w in self.data.winfo_children(): w.destroy()
        d=state()
        if keys is None: keys=["CPU load","RAM usage","Disk usage","Uptime","Host","Commit","Cloudflare","Update timer","Last update"]
        for idx,key in enumerate(keys):
            frame=tk.Frame(self.data,bg=PANEL,padx=18,pady=16)
            frame.grid(row=idx//2,column=idx%2,padx=7,pady=7,sticky="nsew")
            tk.Label(frame,text=key.upper(),bg=PANEL,fg=MUTED,font=("DejaVu Sans",9,"bold")).pack(anchor="w")
            tk.Label(frame,text=d.get(key,"—"),bg=PANEL,fg=ACCENT,font=("DejaVu Sans",13,"bold"),wraplength=325,justify="left").pack(anchor="w",pady=(9,0))
        self.data.columnconfigure(0,weight=1)
        self.data.columnconfigure(1,weight=1)

    def refresh(self):
        try:
            if SOURCE.stat().st_mtime_ns != self.origin_mtime:
                self.destroy()
                os.execv(sys.executable, [sys.executable, str(SOURCE)])
                return
            if self.selected.get() in ("Dashboard","Deployment","Cloudflare"): self.render_data()
        except OSError: pass
        self.after(15000,self.refresh)

if __name__ == "__main__":
    Manager().mainloop()
