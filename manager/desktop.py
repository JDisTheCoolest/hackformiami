#!/usr/bin/env python3
"""Native HackForMiami Pi Manager — local desktop only, no HTTP server."""
import os
import shutil
import subprocess
import sys
import tkinter as tk
from pathlib import Path
from tkinter import ttk, messagebox

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
        for name in ("Dashboard", "Events", "Content & Media", "Registrations", "Deployment", "Cloudflare", "Backups", "Settings"):
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
        elif name == "Deployment":
            self.heading("GitHub deployment","Automatic 30-second GitHub checks")
            self.data = tk.Frame(self.content,bg=BG)
            self.data.pack(fill="both",expand=True)
            self.render_data(keys=["Branch","Commit","Git changes","Update timer","Last update"])
            tk.Label(self.content,text="GitHub main is fast-forwarded when clean; no forced overwrite of local edits.",bg=BG,fg=MUTED,wraplength=650).pack(anchor="w")
        elif name == "Cloudflare":
            self.heading("Cloudflare Tunnel","Public application routing, separate from this private desktop manager")
            self.data = tk.Frame(self.content,bg=BG)
            self.data.pack(fill="both",expand=True)
            self.render_data(keys=["Cloudflare","Host"])
            tk.Label(self.content,text="The native manager is not exposed through Cloudflare. Use Pi Connect to reach this desktop. Configure a separate tunnel route for the future public website.",bg=BG,fg=MUTED,wraplength=660,justify="left").pack(anchor="w")
        else:
            self.heading(name, "Organizer workspace")
            panel=tk.Frame(self.content,bg=PANEL,padx=28,pady=28)
            panel.pack(fill="x")
            tk.Label(panel,text=name+" is ready for future integration.",bg=PANEL,fg=FG,font=("DejaVu Sans",15,"bold")).pack(anchor="w")
            tk.Label(panel,text="This manager does not invent a backend or modify the HackForMiami website. This section will connect when the corresponding application module exists.",bg=PANEL,fg=MUTED,wraplength=600,justify="left").pack(anchor="w",pady=(12,0))

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
