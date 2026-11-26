#!/usr/bin/env bash
# Checks that this repo's ENTIRE git history is safe to publish: run it before
# the first push, and before making the repo public.
#   ALLOWED_EMAIL  the only author/committer email allowed
#                  (default: this clone's user.email)
# Needs the private-term denylist (see scripts/check-private-terms.mjs) and
# Docker (for gitleaks).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
ALLOWED_EMAIL="${ALLOWED_EMAIL:-$(git config user.email)}"

fail=0
ok() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }

echo "Publish check (all branches, full history + staged changes)"
history=""
if git rev-parse --verify -q HEAD >/dev/null; then history="--all"; fi
everything() { { [ -n "$history" ] && git log --all -p --format='commit %H%n%an <%ae>%n%B'; git diff --cached; } || true; }

# 1. No env files, keys, databases, archives or other private data files.
paths="$( { [ -n "$history" ] && git log --all --name-only --format=; git diff --cached --name-only; } \
  | grep -Ei '\.(sql|sql\.gz|dump|bak|pem|key|p12|pfx|jks|keystore|sqlite3?|db|psd|tar|tar\.gz|tgz|zip)$|(^|/)\.env(\.[^/]*)?$|(^|/)CLAUDE\.md$|(^|/)\.claude/' \
  | grep -v '\.env\.example$' | sort -u || true)"
if [ -z "$paths" ]; then
  ok "no env files, keys, dumps, archives or AI-assistant files in history"
else
  bad "unexpected paths in history: ${paths//$'\n'/ }"
fi

# 2. Private terms in every patch, path, author and commit message.
if everything | node scripts/check-private-terms.mjs - >/dev/null 2>&1; then
  ok "no private terms in history"
else
  bad "private terms found (or no denylist). Details:"
  everything | node scripts/check-private-terms.mjs - 2>&1 | head -20 | sed 's/^/         /' || true
fi

# 3. Identities: yours, GitHub's web-UI committer and Renovate's.
if [ -n "$history" ]; then
  others="$(git log --all --format='%ae%n%ce' | sort -u | grep -vxF "$ALLOWED_EMAIL" \
    | grep -vxF -e 'noreply@github.com' -e '29139614+renovate[bot]@users.noreply.github.com' || true)"
  if [ -z "$others" ]; then
    ok "all commits use $ALLOWED_EMAIL"
  else
    bad "unexpected author/committer emails: ${others//$'\n'/ }"
  fi
fi

# 4. Secrets scanner over the full history.
gitleaks_image=ghcr.io/gitleaks/gitleaks:v8.30.1
if [ -z "$history" ]; then
  echo "  skip gitleaks (no commits yet)"
elif ! command -v docker >/dev/null 2>&1; then
  bad "docker not found: cannot run the gitleaks history scan"
elif docker run --rm -v "$PWD:/repo:ro" "$gitleaks_image" git --no-banner --redact /repo >/dev/null 2>&1; then
  ok "gitleaks: no secrets in history"
else
  bad "gitleaks found something. Details: docker run --rm -v \$PWD:/repo:ro $gitleaks_image git --redact -v /repo"
fi

if [ "$fail" -ne 0 ]; then
  echo "NOT safe to publish."
  exit 1
fi
echo "Safe to publish."
