# Demo host runbook (issue #12)

The demo is served from an **Arch Linux machine (the host)** that runs an **Ubuntu 24.04 VM (the guest)**. The guest runs the same `compose.yaml` as everyone's laptop, with Caddy in front for HTTPS. **Target: live by 16:00 Saturday.** This runbook is for the person setting it up (allow about an hour) and for whoever redeploys later. Every endpoint is described, with examples, in [api.md](api.md).

```text
                 Internet (80, 443 only)
                          │
                 router: port forward 80/443 ──▶ guest's LAN IP
                          │
   Arch host ─ br0 bridge ┼──────────────────────────────────────────
                          │  Ubuntu guest (libvirt/KVM)
                    ┌─────▼─────┐   automatic Let's Encrypt certificates
                    │   caddy   │   WEB_DOMAIN → web:3000, API_DOMAIN → api:8000
                    └──┬─────┬──┘
                 ┌─────▼┐   ┌▼────┐
                 │ web  │──▶│ api │──▶ db   (internal)
                 └──────┘   └─────┘
     engine ──▶ narrative ──▶ LLM provider (LLM_BASE_URL, key only in .env on the guest)
```

`api` and `web` also publish on `127.0.0.1` of the guest. They're never on its LAN or public IP; the only way in is through Caddy.

There are three ways to run it. **On the day we took the third**, because the
venue network's gateway is not ours to configure and ports 80/443 cannot be
forwarded:

