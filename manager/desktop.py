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
from supabase_manager import diagnostics, list_users, migration_files, set_user_disabled

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
        self.selected = tk.StringVar(value="Overview")
        side = tk.Frame(self, bg="#0e1c2d", width=230)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        tk.Label(side, text="⚡ HACK FOR MIAMI", bg="#0e1c2d", fg=ACCENT, font=("DejaVu Sans", 15, "bold")).pack(anchor="w", padx=20, pady=(27, 4))
        tk.Label(side, text="PRIVATE PI DESKTOP MANAGER", bg="#0e1c2d", fg=MUTED, font=("DejaVu Sans", 9)).pack(anchor="w", padx=20, pady=(0, 27))
        for name in ("Overview", "Website & API", "Supabase", "Users", "AI Analysis", "Camera & Speaker", "Reports & Alerts", "GitHub Updates", "Cloudflare"):
            tk.Button(side, text="  "+name, anchor="w", bg="#0e1c2d", fg=FG, activebackground="#22463f", activeforeground=FG,
                      relief="flat", bd=0, padx=13, pady=14, font=("DejaVu Sans", 11),
                      command=lambda n=name:self.show(n)).pack(fill="x", padx=9, pady=1)
        tk.Label(side,text="Local only • Pi Connect compatible",bg="#0e1c2d",fg=MUTED,font=("DejaVu Sans",9),wraplength=195).pack(side="bottom",padx=10,pady=23)
        self.content = tk.Frame(self, bg=BG)
        self.content.pack(side="left", fill="both", expand=True, padx=32, pady=28)
        self.show("Overview")
        self.after(1000, self.refresh)

    def clear(self):
        for widget in self.content.winfo_children(): widget.destroy()

    def heading(self, name, description):
        tk.Label(self.content,text=name,bg=BG,fg=FG,font=("DejaVu Sans",25,"bold")).pack(anchor="w")
        tk.Label(self.content,text=description,bg=BG,fg=MUTED,font=("DejaVu Sans",10)).pack(anchor="w",pady=(5,22))

    def show(self, name):
        self.selected.set(name)
        self.clear()
        if name == "Overview":
            self.heading("Overview","Live Raspberry Pi and deployment diagnostics")
            self.data = tk.Frame(self.content,bg=BG)
            self.data.pack(fill="both",expand=True)
            self.render_data()
            tk.Button(self.content,text="Refresh now",command=self.render_data,bg="#176657",fg=FG,relief="flat",padx=20,pady=12).pack(anchor="w",pady=15)
        elif name == "Website & API":
            self.site_screen()
        elif name == "Supabase":
            self.supabase_screen()
        elif name == "Users":
            self.users_screen()
        elif name == "GitHub Updates":
            self.heading("GitHub deployment","Review and explicitly deploy fast-forward updates")
            self.data = tk.Frame(self.content,bg=BG)
            self.data.pack(fill="x")
            self.render_data(keys=["Branch","Commit","Git changes","Update timer","Last update"])
            self.deploy_status=tk.StringVar(value="Fetch checks only; deployment requires confirmation.")
            tk.Label(self.content,textvariable=self.deploy_status,bg=BG,fg=MUTED,wraplength=760,justify="left").pack(anchor="w",pady=8)
            row=tk.Frame(self.content,bg=BG); row.pack(anchor="w")
            tk.Button(row,text="Fetch & preview",command=self.preview_deploy,bg=PANEL2,fg=FG,relief="flat",padx=14,pady=9).pack(side="left",padx=(0,8))
            tk.Button(row,text="Deploy approved update",command=self.deploy_update,bg="#176657",fg=FG,relief="flat",padx=14,pady=9).pack(side="left")
            tk.Label(self.content,text="Local changes, detached branches, and diverged history are refused. The workflow never resets or cleans the repository.",bg=BG,fg="#f1d395",wraplength=720,justify="left").pack(anchor="w",pady=8)
        elif name == "AI Analysis":
            self.ai_screen()
        elif name == "Camera & Speaker":
            self.camera_screen()
        elif name == "Reports & Alerts":
            self.reports_screen()
        elif name == "Cloudflare":
            self.cloudflare_screen()
        else:
            self.heading(name, "Application manager")
            panel=tk.Frame(self.content,bg=PANEL,padx=28,pady=28)
            panel.pack(fill="x")
            tk.Label(panel,text=name+" is ready for future integration.",bg=PANEL,fg=FG,font=("DejaVu Sans",15,"bold")).pack(anchor="w")
            tk.Label(panel,text="This manager does not invent a backend or modify the HackForMiami website. This section will connect when the corresponding application module exists.",bg=PANEL,fg=MUTED,wraplength=600,justify="left").pack(anchor="w",pady=(12,0))

    def api_summary(self, endpoint):
        import json
        from urllib.request import urlopen
        try:
            with urlopen("http://127.0.0.1:8000"+endpoint,timeout=4) as response:
                return json.load(response)
        except Exception as exc:
            return {"error":str(exc)[:100]}

    def preview_deploy(self):
        self.deploy_status.set("Fetching remote branch and calculating pending commits...")
        def work():
            try:
                p=subprocess.run(["/usr/local/sbin/hackformiami-safe-deploy","preview"],capture_output=True,text=True,timeout=60)
                result=(p.stdout or p.stderr)[-2000:] or "No output"
            except (OSError,subprocess.TimeoutExpired) as exc: result=f"Preview failed: {exc}"
            self.after(0,lambda:self.deploy_status.set(result) if self.selected.get()=="GitHub Updates" else None)
        threading.Thread(target=work,daemon=True).start()

    def deploy_update(self):
        if not messagebox.askyesno("Deploy update","Deploy the reviewed commits, rebuild frontend/backend, restart the service, and verify health?"): return
        self.deploy_status.set("Deploying; logs are retained in /var/lib/hackformiami-update/deploy.log ...")
        def work():
            try:
                p=subprocess.run(["pkexec","/usr/local/sbin/hackformiami-safe-deploy","apply"],capture_output=True,text=True,timeout=1200)
                result=(p.stdout or p.stderr)[-2500:] or "Deployment produced no output"
                if p.returncode: result="DEPLOYMENT FAILED\n"+result
            except (OSError,subprocess.TimeoutExpired) as exc: result=f"Deployment failed: {exc}"
            self.after(0,lambda:self.deploy_status.set(result) if self.selected.get()=="GitHub Updates" else None)
        threading.Thread(target=work,daemon=True).start()

    def supabase_screen(self):
        self.heading("Supabase", "Authentication, schema, storage and migration diagnostics")
        area=tk.Frame(self.content,bg=PANEL,padx=22,pady=18)
        area.pack(fill="both",expand=True)
        self.supabase_text=tk.StringVar(value="Checking Supabase without exposing credentials...")
        tk.Label(area,textvariable=self.supabase_text,bg=PANEL,fg=FG,justify="left",anchor="nw",wraplength=740,font=("DejaVu Sans Mono",10)).pack(fill="both",expand=True,anchor="w")
        tk.Button(area,text="Refresh diagnostics",command=self.refresh_supabase,bg="#176657",fg=FG,relief="flat",padx=14,pady=10).pack(anchor="w",pady=8)
        row=tk.Frame(area,bg=PANEL); row.pack(anchor="w")
        tk.Button(row,text="Check migration history",command=self.check_migrations,bg=PANEL2,fg=FG,relief="flat",padx=12,pady=8).pack(side="left",padx=(0,8))
        tk.Button(row,text="Backup & apply pending",command=self.apply_migrations,bg="#68402f",fg=FG,relief="flat",padx=12,pady=8).pack(side="left")
        tk.Label(area,text="Migration status is Unknown unless an authorized database connection checks Supabase's migration history. Migrations are never applied at startup or during Git fetch.",bg=PANEL,fg="#f1d395",wraplength=720,justify="left").pack(anchor="w")
        self.refresh_supabase()

    def refresh_supabase(self):
        def work():
            d=diagnostics(ROOT)
            tables=", ".join(f"{k}: {v}" for k,v in d["tables"].items()) or "Not checked"
            buckets=", ".join(f"{k}: {v}" for k,v in d["buckets"].items()) or "Not checked"
            migrations="\n".join(f"  {m['name']}: {m['status']}" for m in migration_files(ROOT)) or "  No migration files"
            count="Not authorized" if d["user_count"] is None else str(d["user_count"])
            output=(f"Connection: {d['status']}\nProject: {d['project_url']}\nAuth API: {d['auth']}\n"
                    f"FastAPI JWT verification: {d['jwt_endpoint']}\nDatabase tables: {tables}\n"
                    f"Storage: {buckets}\nUsers: {count}\nAdmin credentials: {'Configured' if d['admin_configured'] else 'Not configured'}\n"
                    f"Diagnostic: {d['diagnostic']}\n\nMigrations:\n{migrations}\n\n"
                    "To check/apply migrations manually: open the Supabase Dashboard SQL Editor, review each pending file under supabase/migrations in filename order, take a database backup, then run only the reviewed file. Do not use the publishable key for migrations.")
            self.after(0,lambda:self.supabase_text.set(output) if self.selected.get()=="Supabase" else None)
        threading.Thread(target=work,daemon=True).start()

    def check_migrations(self):
        self.supabase_text.set("Checking the configured project's Supabase migration history...")
        def work():
            try:
                p=subprocess.run(["pkexec","/usr/local/sbin/hackformiami-supabase-migrations","status"],capture_output=True,text=True,timeout=60)
                result=(p.stdout or p.stderr)[-4000:] or "No migration status returned"
            except (OSError,subprocess.TimeoutExpired) as exc: result=f"Migration check failed: {exc}"
            self.after(0,lambda:self.supabase_text.set(result) if self.selected.get()=="Supabase" else None)
        threading.Thread(target=work,daemon=True).start()

    def apply_migrations(self):
        if not messagebox.askyesno("Apply pending migrations","This will first create a database backup, then apply only pending checked-in migration files in order. Continue?"): return
        self.supabase_text.set("Backing up the database before applying approved migrations...")
        def work():
            try:
                p=subprocess.run(["pkexec","/usr/local/sbin/hackformiami-supabase-migrations","apply"],capture_output=True,text=True,timeout=1200)
                result=(p.stdout or p.stderr)[-5000:] or "No migration output"
                if p.returncode: result="MIGRATION FAILED\n"+result
            except (OSError,subprocess.TimeoutExpired) as exc: result=f"Migration failed: {exc}"
            self.after(0,lambda:self.supabase_text.set(result) if self.selected.get()=="Supabase" else None)
        threading.Thread(target=work,daemon=True).start()

    def users_screen(self):
        self.heading("Supabase users", "Local-only account administration using server credentials")
        area=tk.Frame(self.content,bg=PANEL,padx=20,pady=18)
        area.pack(fill="both",expand=True)
        self.user_status=tk.StringVar(value="Loading authorized user list...")
        tk.Label(area,textvariable=self.user_status,bg=PANEL,fg=MUTED,anchor="w").pack(fill="x")
        columns=("id","email","created","verified","status")
        self.user_tree=ttk.Treeview(area,columns=columns,show="headings",height=13)
        for col,width in zip(columns,(220,220,150,75,80)):
            self.user_tree.heading(col,text=col.upper()); self.user_tree.column(col,width=width,stretch=True)
        self.user_tree.pack(fill="both",expand=True,pady=10)
        buttons=tk.Frame(area,bg=PANEL); buttons.pack(anchor="w")
        tk.Button(buttons,text="Refresh",command=self.load_users,bg=PANEL2,fg=FG,relief="flat",padx=12,pady=8).pack(side="left",padx=(0,8))
        tk.Button(buttons,text="Disable selected",command=lambda:self.change_user(True),bg="#68402f",fg=FG,relief="flat",padx=12,pady=8).pack(side="left",padx=4)
        tk.Button(buttons,text="Re-enable selected",command=lambda:self.change_user(False),bg="#176657",fg=FG,relief="flat",padx=12,pady=8).pack(side="left",padx=4)
        self.load_users()

    def load_users(self):
        def work():
            try: users,error=list_users(ROOT),None
            except Exception as exc: users,error=[],str(exc)
            def paint():
                if self.selected.get()!="Users": return
                for item in self.user_tree.get_children(): self.user_tree.delete(item)
                for user in users:
                    self.user_tree.insert("", "end", values=(user["id"],user["email"],user["created_at"][:19],"Yes" if user["verified"] else "No",user["status"]))
                self.user_status.set(error or f"{len(users)} account(s). Passwords and tokens are never retrieved.")
            self.after(0,paint)
        threading.Thread(target=work,daemon=True).start()

    def change_user(self, disabled):
        selected=self.user_tree.selection()
        if not selected:
            messagebox.showwarning("Select account","Select one account first."); return
        values=self.user_tree.item(selected[0],"values"); user_id,email=values[0],values[1]
        action="disable" if disabled else "re-enable"
        if not messagebox.askyesno("Confirm account change",f"{action.capitalize()} {email or user_id}? This uses local server-only credentials."): return
        def work():
            try: set_user_disabled(ROOT,user_id,disabled); result=f"Account {action}d successfully."
            except Exception as exc: result=f"Account update failed: {exc}"
            self.after(0,lambda:(self.user_status.set(result),self.load_users()))
        threading.Thread(target=work,daemon=True).start()

    def ai_screen(self):
        self.heading("AI Analysis", "Gemma report classification: flood, fire, storm damage, downed trees and power lines")
        frame=tk.Frame(self.content,bg=PANEL,padx=24,pady=22)
        frame.pack(fill="both",expand=True)
        d=self.api_summary("/api/health")
        if "error" in d:
            message="Backend offline — install/start Website & API first."
        else:
            message=("MOCK mode: generated sample analyses — NOT live AI." if d.get("mock") else "AI key detected. API configuration enabled; model request not yet tested.")
            message+=f"\\nConfigured model: {d.get('model','unknown')}"
        tk.Label(frame,text=message,bg=PANEL,fg=ACCENT,font=("DejaVu Sans",12,"bold"),justify="left",wraplength=620).pack(anchor="w",pady=10)
        tk.Label(frame,text="AI credentials must be stored only on this Pi in /etc/hackformiami/backend.env. A key present in a Git commit is considered compromised; revoke it and generate a replacement.",bg=PANEL,fg=MUTED,wraplength=640,justify="left").pack(anchor="w",pady=12)
        tk.Button(frame,text="Recheck AI connection",command=self.ai_screen,bg=PANEL2,fg=FG,relief="flat",padx=14,pady=9).pack(anchor="w",pady=12)


    def camera_screen(self):
        self.heading("Camera & Speaker", "Control live camera AI costs, audio alerts and location")
        frame=tk.Frame(self.content,bg=PANEL,padx=22,pady=18)
        frame.pack(fill="both",expand=True)
        conf={}
        try:
            for line in Path("/etc/hackformiami/hardware.env").read_text().splitlines():
                if "=" in line:
                    k,v=line.split("=",1)
                    if k in ("CAM_AI_ENABLED","INTERVAL","CAM_LAT","CAM_LNG","CAM_AREA","ALSA_DEVICE"): conf[k]=v
        except OSError: pass
        active=conf.get("CAM_AI_ENABLED","0")=="1"
        camera=cmd("systemctl","is-active","hackformiami-camera.service")
        speaker=cmd("systemctl","is-active","hackformiami-speaker.service")
        self.hw_status=tk.StringVar(value=f"Camera: {camera} | Speaker: {speaker} | AI uploads: {'ON' if active else 'OFF'}")
        tk.Label(frame,textvariable=self.hw_status,bg=PANEL,fg=ACCENT,font=("DejaVu Sans",12,"bold")).pack(anchor="w",pady=8)
        row=tk.Frame(frame,bg=PANEL); row.pack(anchor="w",pady=6)
        for label,action in (("Enable camera AI","ai-on"),("Pause camera AI","ai-off"),("Start camera","start"),("Stop camera","stop")):
            tk.Button(row,text=label,command=lambda a=action:self.hardware_action(a),bg=PANEL2,fg=FG,relief="flat",padx=9,pady=8).pack(side="left",padx=4)
        tk.Label(frame,text="Camera AI is opt-in. OFF = no frame uploads or image-model requests. Speaker alerts from user reports remain separate.",bg=PANEL,fg=MUTED,wraplength=670,justify="left").pack(anchor="w",pady=8)
        tk.Label(frame,text="Camera check interval (10–3600 seconds)",bg=PANEL,fg=FG).pack(anchor="w")
        self.cam_interval=tk.StringVar(value=conf.get("INTERVAL","10"))
        row=tk.Frame(frame,bg=PANEL);row.pack(anchor="w",pady=5)
        tk.Entry(row,textvariable=self.cam_interval,width=10,bg=PANEL2,fg=FG,insertbackground=FG).pack(side="left")
        tk.Button(row,text="Apply interval",command=lambda:self.hardware_action("interval",self.cam_interval.get()),bg=PANEL2,fg=FG).pack(side="left",padx=10)
        tk.Label(frame,text="Physical camera location (not visitors' GPS)",bg=PANEL,fg=FG).pack(anchor="w",pady=(12,3))
        row=tk.Frame(frame,bg=PANEL);row.pack(anchor="w")
        self.cam_lat=tk.StringVar(value=conf.get("CAM_LAT","0"))
        self.cam_lng=tk.StringVar(value=conf.get("CAM_LNG","0"))
        self.cam_area=tk.StringVar(value=conf.get("CAM_AREA",""))
        for title,var,w in (("Latitude",self.cam_lat,12),("Longitude",self.cam_lng,12),("Area",self.cam_area,25)):
            tk.Label(row,text=title,bg=PANEL,fg=MUTED).pack(side="left",padx=(0,4))
            tk.Entry(row,textvariable=var,width=w,bg=PANEL2,fg=FG,insertbackground=FG).pack(side="left",padx=(0,10))
        buttons=tk.Frame(frame,bg=PANEL);buttons.pack(anchor="w",pady=8)
        tk.Button(buttons,text="Detect approximate location",command=self.detect_camera_location,bg=PANEL2,fg=FG,padx=8).pack(side="left",padx=4)
        tk.Button(buttons,text="Save confirmed location",command=lambda:self.hardware_action("location",self.cam_lat.get(),self.cam_lng.get(),self.cam_area.get()),bg="#176657",fg=FG,padx=8).pack(side="left",padx=4)
        row=tk.Frame(frame,bg=PANEL);row.pack(anchor="w",pady=8)
        self.alsa_device=tk.StringVar(value=conf.get("ALSA_DEVICE","default"))
        tk.Label(frame,text="Speaker ALSA output (use aplay -l for card/device)",bg=PANEL,fg=FG).pack(anchor="w",pady=(8,3))
        audio_row=tk.Frame(frame,bg=PANEL);audio_row.pack(anchor="w",pady=4)
        tk.Entry(audio_row,textvariable=self.alsa_device,width=23,bg=PANEL2,fg=FG,insertbackground=FG).pack(side="left")
        tk.Button(audio_row,text="Save audio device",command=lambda:self.hardware_action("audio-device",self.alsa_device.get()),bg=PANEL2,fg=FG).pack(side="left",padx=6)
        tk.Button(row,text="Test speaker audio",command=lambda:self.hardware_action("speaker-test"),bg="#176657",fg=FG).pack(side="left",padx=4)
        tk.Button(row,text="Start speaker",command=lambda:self.hardware_action("speaker-start"),bg=PANEL2,fg=FG).pack(side="left",padx=4)
        tk.Button(row,text="Stop speaker",command=lambda:self.hardware_action("speaker-stop"),bg=PANEL2,fg=FG).pack(side="left",padx=4)
        tk.Label(frame,text="IP-based lookup is approximate and may be wrong. Confirm coordinates before saving. Physical fights are only tentative AI detections.",bg=PANEL,fg="#f1d395",wraplength=680,justify="left").pack(anchor="w",pady=8)

    def detect_camera_location(self):
        self.hw_status.set("Looking up approximate network location...")
        def work():
            try:
                import json
                from urllib.request import urlopen
                with urlopen("https://ipwho.is/",timeout=8) as response: d=json.load(response)
                if not d.get("success",False): raise RuntimeError("IP lookup unavailable")
                lat,lng=float(d["latitude"]),float(d["longitude"])
                area=(str(d.get("city",""))+", "+str(d.get("region",""))).strip(", ")
                def done():
                    if self.selected.get()!="Camera & Speaker":return
                    self.cam_lat.set(str(lat));self.cam_lng.set(str(lng));self.cam_area.set(area)
                    self.hw_status.set("Approximate IP location found. Check it carefully before saving.")
                self.after(0,done)
            except Exception as exc:
                self.after(0,lambda:self.hw_status.set("Location lookup failed: "+str(exc)[:100]))
        threading.Thread(target=work,daemon=True).start()

    def hardware_action(self,action,*args):
        if action=="ai-on" and not messagebox.askyesno("Enable camera AI","Start sending camera images to AI? This consumes paid API tokens."):return
        self.hw_status.set("Applying "+action+" ...")
        def work():
            try:
                p=subprocess.run(["pkexec","/usr/local/sbin/hackformiami-hardware-control",action,*args],capture_output=True,text=True,timeout=60)
                result=(p.stdout or p.stderr).strip()[:300]
                if p.returncode: result="Failed: "+result
            except (OSError,subprocess.TimeoutExpired) as exc: result="Failed: "+str(exc)
            self.after(0,lambda:self.hw_status.set(result) if self.selected.get()=="Camera & Speaker" else None)
        threading.Thread(target=work,daemon=True).start()

    def reports_screen(self):
        self.heading("Reports & Alerts", "Read-only view of real FastAPI reporting endpoints")
        frame=tk.Frame(self.content,bg=PANEL,padx=24,pady=22)
        frame.pack(fill="both",expand=True)
        for label,url in (("LATEST ALERT","/api/alerts/latest"),("REPORTS (24 HOURS)","/api/reports?hours=24"),("TIDE STATION","/api/tide")):
            data=self.api_summary(url)
            if "error" in data: value="Unavailable — backend offline or API error"
            elif isinstance(data,list):value=f"{len(data)} reports returned"
            elif label=="LATEST ALERT":value="No current alert" if not data.get("alert") else str(data["alert"])[:300]
            elif label=="TIDE STATION":value=str(data)[:300]
            else:value=str(data)[:300]
            tk.Label(frame,text=label,bg=PANEL,fg=MUTED,font=("DejaVu Sans",10,"bold")).pack(anchor="w",pady=(12,4))
            tk.Label(frame,text=value,bg=PANEL,fg=FG,wraplength=610,justify="left").pack(anchor="w")
        tk.Button(frame,text="Refresh live data",command=self.reports_screen,bg=PANEL2,fg=FG,relief="flat",padx=14,pady=9).pack(anchor="w",pady=14)

    def site_screen(self):
        self.heading("Website & API", "Run the Vite website, FastAPI endpoints and Gemma analysis on this Pi")
        area=tk.Frame(self.content,bg=PANEL,padx=24,pady=22)
        area.pack(fill="both",expand=True)
        self.site_status=tk.StringVar(value="Checking backend and model configuration...")
        tk.Label(area,textvariable=self.site_status,bg=PANEL,fg=ACCENT,font=("DejaVu Sans",11),wraplength=630,justify="left").pack(anchor="w",pady=9)
        tk.Label(area,text="Local service: http://127.0.0.1:8000  ·  Public Cloudflare route should point here.",bg=PANEL,fg=MUTED,wraplength=620,justify="left").pack(anchor="w",pady=8)
        tk.Button(area,text="Install / update website and API",bg="#176657",fg=FG,relief="flat",padx=13,pady=11,command=self.install_site).pack(anchor="w",pady=10)
        tk.Button(area,text="Check service and AI mode",bg=PANEL2,fg=FG,relief="flat",padx=13,pady=10,command=self.check_site).pack(anchor="w",pady=7)
        tk.Label(area,text="AI configuration: gamma uses the Google AI credential configured in /etc/hackformiami/backend.env. Without a key, the backend runs in MOCK mode (sample results).",bg=PANEL,fg=MUTED,wraplength=650,justify="left").pack(anchor="w",pady=12)
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
            self.after(0,lambda:self.site_status.set(output) if self.selected.get()=="Website & API" else None)
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
            if self.selected.get() in ("Overview","GitHub Updates"): self.render_data()
        except OSError: pass
        self.after(15000,self.refresh)

if __name__ == "__main__":
    Manager().mainloop()
