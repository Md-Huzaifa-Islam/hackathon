# Deployment

Push to `main` → GitHub Actions builds both images, pushes them to GHCR, then
SSHes into your VPS and restarts the stack behind Traefik. No `git clone` or
`docker build` ever happens on the VPS — that's why `/opt/app/cinemaseat`
doesn't need to be (and shouldn't be) a git repo; the workflow just SCPs the
two compose files in directly.

Checklist — do these once, in order:

- [ ] 1. DNS
- [ ] 2. Create the deploy folder + `.env` on the VPS
- [ ] 3. Add a deploy SSH key
- [ ] 4. Set GitHub secrets + variables
- [ ] 5. Push to `main`

---

## 1. DNS

Point two subdomains at your VPS's IP (A record):

| Hostname | Points to |
|---|---|
| `cinemaseat.huzaifaswe.com` | frontend (what users visit) |
| `api.cinemaseat.huzaifaswe.com` | backend (the browser calls this directly, so it needs its own hostname — it can't hide behind the frontend's) |

## 2. VPS: deploy folder + `.env`

Traefik and the `proxy` network are already running on your VPS, so there's
nothing to install — just create where the compose files will live and give
them their secrets.

```bash
mkdir -p /opt/app/cinemaseat && cd /opt/app/cinemaseat
nano .env
```

Paste this in, replacing every value (generate `BETTER_AUTH_SECRET` with
`openssl rand -hex 32`):

```dotenv
DOMAIN=cinemaseat.huzaifaswe.com
API_DOMAIN=api.cinemaseat.huzaifaswe.com

DATABASE_URL=postgresql://user:password@host:5432/postgres?connection_limit=10&pool_timeout=30
HOLD_TTL_SECONDS=60
BETTER_AUTH_SECRET=<openssl rand -hex 32>
GATEWAY_SECRET=z2p-2026-secret
TRUSTED_ORIGINS=https://cinemaseat.huzaifaswe.com

NEXT_PUBLIC_API_BASE_URL=https://api.cinemaseat.huzaifaswe.com
```

(Same template lives at [`.env.production.example`](./.env.production.example)
in this repo if you'd rather copy it over with `scp`.)

## 3. Deploy SSH key

You've already generated `deploy_key`/`deploy_key.pub` in
`/opt/app/cinemaseat` on the VPS itself — that's fine, generating it there
instead of locally works the same way. Just make sure the public half is
authorized for the user GitHub Actions will log in as:

```bash
cat /opt/app/cinemaseat/deploy_key.pub >> ~/.ssh/authorized_keys
```

Keep `deploy_key` (private) around — its contents go into the GitHub secret
below. Once it's pasted in, you can delete both files from
`/opt/app/cinemaseat` if you don't want key material sitting next to the
compose files (it's harmless there either way since it's outside any web
root, but tidier to remove).

## 4. GitHub repo config

Repo → **Settings → Secrets and variables → Actions**.

**Secrets** tab:

| Name | Value |
|---|---|
| `DEPLOY_HOST` | your VPS IP/hostname |
| `DEPLOY_USER` | SSH user on the VPS (e.g. `root`, matching whoever owns `/opt/app/cinemaseat`) |
| `DEPLOY_SSH_KEY` | contents of `deploy_key` (private key, whole file) |

**Variables** tab:

| Name | Value |
|---|---|
| `DEPLOY_ENABLED` | `true` |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.cinemaseat.huzaifaswe.com` |

## 5. Ship it

```bash
git checkout main
git merge dev
git push origin main
```

Watch the **Actions** tab. When it's green, check:

- `https://cinemaseat.huzaifaswe.com`
- `https://api.cinemaseat.huzaifaswe.com/health`

---

## Rollback

Every image is also tagged with its commit SHA, not just `latest`:

```bash
ssh <user>@<vps-host>
cd /opt/app/cinemaseat
IMAGE_TAG=<good-sha> docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## How it actually works (for reference)

`.github/workflows/cd.yml`, on push to `main`:

1. Builds `backend` and `frontend` images, pushes to
   `ghcr.io/<repo>/{backend,frontend}` tagged `latest` and `<sha>`.
2. Copies `docker-compose.yml` + `docker-compose.prod.yml` to
   `/opt/app/cinemaseat` on the VPS via SCP.
3. SSHes in and runs `docker compose pull && up -d` with both files —
   `docker-compose.prod.yml` swaps each service's `build:` for the GHCR
   image and adds the Traefik labels/network, and strips all published host
   ports so only Traefik touches the public interface.

`redis` and `gateway` stay internal-only (no Traefik labels, no public
hostname) — only `frontend` and `backend` are routed.
