# Demo host runbook (issue #12)

The demo runs on **Arch Linux**. One Arch VM runs the same `compose.yaml` as everyone's laptop, with Caddy in front for HTTPS. **Target: live by 16:00 Saturday.** This runbook is for the person setting it up (allow about 45 minutes) and for whoever redeploys later. Every endpoint is described, with examples, in [api.md](api.md).

There are two ways to run it:

| | Main: Arch VM, public HTTPS (steps 0–8) | Fallback: presenter's Arch laptop, local only ([section below](#fallback-the-presenters-arch-laptop-local-only)) |
|---|---|---|
| Who can open it | Anyone, at `https://<WEB_DOMAIN>` | Only the laptop's screen, at `http://localhost:3000` |
| Caddy, DNS, certificates | Yes | No |
| Meets #12 | Yes | No (no HTTPS URL to share). Use it if the VM or the venue network fails. |

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
| VM | **Arch Linux, x86_64 (amd64)**, at least 2 vCPU, 4 GB RAM, 30 GB disk | The images target `linux/amd64`. An ARM VM would emulate or fail (and Arch Linux ARM is a separate distribution). Building Next.js needs about 2 GB of RAM. |
| Arch image | The provider's Arch image if it has one. Otherwise upload the official cloud image (`Arch-Linux-x86_64-cloudimg-*.qcow2` from `https://geo.mirror.pkgbuild.com/images/latest/`) as a custom image | The official image uses cloud-init, so the provider's SSH key works. Its login user is `arch`. |
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