| | Ubuntu guest on the Arch host, public HTTPS (steps 0–8) | Docker on the Arch host, local only ([below](#fallback-docker-directly-on-the-arch-host-local-only)) | **Cloudflare Tunnel from a laptop** ([below](#cloudflare-tunnel-from-a-laptop-no-vm-no-router-access)) |
|---|---|---|---|
| Who can open it | Anyone, at `https://<WEB_DOMAIN>` | Only the host's screen, at `http://localhost:3000` | Anyone, at `https://frontiershealth.xyz` |
| VM | Yes | No | No |
| Router access / inbound ports | Yes | No | **No** — the tunnel dials out |
| DNS | A records at the registrar | No | Zone moved to Cloudflare, records written by `cloudflared` |
| Certificates | Let's Encrypt via Caddy | No | Cloudflare's edge |
| Meets #12 | Yes | No (no HTTPS URL to share) | Yes |

## Acceptance checklist

| Criterion | How it's met | How to verify |
|---|---|---|
| `web` and `api` URLs reachable over HTTPS | Caddy (`COMPOSE_PROFILES=demo`) with `deploy/Caddyfile` | `deploy/check.sh` → section **HTTPS** (see [the hairpin note](#7-verify)), plus a phone on mobile data |
| LLM env vars set on the host only, never committed | They live only in `.env` on the guest, which is gitignored, `chmod 600`, and never printed by the check | `deploy/check.sh` → sections **Configuration** and **Secrets stay on the host** |
| Redeploy command documented in the repo README | README → "Demo host" | Already in the repo |
| URLs shared with the team | Step 8 below | Done by hand |

The repo side is ready. The host, the VM, the router, the DNS, the LLM key and sharing the URLs need a person.

## 0. Decide first (5 minutes)

| Decision | Recommendation | Why |
|---|---|---|
| Host | The Arch machine, **x86_64** with hardware virtualisation (VT-x / AMD-V) on, and at least 4 GB RAM, 2 cores and 30 GB disk to spare for the guest | The images target `linux/amd64`. Building Next.js needs about 2 GB of RAM inside the guest. |
| Host network | **Wired Ethernet** on a network whose router you can configure | The guest joins the LAN through a bridge, and Wi-Fi interfaces can't be bridged. Ports 80/443 must be forwarded to the guest. |
| Public IP | The router's WAN address must be a public IPv4, not carrier-grade NAT | Check in [step 3](#3-public-ip-and-dns). Behind CGNAT, port forwarding can't work; you'd need a tunnel or a cloud VM instead. |
| Guest | Ubuntu 24.04 LTS server cloud image, 2 vCPU, 4 GB RAM, 30 GB disk | Same guest steps as a cloud VM. |
| Domain | **`frontiershealth.xyz`**, the product's own domain, registered at Spaceship. Fallback if DNS cannot be changed in time: **sslip.io**, which needs no DNS setup | sslip.io maps `anything.203-0-113-10.sslip.io` to `203.0.113.10`, and Let's Encrypt can issue for it. |
| Hostnames | `WEB_DOMAIN=frontiershealth.xyz`, `API_DOMAIN=api.frontiershealth.xyz` | Two names, two certificates, one Caddyfile. The web app sits on the apex because that is the URL that gets shared and shown. |
| LLM | Whichever OpenAI-compatible provider the team has credits for | `narrative` only needs `LLM_BASE_URL`, `LLM_MODEL` and `LLM_API_KEY`. |

Common `LLM_BASE_URL` values (check your provider's docs for the current model names):

| Provider | `LLM_BASE_URL` |
|---|---|
| OpenAI | `https://api.openai.com/v1` |
| Google Gemini (OpenAI-compatible) | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Self-hosted vLLM / Verda | `https://<host>/v1` |

## 1. Prepare the Arch host

```sh
lscpu | grep -i virtualization     # must show VT-x or AMD-V; if empty, enable virtualisation in the BIOS/UEFI
sudo pacman -Syu                   # full upgrade first; Arch doesn't support partial upgrades
sudo reboot                        # if the upgrade included the `linux` package (KVM modules must match the running kernel)

sudo pacman -S --needed qemu-base libvirt virt-install dnsmasq jq
sudo systemctl enable --now libvirtd.service
sudo usermod -aG libvirt $USER     # log out and back in
```

All `virsh` and `virt-install` commands below use the system connection (`qemu:///system`), so the VM can start on boot.

### Bridge the wired interface

The guest needs its own address on the LAN so the router can forward to it. With NetworkManager (find the interface name with `nmcli device`, e.g. `enp3s0`):

```sh
nmcli con add type bridge ifname br0 con-name br0 ipv4.method auto ipv6.method auto bridge.stp no
nmcli con add type bridge-slave ifname enp3s0 master br0
nmcli con down "Wired connection 1"     # the old profile on enp3s0; name from `nmcli con show`
nmcli con up br0
```

The host's own IP now sits on `br0`. Do this from the console, not over SSH, because the connection drops while it switches. If the host uses `systemd-networkd` instead, follow the ArchWiki "Network bridge" page.

## 2. Create the Ubuntu guest

```sh
cd /var/lib/libvirt/images
sudo curl -LO https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
sudo qemu-img create -f qcow2 -F qcow2 -b /var/lib/libvirt/images/noble-server-cloudimg-amd64.img reachloop.qcow2 30G

virt-install --connect qemu:///system --name reachloop \
  --memory 4096 --vcpus 2 --osinfo ubuntu24.04 \
  --import --disk /var/lib/libvirt/images/reachloop.qcow2 \
  --network bridge=br0 --graphics none --noautoconsole \
  --cloud-init clouduser-ssh-key=$HOME/.ssh/id_ed25519.pub

virsh --connect qemu:///system autostart reachloop          # start the guest when the host boots
virsh --connect qemu:///system domiflist reachloop          # the guest's MAC address
```

- If `virt-install` doesn't know `ubuntu24.04`, use `--osinfo ubuntu22.04`. The settings are the same.
- Use any public key you have for `clouduser-ssh-key`. The guest's user is `ubuntu`.

Find the guest's LAN IP in the router's DHCP client list (by the MAC above), or with `virsh --connect qemu:///system domifaddr reachloop --source arp` after it has booted. It's written `<GUEST_IP>` below.

### Router

1. Give the guest's MAC a **DHCP reservation**, so `<GUEST_IP>` doesn't change.
2. **Forward** TCP 80 and 443, and UDP 443 (HTTP/3), from the WAN to `<GUEST_IP>`. Don't forward 22: SSH from the host or the LAN only.

### On the guest

```sh
ssh ubuntu@<GUEST_IP>
sudo apt-get update && sudo apt-get upgrade -y
# If ufw is on, Docker-published ports bypass it, but Caddy's 80/443 still need opening:
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw allow 443/udp
```

Then install Docker Engine and Compose on the guest:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo systemctl enable --now docker
exit   # log out and back in so the docker group applies
```

Check: `docker compose version` prints a version, and `docker ps` works without `sudo`.

## 3. Public IP and DNS

On the guest, find the public IP: `curl -s https://ifconfig.me`. It's written `<IP>` below. Compare it with the WAN address on the router's status page. **If they differ, the network is behind carrier-grade NAT** and port forwarding can't reach the guest. Stop here and use a different network, a tunnel or a cloud VM.

- **`frontiershealth.xyz` (preferred).** DNS is at **Spaceship** (nameservers `launch1/launch2.spaceship.net`), and the domain currently points at Spaceship's parking page. In Spaceship → Domains → `frontiershealth.xyz` → Advanced DNS:
  1. **Delete the existing parking `A` records on `@`.** Leaving them in place means half the requests go to the parking page and Let's Encrypt may validate against it.
  2. Create `A` `@` → `<IP>` and `A` `api` → `<IP>`, TTL as low as the panel allows.
  3. Optionally `A` `www` → `<IP>`, and set `WEB_DOMAIN="frontiershealth.xyz www.frontiershealth.xyz"` so one site block answers both.
  4. Wait until `dig +short frontiershealth.xyz` and `dig +short api.frontiershealth.xyz` both return `<IP>` and nothing else. Until the old records expire, `dig` may return both; Caddy will fail the challenge while that is true.
- **sslip.io:** nothing to do. With IP `203.0.113.10` the names are `frontiershealth.203-0-113-10.sslip.io` and `api.frontiershealth.203-0-113-10.sslip.io`.

DNS must resolve, and the router must forward port 80, **before** the first start, or Caddy can't get certificates. It retries on its own, but slowly.

Home connections often get a new public IP after a router restart. If `<IP>` changes, sslip.io names change with it, so re-check it on the day.

## 4. Clone the repo (it's private)

On the guest, give it a **read-only deploy key**, so no personal token sits on a shared machine:

```sh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/reachloop_deploy -C "reach-loop demo host"
cat ~/.ssh/reachloop_deploy.pub
```

Add that public key to the repo, either on GitHub (Settings → Deploy keys → Add, leave "Allow write access" **off**) or from your laptop with `gh repo deploy-key add <file.pub> --repo balintpragai/Junction2026 --title "demo host"`. Then on the guest:

```sh
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/reachloop_deploy
  IdentitiesOnly yes
EOF
git clone git@github.com:balintpragai/Junction2026.git ~/reach-loop
cd ~/reach-loop
```

## 5. Create `.env` on the guest (the only place secrets live)

```sh
cp .env.example .env
chmod 600 .env
nano .env
```

Set these values. Everything else can keep its default.

```sh
COMPOSE_PROFILES=demo
RESTART_POLICY=unless-stopped
WEB_DOMAIN=frontiershealth.xyz
API_DOMAIN=api.frontiershealth.xyz
WEB_ORIGIN=https://frontiershealth.xyz

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
docker compose up -d --build          # builds every image on the guest: about 3–6 minutes the first time
docker compose logs -f caddy          # wait for "certificate obtained successfully" for both names, then Ctrl+C
```

## 7. Verify

```sh
deploy/check.sh
```

It checks the `.env` values, that no secret is committed, every container's health, that `api` and `web` are bound to `127.0.0.1`, HTTPS on both names with a public certificate, the HTTP→HTTPS redirect, CORS, and a real LLM call through `narrative` (`source: "llm"`). It ends with `All checks passed` or the number of failures. It never prints the API key.

**Hairpin NAT.** `check.sh` runs on the guest and calls its own public names, so the request goes out to the router and back in. Many home routers don't support that ("NAT loopback"). If only the **HTTPS** section fails with `unreachable`, open the URLs from a phone on **mobile data**. If they work there, the demo is fine and the failure is the router, not the stack.

Then open both URLs from a device outside the LAN (a phone on mobile data is easiest):
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

On the guest, from `~/reach-loop`:

```sh
git pull && docker compose up -d --build
```

Compose rebuilds only the images whose code changed and restarts only those containers, so downtime is a few seconds per changed service. Run `deploy/check.sh` afterwards.

A redeploy doesn't touch the host's packages. Don't combine it with `pacman -Syu` on the host on the day (see [Things to know](#things-to-know-for-the-demo)).

## Operations

On the guest, unless the task says host:

| Task | Command |
|---|---|
| Status | `docker compose ps -a` |
| Logs (one service, live) | `docker compose logs -f narrative` |
| Restart one service | `docker compose restart api` |
| Change LLM provider or key | Edit `.env`, then `docker compose up -d narrative` (recreates it with the new env) |
| Roll back to a known-good commit | `git checkout <sha> && docker compose up -d --build`. Go back with `git checkout main`. |
| Stop everything (keeps data and certificates) | `docker compose down` |
| Disk usage / clean old images | `docker system df`, then `docker image prune -f` |
| Guest state (host) | `virsh --connect qemu:///system list --all` |
| Start / shut down the guest (host) | `virsh --connect qemu:///system start reachloop` / `… shutdown reachloop` |
| Snapshot before risky changes (host) | `virsh --connect qemu:///system snapshot-create-as reachloop pre-demo` |

**Never run `docker compose down -v` on the guest.** It deletes the database *and* Caddy's certificates. Getting certificates again on every restart can hit Let's Encrypt rate limits right before the demo.

## Show it: the endpoint walk-through

On the day, these calls tell the story end to end. Set the domain once, then run them from any laptop. Every call is public, read-only and cached for 5 minutes; none of them calls the LLM. Full field-by-field descriptions are in [api.md](api.md).

```sh
API=https://<API_DOMAIN>
```

The filters need `jq` (`sudo pacman -S jq` on Arch, `brew install jq`, `sudo apt install jq`, or `winget install jqlang.jq`). Without it, pipe to `python3 -m json.tool` to read the whole response. On the host itself the public names may not work because of hairpin NAT (see [7. Verify](#7-verify)); run the calls from another network, or on the guest with `API=http://localhost:8000`.

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
- **The LLM is used at rescore time, not on screen.** `engine` asks `narrative` for one Narrative per latest-year Gap (256 today) after each rescore and caches them. The first start on the guest already runs a rescore, so with the `LLM_*` values set in step 5 the cache fills with LLM Narratives straight away. If the key is added or changed later, run `rescore_now` (see [7. Verify](#7-verify)).
- **If the LLM or the network fails during judging, the demo still works.** gap-summary reads the cache, and a Narrative that can't be generated falls back to the Template sentence. Nothing on a request path calls the LLM.
- **LLM credits:** a rescore only calls the LLM for Gaps whose inputs changed. A redeploy with unchanged data makes 0 calls; a full regeneration (new key, model or prompt) makes about 256. Budget for a few full regenerations, not hundreds.
- **`seed` runs again on every `up`.** It's safe to run twice: it reloads the data, rescores, and keeps every unchanged Narrative.
- **After a reboot** everything comes back by itself: the host starts the guest (`virsh autostart`), and the guest starts the stack (`RESTART_POLICY=unless-stopped` plus the Docker service being enabled). `seed` doesn't need to run again.
- **Keep the host awake.** If the Arch host suspends, the guest and the demo go down. Turn off sleep and the screen lock for the session, keep it on power, and don't close the lid of a laptop host.
- **Freeze the host's updates after the rehearsal.** Arch is a rolling release: a `pacman -Syu` on the day can bring a new kernel (VMs can't start until a reboot) or a new QEMU or libvirt. Upgrade and reboot once, well before the rehearsal, then don't run `pacman` on the host until the demo is over. Updating the Ubuntu guest is lower risk, but freeze it too.
- **Browser-side API calls:** today `web` reaches `api` server-side over the internal network (`API_URL=http://api:8000`). If #10 or #18 adds calls from the browser, they must use `https://<API_DOMAIN>`, and CORS already allows `WEB_ORIGIN`. Next.js bakes `NEXT_PUBLIC_*` variables in at build time, so such a URL must be set before `--build`.
- **Cold start before judging:** after the last redeploy, open both URLs once so the first real visitor doesn't wait on a cold start. Rehearsal is #22.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `caddy` logs show `challenge failed` / `no such host` / `timeout` | DNS doesn't point at `<IP>` yet, the router doesn't forward 80/443 to `<GUEST_IP>`, or the network is behind CGNAT ([step 3](#3-public-ip-and-dns)). Check `dig +short <WEB_DOMAIN>` and the router's port-forward page. Caddy retries on its own. |
| `check.sh` HTTPS checks say `unreachable`, but the URLs work from a phone on mobile data | Hairpin NAT: the router can't loop requests back in. Not a problem for the demo. See [7. Verify](#7-verify). |
| Browser warns about the certificate | Caddy hasn't got a certificate yet. Check `docker compose logs caddy`. |
| `caddy` restarting, log mentions the Caddyfile | `WEB_DOMAIN` or `API_DOMAIN` is empty in `.env`. |
| `502 Bad Gateway` | `web` or `api` isn't healthy yet. Check `docker compose ps` and `docker compose logs web api`. |
| `api`/`engine`/`seed` can't connect to `db` (password authentication failed) | `DATABASE_URL` and `POSTGRES_PASSWORD` differ, or the password changed after the volume was created. Fix `.env`. If the data is disposable: `docker compose down && docker volume rm reach-loop_db-data && docker compose up -d`. |
| Check says narrative fell back to the Template sentence | Wrong `LLM_*` value, no credits, or the provider is unreachable from the guest. Check `docker compose logs narrative`, which logs the reason. |
| Check WARNs that the LLM invented a number | The key works, but the model broke the number rule. Try a stronger model. Template sentences cover it either way. |
| Build fails with `Killed` / out of memory | The guest is too small for the Next.js build. Add swap on the guest (`sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`), or give it more memory from the host (`virsh --connect qemu:///system setmaxmem reachloop 6G --config`, then `setmem` the same and restart the guest). |
| `exec format error` | The host is ARM. Use an x86_64 host. |
| `git pull` asks for a password | The deploy key isn't used. Check `~/.ssh/config` and that the key is added to the repo. |
| Host: `virt-install` fails with `KVM is not available` / `/dev/kvm` missing | Virtualisation is off in the BIOS/UEFI, or the kernel was upgraded without a reboot. Check `lscpu`, and compare `uname -r` with `pacman -Q linux`. |
| Host: `virt-install` says the bridge `br0` doesn't exist | The bridge isn't up. Check `nmcli con show --active` and `ip -br addr show br0`. |
| Host: the guest has no LAN IP, or the host loses its network | The bridge wasn't set up, or it was built on Wi-Fi (Wi-Fi can't be bridged). Use wired Ethernet. |
| Host: the guest stops getting traffic after Docker is installed on the host | Docker on the host sets the `FORWARD` policy to `DROP`, which also drops bridged guest traffic. Stop Docker on the host while the guest serves the demo (`sudo systemctl stop docker`), or allow the bridge with `sudo iptables -I DOCKER-USER -i br0 -o br0 -j ACCEPT`. |

## Cloudflare Tunnel from a laptop (no VM, no router access)

The route taken on the day. The venue network hands out private addresses behind
a gateway nobody on the team administers, so ports 80 and 443 cannot be
forwarded to anything — which rules out steps 1–8 above and the Let's Encrypt
challenge they depend on. A Cloudflare Tunnel makes an outbound connection
instead, so no inbound port is needed at all.

Caddy, `COMPOSE_PROFILES=demo`, `WEB_DOMAIN` and `API_DOMAIN` are **not used**
on this path: Cloudflare terminates TLS at its edge and `cloudflared` reaches
the stack on `127.0.0.1`. The stack runs exactly as it does for local
development.

### Quick tunnel vs named tunnel

| | Quick (`cloudflared tunnel --url http://127.0.0.1:3000`) | Named (`cloudflared tunnel run <name>`) |
|---|---|---|
| Hostname | A random `*.trycloudflare.com`, **new one every restart** | `frontiershealth.xyz` |
| Cloudflare account | None | Free account, and the zone on Cloudflare DNS |
| Custom domain | **Impossible.** A CNAME to the quick hostname reaches Cloudflare's edge, but no ingress claims that name, so it answers error 1033 | Yes, that is the point |
| Good for | Sharing a link in five seconds | Anything anyone else will open twice |

A quick tunnel is the right tool for a first share and the wrong one for
judging: the URL dies with the process.

### Named tunnel setup

Three steps need a person — a Cloudflare login and the registrar panel.

**1. Put the zone on Cloudflare (free).** Create a Cloudflare account, *Add a
site* → `frontiershealth.xyz` → Free plan. Cloudflare prints two nameservers.

**2. Swap the nameservers at Spaceship.** Spaceship → Domains →
`frontiershealth.xyz` → Nameservers: replace `launch1.spaceship.net` and
`launch2.spaceship.net` with the two Cloudflare gave you. This also retires the
parking page, so the existing `A` records on the apex need no separate cleanup.
Activation is usually minutes for `.xyz`, but it is the one step with no upper
bound — do it first. Check with:

```sh
dig +short NS frontiershealth.xyz          # expect the two Cloudflare names
```

**3. Authorise `cloudflared` and create the tunnel.**

```sh
brew install cloudflared                   # already present on the demo Mac
cloudflared tunnel login                   # browser; pick the zone. Writes ~/.cloudflared/cert.pem
cloudflared tunnel create frontiers-health # prints the tunnel UUID
```

**4. Write the config.** Copy `deploy/cloudflared/config.example.yml` to
`~/.cloudflared/config.yml` and fill in the UUID in both places.

```sh
cp deploy/cloudflared/config.example.yml ~/.cloudflared/config.yml
$EDITOR ~/.cloudflared/config.yml
cloudflared tunnel ingress validate        # checks the rules before going live
```

**5. Create the DNS records and run it.** `route dns` writes proxied CNAMEs in
the Cloudflare zone, so there is nothing to type into a DNS panel:

```sh
cloudflared tunnel route dns frontiers-health frontiershealth.xyz
cloudflared tunnel route dns frontiers-health api.frontiershealth.xyz
cloudflared tunnel run frontiers-health
```

### Verify

`deploy/check.sh` tests the Caddy path and does not apply here. Check the
hostname the public actually uses:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://frontiershealth.xyz/
curl -sS https://frontiershealth.xyz/ | grep -c 'North Savo'   # real data, not an empty shell
curl -sS -o /dev/null -w '%{http_code}\n' https://api.frontiershealth.xyz/regions
```

A `200` on `/` alone is not proof: the page renders with a 200 when the profile
fetches come back empty. Grep for a Region name, as above.

### Keeping it up for the demo

The laptop is now the server, which is the weakness of this path.

- **Stop the machine sleeping** for the duration: `caffeinate -dimsu` in its own
  terminal, or run the tunnel under it — `caffeinate -dimsu cloudflared tunnel run frontiers-health`.
- **Survive a Docker restart**: set `RESTART_POLICY=unless-stopped` in `.env`
  and `docker compose up -d` once to apply it.
- **The tunnel does not need the network to be stable**, only present; it
  reconnects on its own. Moving to a different Wi-Fi is fine, and the public
  URL does not change — that is the main advantage over the quick tunnel.
- **Do not close the terminal** running `cloudflared`. For something sturdier,
  `brew services` or `cloudflared service install` runs it as a launch agent.

## Fallback: Docker directly on the Arch host (local only)

Use this if the router, DNS or the network fails. The stack runs directly on the Arch host (no VM), and the demo is shown in that machine's browser, on the projector. Nothing is reachable from other devices, and there's no HTTPS, so this doesn't meet #12. It's a backup, not a replacement.

Set it up **the day before, while online**, so the images are built and the Narrative cache is filled with LLM Narratives:

```sh
sudo pacman -S --needed docker docker-compose docker-buildx git jq
sudo systemctl enable --now docker.service
sudo usermod -aG docker $USER        # log out and back in

git clone git@github.com:balintpragai/Junction2026.git ~/reach-loop && cd ~/reach-loop   # or use your existing checkout, on an up-to-date main
cp .env.example .env && chmod 600 .env
```

On Arch, the Docker convenience script isn't supported. `docker-compose` provides the `docker compose` plugin, and `docker-buildx` is required by `docker compose … --build`.

In `.env`, set only the three `LLM_*` values. Leave `COMPOSE_PROFILES`, `WEB_DOMAIN`, `API_DOMAIN` and `WEB_ORIGIN` at their defaults: no Caddy, and CORS stays on `http://localhost:3000`. `BIND_ADDRESS=127.0.0.1` keeps both ports off the venue Wi-Fi.

```sh
docker compose up -d --build
```

Then open `http://localhost:3000` and `http://localhost:8000/docs`. Run the [walk-through](#show-it-the-endpoint-walk-through) with `API=http://localhost:8000`, and check the cache's sources with the `psql` query in [7. Verify](#7-verify).

`deploy/check.sh` is written for the guest. On the host, its **Configuration**, **caddy** and **HTTPS** checks fail by design. Its **Containers** checks (except caddy), its secrets checks and its **LLM** check still apply.

On the day:
- **Docker on the host can block the guest** (see the last [troubleshooting](#troubleshooting) row). When the guest is serving the demo, keep Docker on the host stopped (`sudo systemctl stop docker`). Start it only if you switch to the fallback.
- **Offline works.** With the images built and the cache filled, `docker compose up -d` needs no network. `seed` rescores from the local data and keeps every unchanged Narrative, so nothing calls the LLM. If the LLM can't be reached, the cards fall back to Template sentences.
- **Don't run `docker compose up --build`, `pacman` or `git pull` on the venue network** unless you have to. A build needs the internet to pull base images and packages.

| Symptom (host) | Fix |
|---|---|
| `docker: 'compose' is not a docker command` | `sudo pacman -S docker-compose` |
| `compose build requires buildx` | `sudo pacman -S docker-buildx` |
| `permission denied … /var/run/docker.sock` | Not in the `docker` group yet: `sudo usermod -aG docker $USER`, log out and back in, check with `groups`. |
| `Cannot connect to the Docker daemon` | `sudo systemctl enable --now docker.service` |
| `failed to create network`, or errors mentioning `modprobe`, `bridge`, `overlay` or `iptables` | A kernel upgrade without a reboot: compare `uname -r` with `pacman -Q linux`, then `sudo reboot`. |
