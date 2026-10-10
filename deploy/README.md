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

## Website, FastAPI and AI integration

The repository now contains `web/` (Vite/React) and `backend/` (FastAPI with Google GenAI-based Gemma analysis). The backend serves the built website from `web/dist/` at `/`; `/api/health` reveals whether it is running in mock mode. `app/` currently contains a README, not the separate reporting UI.

Run **once** after GitHub pull:
```bash
cd /opt/hackformiami && git pull --ff-only && bash deploy/install-manager.sh
```
Then open **HackForMiami Manager → Website & AI → Install / update website and API** (requires desktop Polkit authentication). Or run `sudo bash deploy/install-site.sh` from a Pi terminal. This installs runtime dependencies, builds the website, creates `hackformiami-site.service`, and serves website/API on local-only port 8000.

For live AI, edit local-only `/etc/hackformiami/backend.env` using `sudoedit` and set `GEMINI_API_KEY`; then restart `hackformiami-site`. The file is created with root-only access, includes a randomly generated ADMIN_TOKEN, and must never be committed. Without the key the backend intentionally returns **mock/sample** AI output. Check `curl -fsS http://127.0.0.1:8000/api/health`.

The update timer fetches GitHub every 30 seconds after each check; when `web/`, `backend/`, or `app/` changes, it starts a separate asynchronous builder service. Builds can take longer than 30 seconds. Errors: `sudo journalctl -u hackformiami-site-build.service -n 50 --no-pager`. Manager changes reload the desktop application.

## Cloudflare Tunnel wizard

Open **HackForMiami Manager → Cloudflare**. In Cloudflare Zero Trust create a remotely-managed Cloudflared tunnel, copy its connector token, paste **only into the local desktop GUI**, and press Install. This invokes the privileged local connector installer. Then define a published hostname route to `http://127.0.0.1:8000`. The tunnel provider requires your own Cloudflare account and domain. No token is stored in the Git repo. Do not publish the desktop manager. Restrict access to unpublished development endpoints as needed.
