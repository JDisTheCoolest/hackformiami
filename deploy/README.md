# HackForMiami — separate Raspberry Pi manager

This repository contains **only the infrastructure for a private manager**. The manager is intentionally read-only; it does not deploy, modify, or rebuild the future HackForMiami application.

## Install on the NEW Raspberry Pi

If you already cloned using the deployment key:

```bash
cd /opt/hackformiami
git pull --ff-only
bash deploy/install-manager.sh
curl -fsS http://127.0.0.1:8787/health
```

If the clone is missing, first clone this private repository using your configured SSH deploy key, then run the commands above.

The manager runs via `hackformiami-manager.service` and binds **only** to `127.0.0.1:8787`. It does not open a public listening socket. It displays Pi hostname, uptime, disk usage, repository revision, and Cloudflare service health.

## Cloudflare Tunnel and authentication

1. Log into the Cloudflare Zero Trust dashboard on your own Cloudflare account.
2. Create a **new** named tunnel for this Pi, or use another tunnel already configured on this **same** Pi.
3. Install `cloudflared` on the Pi using Cloudflare's current official Linux ARM installation instructions.
4. In your tunnel's **Public Hostname** / published application route, map an admin-only hostname you control (for example `manager.yourdomain.example`) to service `http://127.0.0.1:8787`.
5. **Before enabling public access**, create a Cloudflare Access **self-hosted application** for that exact hostname. Set the access policy to allow only your specific email identities; do not allow Everyone or bypass.
6. In the tunnel dashboard, obtain the tunnel connector token and use Cloudflare's provided `sudo cloudflared service install <TOKEN>` command on your Pi. **Never paste your tunnel token into GitHub or chat.** If `cloudflared` is already installed as a service, configure that service instead of blindly installing a second one.
7. Confirm external access requires Cloudflare Access login; confirm unapproved identities are denied.

Keep DNS, the tunnel token, and Cloudflare Access policies in Cloudflare, **not** the repository. The tunnel's public hostname must be protected by Cloudflare Access. Cloudflare Tunnel alone is **not authentication**.

## Management commands

```bash
sudo systemctl status hackformiami-manager
sudo journalctl -u hackformiami-manager -n 50 --no-pager
sudo systemctl restart hackformiami-manager
curl -fsS http://127.0.0.1:8787/health
```

To apply manager changes later:

```bash
cd /opt/hackformiami && git pull --ff-only && bash deploy/install-manager.sh
```

## Separation from Open Seas

No Open Seas application files, web server configuration, domain, or secrets are touched. No public HackForMiami website is deployed by these files.
