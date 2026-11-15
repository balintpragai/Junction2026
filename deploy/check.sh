#!/usr/bin/env bash
# Verify the demo host against issue #12. Run on the VM from the repo root:
#
#   deploy/check.sh
#
# Prints PASS/FAIL per check and exits non-zero if anything failed.
# Never prints the LLM API key.
set -uo pipefail
cd "$(dirname "$0")/.."

fails=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fails=$((fails + 1)); }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$1"; }
http_code() { # HTTP status, or "unreachable"
  local c; c=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 10 "$1")
  [[ $c == 000 ]] && echo unreachable || echo "$c"
}
env_value() { # value of KEY in .env, without sourcing the file
  sed -n "s/^$1=//p" .env 2>/dev/null | tail -1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

echo "== Configuration (.env)"
if [[ -f .env ]]; then pass ".env exists"; else fail ".env missing: cp .env.example .env and fill the demo section"; fi
WEB_DOMAIN=$(env_value WEB_DOMAIN); API_DOMAIN=$(env_value API_DOMAIN)
[[ -n $WEB_DOMAIN ]] && pass "WEB_DOMAIN=$WEB_DOMAIN" || fail "WEB_DOMAIN is empty"
[[ -n $API_DOMAIN ]] && pass "API_DOMAIN=$API_DOMAIN" || fail "API_DOMAIN is empty"
[[ $(env_value COMPOSE_PROFILES) == *demo* ]] && pass "COMPOSE_PROFILES includes demo" || fail "COMPOSE_PROFILES must include demo (otherwise Caddy doesn't start)"
[[ $(env_value RESTART_POLICY) == unless-stopped ]] && pass "RESTART_POLICY=unless-stopped" || warn "RESTART_POLICY is not unless-stopped: services won't come back after a reboot"
[[ $(env_value WEB_ORIGIN) == "https://$WEB_DOMAIN" ]] && pass "WEB_ORIGIN=https://$WEB_DOMAIN" || fail "WEB_ORIGIN should be https://$WEB_DOMAIN (CORS)"
pw=$(env_value POSTGRES_PASSWORD)
[[ -n $pw && $pw != reachloop ]] && pass "POSTGRES_PASSWORD changed from the default" || warn "POSTGRES_PASSWORD is the default"
[[ -n $pw && $(env_value DATABASE_URL) == *":$pw@"* ]] && pass "DATABASE_URL uses POSTGRES_PASSWORD" || fail "DATABASE_URL must contain the same password as POSTGRES_PASSWORD"
for v in LLM_BASE_URL LLM_MODEL LLM_API_KEY; do
  [[ -n $(env_value $v) ]] && pass "$v is set" || fail "$v is empty"
done

echo "== Secrets stay on the host"
git check-ignore -q .env && pass ".env is gitignored" || fail ".env is NOT gitignored"
[[ -z $(git ls-files .env) ]] && pass ".env is not tracked" || fail ".env is tracked by git"
if git grep -nE '^(LLM_API_KEY|POSTGRES_PASSWORD)=[^<[:space:]]' -- . ':!.env.example' ':!*.md' >/dev/null; then
  fail "a committed file sets LLM_API_KEY or POSTGRES_PASSWORD: $(git grep -lE '^(LLM_API_KEY|POSTGRES_PASSWORD)=[^<[:space:]]' -- . ':!.env.example' ':!*.md' | tr '\n' ' ')"
else
  pass "no committed file sets LLM_API_KEY or POSTGRES_PASSWORD"
fi
[[ -z $(sed -n 's/^LLM_API_KEY=//p' .env.example) ]] && pass ".env.example has an empty LLM_API_KEY" || fail ".env.example contains an LLM_API_KEY value"

echo "== Containers"
docker compose ps -a --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
for s in db narrative engine api web caddy; do
  st=$(docker compose ps -a --format '{{.Service}} {{.Status}}' | awk -v s=$s '$1==s {$1=""; print}')
  [[ $st == *"(healthy)"* || ($s == caddy && $st == *Up*) ]] && pass "$s:$st" || fail "$s:${st:- not running}"
done
st=$(docker compose ps -a --format '{{.Service}} {{.Status}}' | awk '$1=="seed" {$1=""; print}')
[[ $st == *"Exited (0)"* ]] && pass "seed:$st" || fail "seed:${st:- not run}"
for s in api web; do
  bind=$(docker compose port $s $([[ $s == api ]] && echo 8000 || echo 3000) 2>/dev/null)
  [[ $bind == 127.0.0.1:* ]] && pass "$s port bound to $bind only (reachable through Caddy)" || fail "$s port is published as '$bind' (expected 127.0.0.1:…)"
done

echo "== HTTPS"
for url in "https://$WEB_DOMAIN/health" "https://$WEB_DOMAIN/" "https://$API_DOMAIN/health" "https://$API_DOMAIN/regions" "https://$API_DOMAIN/docs"; do
  code=$(http_code "$url")
  [[ $code == 200 ]] && pass "$url -> 200" || fail "$url -> $code"
done
issuer=$(curl -sv --connect-timeout 5 --max-time 10 -o /dev/null "https://$WEB_DOMAIN/health" 2>&1 | sed -n 's/^\*[[:space:]]*issuer: //p')
[[ $issuer == *"Let's Encrypt"* || $issuer == *ZeroSSL* ]] && pass "certificate issuer: $issuer" || fail "certificate issuer: ${issuer:-none} (expected a public CA)"
code=$(http_code "http://$WEB_DOMAIN/")
[[ $code == 308 || $code == 301 ]] && pass "http://$WEB_DOMAIN redirects to HTTPS ($code)" || fail "http://$WEB_DOMAIN -> $code (expected a redirect)"
cors=$(curl -sS -D - -o /dev/null --connect-timeout 5 --max-time 10 -H "Origin: https://$WEB_DOMAIN" "https://$API_DOMAIN/regions" 2>&1 | tr -d '\r' | sed -n 's/^access-control-allow-origin: //Ip')
[[ $cors == "https://$WEB_DOMAIN" ]] && pass "api allows CORS from https://$WEB_DOMAIN" || fail "api CORS allow-origin is '${cors}' (check WEB_ORIGIN)"

echo "== The Decision Map has data to draw"
# A 200 on / is not enough: the page renders an "API reachable?" card with a
# 200 when the profile fetches come back empty, which looks fine to curl and
# blank to a judge. Check the routes it actually reads, then the page itself.
regions_json=$(curl -sS --connect-timeout 5 --max-time 20 "https://$API_DOMAIN/regions" 2>/dev/null)
n_regions=$(printf '%s' "$regions_json" | grep -o '"code"' | wc -l | tr -d ' ')
[[ ${n_regions:-0} -eq 23 ]] && pass "api serves 23 Regions" || fail "api serves ${n_regions:-0} Regions (expected 23)"
# Prefer Helsinki (Sotkanet 90): it is the Region the demo opens on, and the
# one every fixture and Narrative example uses. Fall back to the first Region
# listed. Note the whole response is one line, so match per occurrence rather
# than with a greedy sed, which would pick the last Region (Åland, which has
# no peer group and may have no scored Gap).
all_codes=$(printf '%s' "$regions_json" | grep -o '"code":"[^"]*"' | sed 's/^"code":"//; s/"$//')
if printf '%s\n' "$all_codes" | grep -qx 90; then
  first_code=90
else
  first_code=$(printf '%s\n' "$all_codes" | head -1)
fi

overview=$(curl -sS --connect-timeout 5 --max-time 20 "https://$API_DOMAIN/overview" 2>/dev/null)
n_rows=$(printf '%s' "$overview" | grep -o '"indicators_tracked"' | wc -l | tr -d ' ')
[[ ${n_rows:-0} -eq 23 ]] && pass "/overview has a row per Region" || fail "/overview has ${n_rows:-0} rows (expected 23)"
printf '%s' "$overview" | grep -q '"indicators_tracked":0' \
  && warn "some Regions have no scored indicator: check that the rescore job ran for every one" \
  || pass "every Region has at least one scored indicator"

if [[ -n $first_code ]]; then
  profile=$(curl -sS --connect-timeout 5 --max-time 20 "https://$API_DOMAIN/regions/$first_code/profile" 2>/dev/null)
  printf '%s' "$profile" | grep -q '"synthesis":\[' && pass "/regions/$first_code/profile returns a profile" \
    || fail "/regions/$first_code/profile did not return a profile"
  printf '%s' "$profile" | grep -q '"narrative"' && pass "the profile carries Narratives" || fail "the profile has no Narrative"
  printf '%s' "$profile" | grep -q '"source":"llm"' \
    && pass "at least one Narrative is checked LLM text" \
    || warn "every Narrative is a Template sentence: correct but plainer (check LLM_* and that the rescore ran)"
  lib_code=$(http_code "https://$API_DOMAIN/regions/$first_code/action-library")
  [[ $lib_code == 200 ]] && pass "/regions/$first_code/action-library -> 200" || fail "action-library -> $lib_code"
else
  fail "could not read a Region code from /regions, so the profile routes were not checked"
fi

home=$(curl -sS --connect-timeout 5 --max-time 30 "https://$WEB_DOMAIN/" 2>/dev/null)
printf '%s' "$home" | grep -q "Could not reach the API" \
  && fail "the web home page is showing its 'Could not reach the API' card (api up, but web cannot read it: check API_URL)" \
  || pass "the web home page is not showing the API-unreachable card"

echo "== LLM (narrative, from inside the compose network)"
result=$(docker compose exec -T narrative python - <<'PY' 2>&1
import json, urllib.request
req = {
    "region_name": "City of Helsinki", "indicator_name": "Breast cancer screening attendance", "unit": "%",
    "gap": {"region_code": "90", "indicator_code": "3621", "year": 2024, "value": 74.3,
            "reference_kind": "target", "reference_value": 80.0, "deviation": -5.7, "direction": "below",
            "severity": "act", "rank": 21, "n_regions": 23, "peer_values": [], "trend_5y": None},
    "action_text": "Raise screening participation through targeted invitations.",
}
r = urllib.request.urlopen(urllib.request.Request(
    "http://localhost:8000/narrative", data=json.dumps(req).encode(),
    headers={"Content-Type": "application/json"}), timeout=60)
print(r.read().decode())
PY
)
echo "    $result"
if [[ $result == *'"source":"llm"'* ]]; then
  pass "narrative used the LLM and the output passed the number-check"
elif [[ $result == *'"rejected_numbers":["'* ]]; then
  warn "the LLM answered but invented a number; Template sentence used (fine, but check the model)"
else
  fail "narrative fell back to the Template sentence: check LLM_* and 'docker compose logs narrative'"
fi

echo
if ((fails)); then echo "$fails check(s) failed."; exit 1; fi
echo "All checks passed. Share https://$WEB_DOMAIN and https://$API_DOMAIN with the team."
