# HackForMiami Raspberry Pi hosting and native desktop manager

The management interface is a **native Python/Tkinter desktop application**, modeled after the Open Seas local manager approach. It has **no HTTP administration listener**. Access the Pi desktop through Pi Connect or locally; Cloudflare Tunnel remains available separately for the future PUBLIC HackForMiami website.

## One-time installation on the desktop Pi

From the **regular Pi user's terminal**, not using `sudo bash`:

```bash
cd /opt/hackformiami
git pull --ff-only
bash deploy/install-manager.sh
~/.local/bin/hackformiami-manager
```

A graphical Pi desktop session (DISPLAY/Wayland) is required. If the Pi uses Raspberry Pi OS Lite, install a desktop environment before launching Tkinter. The installer adds an Applications-menu icon and a per-user autostart entry. The desktop manager will open on next graphical login.

## Auto-update every 30 seconds

The installer installs `hackformiami-update.timer`; its service checks the private GitHub `main` branch every 30 seconds after the preceding check completes. It fast-forwards only if there are no uncommitted local changes and history is not divergent. The GUI refreshes metrics every 15 seconds and reloads itself automatically if `manager/desktop.py` changes.

```bash
systemctl status hackformiami-update.timer --no-pager
systemctl list-timers hackformiami-update.timer --no-pager
cat /var/lib/hackformiami-update/status
```

Scripts and systemd units under deploy/ are installed copies: modifications to them require rerunning `bash deploy/install-manager.sh`. Automatic code updates trust anyone able to push to main: restrict collaborators and consider branch protection.

## Cloudflare

Cloudflare Tunnel is NOT required for the native desktop manager, and you **must remove any old public tunnel route** pointing to `http://127.0.0.1:8787`: the HTTP manager service is retired by the installer. Configure a separate route for the future public app only, once built.

Sections for Events, Content & Media, Registrations, Backups, and Settings are interface scaffolds and do not yet control a website. No website app has been built by this commit.
