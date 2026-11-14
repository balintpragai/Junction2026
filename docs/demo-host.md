# Demo host runbook (issue #12)

One Linux VM runs the same `compose.yaml` as everyone's laptop, with Caddy in front for HTTPS. **Target: live by 16:00 Saturday.** This runbook is for the person setting it up (allow about 45 minutes) and for whoever redeploys later.

```text
                 Internet (80, 443 only)
                          │
                    ┌─────▼─────┐   automatic Let's Encrypt certificates
                    │   caddy   │   WEB_DOMAIN → web:3000, API_DOMAIN → api:8000
                    └──┬─────┬──┘
                 ┌─────▼┐   ┌▼────┐
                 │ web  │──▶│ api │──▶ db   (internal)
                 └──────┘   └─────┘
     engine ──▶ narrative ──▶ LLM provider (LLM_BASE_URL, key only in .env on the VM)
```

`api` and `web` also publish on `127.0.0.1` of the VM. They're never on its public IP; the only way in is through Caddy.

## Acceptance checklist

| Criterion | How it's met | How to verify |
|---|---|---|
| `web` and `api` URLs reachable over HTTPS | Caddy (`COMPOSE_PROFILES=demo`) with `deploy/Caddyfile` | `deploy/check.sh` → section **HTTPS** |
| LLM env vars set on the host only, never committed | They live only in `.env` on the VM, which is gitignored, `chmod 600`, and never printed by the check | `deploy/check.sh` → sections **Configuration** and **Secrets stay on the host** |
| Redeploy command documented in the repo README | README → "Demo host" | Already in the repo |
| URLs shared with the team | Step 8 below | Done by hand |

The repo side is ready. The VM, the DNS, the LLM key and sharing the URLs need a person.

## 0. Decide first (5 minutes)

| Decision | Recommendation | Why |
|---|---|---|
| VM | Ubuntu 24.04 LTS, **x86_64 (amd64)**, at least 2 vCPU, 4 GB RAM, 30 GB disk | The images target `linux/amd64`. An ARM VM would emulate or fail. Building Next.js needs about 2 GB of RAM. |
| Domain | Your own domain if the team has one. Otherwise **sslip.io**, which needs no DNS setup | sslip.io maps `anything.203-0-113-10.sslip.io` to `203.0.113.10`, and Let's Encrypt can issue for it. |
| Hostnames | `WEB_DOMAIN=reachloop.<base>`, `API_DOMAIN=api.reachloop.<base>` | Two names, two certificates, one Caddyfile. |
| LLM | Whichever OpenAI-compatible provider the team has credits for | `narrative` only needs `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`. |

