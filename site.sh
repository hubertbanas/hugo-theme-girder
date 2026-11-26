#!/usr/bin/env bash
# Preview and build the theme's demo site (exampleSite/) with Hugo in Docker.
# Usage: ./site.sh {start|stop|restart|status|logs|build|check|help}
set -euo pipefail
cd "$(dirname "$0")"

HOST_UID="$(id -u)"
HOST_GID="$(id -g)"
export HOST_UID HOST_GID
# Optional .env (also read by docker compose), e.g. PORT=1314
if [ -z "${PORT:-}" ] && [ -f .env ]; then PORT="$(sed -n 's/^PORT=//p' .env)"; fi
export PORT="${PORT:-1313}"
URL="http://localhost:${PORT}"
compose() { docker compose "$@"; }
running() { [ -n "$(compose ps -q --status running hugo 2>/dev/null)" ]; }
# The host port the running container is published on, which can differ from
# $PORT when it was started with another PORT=.
running_port() {
  docker inspect -f '{{range $p, $b := .NetworkSettings.Ports}}{{range $b}}{{.HostPort}} {{end}}{{end}}' \
    "$(compose ps -q hugo)" 2>/dev/null | awk '{print $1}'
}

# The address a build is for. The default has a sub-path, as a GitHub Pages
# project site does, so the build check catches links that ignore it.
SITE_URL="${SITE_URL:-https://example.org/hugo-theme-girder/}"

check_port() {
  if ! running && (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
    echo "Port $PORT is already in use by something else." >&2
    echo "Stop that, or pick another port:  PORT=$((PORT + 1)) ./site.sh ${1:-start}" >&2
    exit 1
  fi
}

wait_ready() {
  printf 'Waiting for Hugo'
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$URL/" 2>/dev/null; then
      printf ' ready.\n'
      return 0
    fi
    # A template or content error stops the server: show it instead of waiting.
    if ! running; then break; fi
    printf '.'
    sleep 1
  done
  printf '\nHugo did not come up. Recent logs:\n'
  compose logs --tail 30 hugo
  return 1
}

urls() {
  local port="$PORT"
  if running; then port="$(running_port)"; fi
  echo "  Demo site: http://localhost:${port:-$PORT}/"
}

build() {
  # Production build into exampleSite/public/, as CI does it.
  rm -rf exampleSite/public
  compose run --rm --no-deps hugo --gc --minify --baseURL "$SITE_URL"
}

case "${1:-help}" in
  start)
    if running; then
      echo "Already running."
      urls
      exit 0
    fi
    check_port start
    compose up -d
    wait_ready && urls
    ;;
  stop)
    compose down
    ;;
  restart)
    compose down
    check_port restart
    compose up -d
    wait_ready && urls
    ;;
  status)
    if running; then
      echo "Running:"
      urls
    else
      echo "Not running."
    fi
    ;;
  logs)
    compose logs -f --tail 50 hugo
    ;;
  build)
    build
    echo "Built into ./exampleSite/public/ for $SITE_URL"
    ;;
  check)
    # What CI runs: format, lint, spelling, the private-terms scan, then the
    # build and the checks on its output. Needs Node 22+ for the tools.
    command -v npm >/dev/null || { echo "npm not found (Node 22+ is needed)." >&2; exit 1; }
    [ -d node_modules ] || npm ci --no-audit --no-fund
    npm run check
    npm run check:private
    build
    SITE_URL="$SITE_URL" npm run check:build
    echo "All checks passed."
    ;;
  help | -h | --help)
    sed -n '2,3p' "$0" | sed 's/^# \{0,1\}//'
    cat <<HELP

  start     Start the preview server in the background (live reload)
  stop      Stop and remove the preview container
  restart   Stop, then start
  status    Show whether the preview server is running
  logs      Follow the Hugo server logs (Ctrl+C to exit)
  build     Production build into ./exampleSite/public/
  check     Run CI's checks: format, lint, spelling, private terms, build, build check

Env: PORT=1314 ./site.sh start    (default port 1313)
     SITE_URL=https://example.org/ ./site.sh build    (default has a sub-path)
HELP
    ;;
  *)
    echo "Unknown command: $1 (try ./site.sh help)" >&2
    exit 1
    ;;
esac
