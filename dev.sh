#!/usr/bin/env bash
# dev.sh — kill any processes on the IEOM ports and (re)start all services
set -e

export PATH="/home/damzts/.local/share/pnpm:$PATH"
PORTS=(3000 3001 3002)

echo "→ Stopping old processes on ports ${PORTS[*]}..."
for port in "${PORTS[@]}"; do
  pids=$(ss -tlnp "sport = :$port" 2>/dev/null | awk 'NR>1{match($0,/pid=([0-9]+)/,a); if(a[1]) print a[1]}')
  if [[ -n "$pids" ]]; then
    echo "  killing port $port (pids: $pids)"
    echo "$pids" | xargs kill 2>/dev/null || true
  fi
done

# Give processes a moment to die
sleep 1

cd "$(dirname "$0")"
echo "→ Starting IEOM dev (server :3000 | overlay :3001 | admin :3002)..."
exec pnpm dev