Common `LLM_BASE_URL` values (check your provider's docs for the current model names):

| Provider | `LLM_BASE_URL` |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Google Gemini (OpenAI-compatible) | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Self-hosted vLLM / Verda | `https://<host>/v1` |

## 1. Create the VM and open the firewall

In the cloud console, create the VM and allow inbound **22, 80 and 443** (TCP, plus UDP 443 for HTTP/3). Note its public IPv4, written `<IP>` below.

On the VM (`ssh <user>@<IP>`):

```sh
sudo apt-get update && sudo apt-get upgrade -y
# If ufw is on, Docker-published ports bypass it, but Caddy's 80/443 still need opening:
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp
```

## 2. Install Docker Engine and Compose

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo systemctl enable --now docker
exit   # log out and back in so the docker group applies
```

Check: `docker compose version` prints a version, and `docker ps` works without `sudo`.

## 3. DNS

- **Own domain:** create two `A` records, `reachloop.<domain>` and `api.reachloop.<domain>`, pointing at `<IP>`. Wait until `dig +short reachloop.<domain>` returns `<IP>`.
- **sslip.io:** nothing to do. With IP `203.0.113.10` the names are `reachloop.203-0-113-10.sslip.io` and `api.reachloop.203-0-113-10.sslip.io`.

DNS must resolve **before** the first start, or Caddy can't get certificates. It retries on its own, but slowly.

## 4. Clone the repo (it's private)

Give the VM a **read-only deploy key**, so no personal token sits on a shared machine:

```sh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/reachloop_deploy -C "reach-loop demo host"
cat ~/.ssh/reachloop_deploy.pub
```

Add that public key to the repo, either on GitHub (Settings → Deploy keys → Add, leave "Allow write access" **off**) or from your laptop with `gh repo deploy-key add <file.pub> --repo balintpragai/Junction2026 --title "demo host"`. Then on the VM:

```sh
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/reachloop_deploy
  IdentitiesOnly yes
EOF
git clone git@github.com:balintpragai/Junction2026.git ~/reach-loop
cd ~/reach-loop
```

## 5. Create `.env` on the VM (the only place secrets live)

```sh
cp .env.example .env
chmod 600 .env
nano .env
```

Set these values. Everything else can keep its default.

```sh
COMPOSE_PROFILES=demo
RESTART_POLICY=unless-stopped
WEB_DOMAIN=reachloop.<base>
API_DOMAIN=api.reachloop.<base>
WEB_ORIGIN=https://reachloop.<base>

POSTGRES_PASSWORD=<long random string>          # e.g. from: openssl rand -hex 24
DATABASE_URL=postgresql://reachloop:<same password>@db:5432/reachloop

LLM_BASE_URL=<provider base URL>
LLM_MODEL=<model name>
LLM_API_KEY=<key>
```

- **Never** commit `.env`, paste it in chat, or share `docker compose config` output: that output includes the key.
- `POSTGRES_PASSWORD` only takes effect when the database volume is first created. Set it before step 6.
- Use letters and digits for the password, so it doesn't need escaping inside `DATABASE_URL`.

Because `COMPOSE_PROFILES` is in `.env`, plain `docker compose …` commands include Caddy. Nobody needs to remember extra flags.

## 6. First start

```sh
docker compose up -d --build          # builds every image on the VM: about 3–6 minutes the first time
docker compose logs -f caddy          # wait for "certificate obtained successfully" for both names, then Ctrl+C
```

## 7. Verify

```sh
deploy/check.sh
```

It checks the `.env` values, that no secret is committed, every container's health, that `api` and `web` are bound to `127.0.0.1`, HTTPS on both names with a public certificate, the HTTP→HTTPS redirect, CORS, and a real LLM call through `narrative` (`source: "llm"`). It ends with `All checks passed` or the number of failures. It never prints the API key.

Then open both URLs in a browser on your laptop:
- `https://<WEB_DOMAIN>` should say "API reachable: 23 Regions loaded."
- `https://<API_DOMAIN>/docs` shows the API docs.

## 8. Share and close

1. Post both URLs in the team channel.
2. Replace the two "_not live yet_" lines in README → "Demo host" with the URLs, and open a PR (`Closes #12`). Paste the `deploy/check.sh` output into the PR body, after checking it contains no secrets (it shouldn't).
3. If you'd rather not make a PR, comment the URLs and the check output on #12 and close it.

## Redeploy (the one command)

On the VM, from `~/reach-loop`:

```sh
git pull && docker compose up -d --build
```

Compose rebuilds only the images whose code changed and restarts only those containers, so downtime is a few seconds per changed service. Run `deploy/check.sh` afterwards.

## Operations

| Task | Command |
|---|---|
| Status | `docker compose ps -a` |
| Logs (one service, live) | `docker compose logs -f narrative` |
| Restart one service | `docker compose restart api` |
| Change LLM provider or key | Edit `.env`, then `docker compose up -d narrative` (recreates it with the new env) |
| Roll back to a known-good commit | `git checkout <sha> && docker compose up -d --build`. Go back with `git checkout main`. |
| Stop everything (keeps data and certificates) | `docker compose down` |
| Disk usage / clean old images | `docker system df`, then `docker image prune -f` |

**Never run `docker compose down -v` on the demo host.** It deletes the database *and* Caddy's certificates. Getting certificates again on every restart can hit Let's Encrypt rate limits right before the demo.

## Things to know for the demo

- **What the demo shows today:** `web` is still the placeholder page. It loads the 23 Regions from `api`, which serves **fixtures** (only Helsinki's 74.3% is a real figure). The real tabs arrive with #10, #11 and #18, and real data with #7, #13 and #14. Each one lands with the redeploy command, with no host changes.
- **The LLM isn't in the UI yet.** `narrative` works and `deploy/check.sh` proves the key, model and number-check work from the VM. But nothing calls `narrative` until `engine` fills the Narrative cache (#17). Until then, "LLM configured" means "verified by the check", not "visible on screen".
- **If the LLM or the network fails during judging, the demo still works.** `narrative` falls back to Template sentences. Once #17 lands, the cache is filled ahead of time, so judging never waits on an LLM call.
- **LLM credits:** each rescore will ask for about 275 Narratives (#17), which is roughly 275 LLM calls. Budget for a few rescores, not hundreds.
- **`seed` runs again on every `up`.** It's a stub now. #7 must keep it safe to run twice (idempotent), or redeploys will duplicate data.
- **After a VM reboot** everything comes back by itself (`RESTART_POLICY=unless-stopped` plus the Docker service being enabled). `seed` doesn't need to run again.
- **Browser-side API calls:** today `web` reaches `api` server-side over the internal network (`API_URL=http://api:8000`). If #10 or #18 adds calls from the browser, they must use `https://<API_DOMAIN>`, and CORS already allows `WEB_ORIGIN`. Next.js bakes `NEXT_PUBLIC_*` variables in at build time, so such a URL must be set before `--build`.
- **Cold start before judging:** after the last redeploy, open both URLs once so the first real visitor doesn't wait on a cold start. Rehearsal is #22.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `caddy` logs show `challenge failed` / `no such host` | DNS doesn't point at the VM yet, or 80/443 are closed. Check `dig +short <WEB_DOMAIN>` and the cloud firewall. Caddy retries on its own. |
| Browser warns about the certificate | Caddy hasn't got a certificate yet. Check `docker compose logs caddy`. |
| `caddy` restarting, log mentions the Caddyfile | `WEB_DOMAIN` or `API_DOMAIN` is empty in `.env`. |
| `502 Bad Gateway` | `web` or `api` isn't healthy yet. Check `docker compose ps` and `docker compose logs web api`. |
| `api`/`engine`/`seed` can't connect to `db` (password authentication failed) | `DATABASE_URL` and `POSTGRES_PASSWORD` differ, or the password changed after the volume was created. Fix `.env`. If the data is disposable: `docker compose down && docker volume rm reach-loop_db-data && docker compose up -d`. |
| Check says narrative fell back to the Template sentence | Wrong `LLM_*` value, no credits, or the provider is unreachable from the VM. Check `docker compose logs narrative`, which logs the reason. |
| Check WARNs that the LLM invented a number | The key works, but the model broke the number rule. Try a stronger model. Template sentences cover it either way. |
| Build fails with `Killed` / out of memory | The VM is too small for the Next.js build. Add swap (`sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) or resize. |
| `exec format error` | The VM is ARM. Use an x86_64 VM. |
| `git pull` asks for a password | The deploy key isn't used. Check `~/.ssh/config` and that the key is added to the repo. |