On the VM (`ssh arch@<IP>`, or your provider's user):

```sh
sudo pacman -Syu          # full upgrade first; Arch doesn't support partial upgrades
sudo reboot               # if the upgrade included the `linux` kernel package (see the note below)
```

Arch has no firewall enabled by default, so the cloud firewall is the one that matters. If you do enable `ufw` on the VM, open the same ports:

```sh
sudo pacman -S --needed ufw && sudo systemctl enable --now ufw
sudo ufw allow 22/tcp && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp && sudo ufw enable
```

**Kernel upgrades and Docker.** After `pacman -Syu` installs a new kernel, the running kernel can't load its modules any more (they were replaced on disk). Docker then fails to create its networks, with errors mentioning `modprobe`, `bridge`, `overlay` or `iptables`. Reboot after every upgrade that includes `linux`, **before** starting the stack.

## 2. Install Docker Engine and Compose

The Docker convenience script doesn't support Arch. Use the Arch packages: `docker-compose` provides the `docker compose` plugin, and `docker-buildx` is required by `docker compose … --build`.

```sh
sudo pacman -S --needed docker docker-compose docker-buildx git openssh nano jq bind
sudo systemctl enable --now docker.service
sudo usermod -aG docker $USER
exit   # log out and back in so the docker group applies
```

`jq` is for the [walk-through](#show-it-the-endpoint-walk-through), and `bind` provides `dig` (step 3). `deploy/check.sh` itself only needs `bash`, `curl`, `git`, `sed`, `awk` and `docker`, which the base system plus the line above cover.

Check: `docker compose version` and `docker buildx version` both print a version, and `docker ps` works without `sudo`.

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

**Check that the Narratives on screen come from the LLM.** `deploy/check.sh` proves the LLM answers. The cards show what `engine` cached at the last rescore, so check the cache too:

```sh
docker compose exec db psql -U reachloop -d reachloop -c \
  "SELECT source, model, count(*) FROM narrative_cache GROUP BY 1, 2 ORDER BY 1"
```

Expected with an LLM: mostly `llm | <your model>`. A few `template` rows are fine: those are replies the number-check rejected. If everything is `template | ''`, the stack first started without the `LLM_*` values. Rescore once to regenerate every row with the LLM. This takes about 256 LLM calls, 8 at a time, about a minute:

```sh
docker compose exec engine python -m app.rescore_now    # check "narrative_sources" in the output
```

(Use the user and database from `.env` if you changed `POSTGRES_USER` or `POSTGRES_DB`.)

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

A redeploy doesn't touch Arch packages. Don't combine it with `pacman -Syu` on the day (see [Things to know](#things-to-know-for-the-demo)).

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

## Show it: the endpoint walk-through

On the day, these calls tell the story end to end. Set the domain once, then run them from any laptop. Every call is public, read-only and cached for 5 minutes; none of them calls the LLM. Full field-by-field descriptions are in [api.md](api.md).

```sh
API=https://<API_DOMAIN>
```

The filters need `jq` (`sudo pacman -S jq` on Arch, `brew install jq`, `sudo apt install jq`, or `winget install jqlang.jq`). Without it, pipe to `python3 -m json.tool` to read the whole response.

| Step | Call | What it shows |
|---|---|---|
| 1. Coverage | `curl -s $API/regions \| jq '.regions \| length'` → `23` | Every Region THL reports on, including Helsinki and Åland |
| 2. What we measure | `curl -s $API/indicators \| jq -r '.indicators[] \| "\(.code)  \(.target // "-")  \(.name)"'` | 12 indicators; only the 3 screening ones have a National Cancer Strategy Target (80%) |
| 3. One Gap | `curl -s "$API/regions/90/gap-summary?indicator=3621&year=2024" \| jq '{gap: .gap \| {value, reference_value, deviation, severity, rank, n_regions}, narrative}'` | City of Helsinki, breast screening 2024: 74.3 against 80, −5.7, `act`, last of 22, with its Narrative |
| 4. Why, and what to do | `... \| jq '{action, data_quality_notes, trend: [.trend[] \| .value]}'` (same URL) | The matched strategy action (with page), the data-quality notes and the 2016–2024 series behind the sparkline |
| 5. Where to reach out | `curl -s "$API/outreach-list?indicator=3621&year=2024" \| jq '.rows[] \| {rank, region: .region.name, deviation, foreign_background: .covariates.immigrant_background_share_pct}'` | The 4 Regions below 80%, largest Gap first, with their foreign-background share |
| 6. The caveat | `... \| jq -r .ecological_fallacy_note` (same URL) | Region-level figures don't describe individuals. This must be on screen with step 5 |
| 7. Honest errors | `curl -s "$API/outreach-list?indicator=13&year=2024"` | `404`: indicators without a Target have no outreach list, and the API says why |

Good things to point out while showing it:

- **Every number in a Narrative is checked.** An LLM reply with a number that isn't in the Gap is thrown away and replaced by a Template sentence (`source: "template"`). The `source` field says which one you're looking at.
- **Nothing on screen waits for the LLM.** Narratives are generated after each rescore and cached. If the LLM or the network fails during judging, the cards still show the last good Narratives, or Template sentences.
- **Gaps, not bottlenecks** ([ADR 0001](adr/0001-gaps-not-bottlenecks.md)): every figure is a published indicator compared with a Target or with peer Regions.
- **Don't** present income or poverty covariates as targeting variables. The foreign-background share is the one that holds at both Region and individual level (`research/covariate_correlation_analysis.md`).

## Things to know for the demo

- **What the demo shows today:** `api` serves real data from `data/processed/` (#7, #13, #14, #16) with Narratives from the cache (#17). `web` is still the placeholder page until #10, #11 and #18 land. Each one arrives with the redeploy command, with no host changes. Until then, show the API itself: the [walk-through](#show-it-the-endpoint-walk-through) above, or `https://<API_DOMAIN>/docs`.
- **The LLM is used at rescore time, not on screen.** `engine` asks `narrative` for one Narrative per latest-year Gap (256 today) after each rescore and caches them. The first start on the VM already runs a rescore, so with the `LLM_*` values set in step 5 the cache fills with LLM Narratives straight away. If the key is added or changed later, run `rescore_now` (see [7. Verify](#7-verify)).
- **If the LLM or the network fails during judging, the demo still works.** gap-summary reads the cache, and a Narrative that can't be generated falls back to the Template sentence. Nothing on a request path calls the LLM.
- **LLM credits:** a rescore only calls the LLM for Gaps whose inputs changed. A redeploy with unchanged data makes 0 calls; a full regeneration (new key, model or prompt) makes about 256. Budget for a few full regenerations, not hundreds.
- **`seed` runs again on every `up`.** It's safe to run twice: it reloads the data, rescores, and keeps every unchanged Narrative.
- **After a VM reboot** everything comes back by itself (`RESTART_POLICY=unless-stopped` plus the Docker service being enabled). `seed` doesn't need to run again.
- **Browser-side API calls:** today `web` reaches `api` server-side over the internal network (`API_URL=http://api:8000`). If #10 or #18 adds calls from the browser, they must use `https://<API_DOMAIN>`, and CORS already allows `WEB_ORIGIN`. Next.js bakes `NEXT_PUBLIC_*` variables in at build time, so such a URL must be set before `--build`.
- **Cold start before judging:** after the last redeploy, open both URLs once so the first real visitor doesn't wait on a cold start. Rehearsal is #22.
- **Freeze Arch updates after the rehearsal.** Arch is a rolling release: a `pacman -Syu` on the day can bring a new kernel (Docker networking breaks until a reboot) or a new Docker or Compose version. Upgrade and reboot once, well before the rehearsal, then don't run `pacman` on the VM or on the fallback laptop until the demo is over. Redeploying with `git pull && docker compose up -d --build` is still fine.

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
| Build fails with `Killed` / out of memory | The VM is too small for the Next.js build. Add swap or resize. Check the root filesystem first with `findmnt -no FSTYPE /`. On ext4: `sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. On btrfs (`fallocate` swap files don't work there): `sudo btrfs filesystem mkswapfile --size 4g /swapfile && sudo swapon /swapfile`. |
| `exec format error` | The VM is ARM. Use an x86_64 VM. |
| `git pull` asks for a password | The deploy key isn't used. Check `~/.ssh/config` and that the key is added to the repo. |
| `docker compose` errors with `failed to create network`, or mentions `modprobe`, `bridge`, `overlay` or `iptables` | A kernel upgrade without a reboot. Check with `uname -r` against `pacman -Q linux`. If they differ, `sudo reboot`, then `docker compose up -d`. |
| `docker: 'compose' is not a docker command` | Install `docker-compose` (`sudo pacman -S docker-compose`). It provides the `docker compose` plugin on Arch. |
| `compose build requires buildx` | Install `docker-buildx` (`sudo pacman -S docker-buildx`). |
| `permission denied … /var/run/docker.sock` | You're not in the `docker` group yet. Run `sudo usermod -aG docker $USER`, then log out and back in. Check with `groups`. |
| `Cannot connect to the Docker daemon` | The service isn't running. Run `sudo systemctl enable --now docker.service`. |

## Fallback: the presenter's Arch laptop (local only)

Use this if the VM, DNS or the venue network fails. The stack runs on the laptop that's connected to the projector, and the demo is shown in that laptop's browser. Nothing is reachable from other devices, and there's no HTTPS, so this doesn't meet #12. It's a backup, not a replacement.

Set it up **the day before, while online**, so the images are built and the Narrative cache is filled with LLM Narratives:

```sh
sudo pacman -Syu && sudo reboot      # then freeze updates until the demo (see Things to know)
sudo pacman -S --needed docker docker-compose docker-buildx git jq
sudo systemctl enable --now docker.service
sudo usermod -aG docker $USER        # log out and back in

git clone git@github.com:balintpragai/Junction2026.git ~/reach-loop && cd ~/reach-loop   # or use your existing checkout, on an up-to-date main
cp .env.example .env && chmod 600 .env
```

In `.env`, set only the three `LLM_*` values. Leave `COMPOSE_PROFILES`, `WEB_DOMAIN`, `API_DOMAIN` and `WEB_ORIGIN` at their defaults: no Caddy, and CORS stays on `http://localhost:3000`. `BIND_ADDRESS=127.0.0.1` keeps both ports off the venue Wi-Fi.

```sh
docker compose up -d --build
```

Then open `http://localhost:3000` and `http://localhost:8000/docs`. Run the [walk-through](#show-it-the-endpoint-walk-through) with `API=http://localhost:8000`, and check the cache's sources with the `psql` query in [7. Verify](#7-verify).

`deploy/check.sh` is written for the VM. On the laptop, its **Configuration**, **caddy** and **HTTPS** checks fail by design. Its **Containers** checks (except caddy), its secrets checks and its **LLM** check still apply.

On the day:
- **Offline works.** With the images built and the cache filled, `docker compose up -d` needs no network. `seed` rescores from the local data and keeps every unchanged Narrative, so nothing calls the LLM. If the LLM can't be reached, the cards fall back to Template sentences.
- **Don't run `docker compose up --build`, `pacman` or `git pull` on the venue network** unless you have to. A build needs the internet to pull base images and packages.
- Turn off sleep and the screen lock for the session, and plug in power. Docker keeps running, but a suspended laptop stops the stack.
