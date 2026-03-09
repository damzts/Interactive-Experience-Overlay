#!/usr/bin/env bash
# dev.sh — manage IEOM dev services
# Usage: ./dev.sh [start|stop|restart]  (default: restart)
set -e

export PATH="/home/damzts/.local/share/pnpm:$PATH"
PORTS=(3000 3001 3002)

do_stop() {
  echo "→ Stopping processes on ports ${PORTS[*]}..."
  for port in "${PORTS[@]}"; do
    pids=$(ss -tlnp "sport = :$port" 2>/dev/null | awk 'NR>1{match($0,/pid=([0-9]+)/,a); if(a[1]) print a[1]}')
    if [[ -n "$pids" ]]; then
      echo "  killing port $port (pids: $pids)"
      echo "$pids" | xargs kill 2>/dev/null || true
    fi
  done
  sleep 1
  echo "→ Stopped."
}

do_start() {
  cd "$(dirname "$0")"
  echo "→ Starting IEOM dev (server :3000 | overlay :3001 | admin :3002)..."
  exec pnpm dev
}

CMD="${1:-restart}"

case "$CMD" in
  stop)
    do_stop
    ;;
  start)
    do_start
    ;;
  restart)
    do_stop
    do_start
    ;;
  *)
    echo "Usage: $0 [start|stop|restart]"
    exit 1
    ;;
esac
