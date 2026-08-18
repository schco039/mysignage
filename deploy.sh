#!/bin/bash
# ─────────────────────────────────────────────────────────
# mySignage — lokalen Stand direkt auf einen Server schieben
#
# Für schnelle Dev-Iteration ohne Commit/Push. Der reguläre Weg für
# Produktion ist server-update.sh (git pull auf dem Server).
#
# Nutzung:
#   bash deploy.sh                    # Default-Host
#   bash deploy.sh root@10.0.0.5      # anderer Host
#   MYSIGNAGE_HOST=root@10.0.0.5 bash deploy.sh
# ─────────────────────────────────────────────────────────

set -e

VPS="${1:-${MYSIGNAGE_HOST:-root@91.98.144.84}}"
REMOTE="${MYSIGNAGE_REMOTE:-/opt/mysignage}"

echo "Ziel: $VPS:$REMOTE"
echo ""

echo "[1/4] Client bauen..."
(cd client && npx vite build)

echo "[2/4] Client hochladen..."
ssh "$VPS" "rm -rf '$REMOTE/client/dist' && mkdir -p '$REMOTE/client/dist'"
tar czf - -C client/dist . | ssh "$VPS" "tar xzf - -C '$REMOTE/client/dist'"

# Vorher gingen nur services/, controllers/ und server.js rüber — Änderungen
# an models/, routes/, middleware/, socket/ und config/ kamen nie an.
# Jetzt der komplette Baum, ohne node_modules, .env und Datenverzeichnisse.
echo "[3/4] Server + Player hochladen..."
tar czf - -C server --exclude=node_modules --exclude=.env --exclude=data . | ssh "$VPS" "tar xzf - -C '$REMOTE/server'"

# player/ wird über /player-download/ an die Player ausgeliefert. Ohne
# diesen Schritt bekommen sie beim Setup weiterhin den alten Stand.
tar czf - -C player --exclude=node_modules --exclude=media --exclude=config.json --exclude=state.json . | ssh "$VPS" "tar xzf - -C '$REMOTE/player'"

echo "[4/4] Dependencies + Neustart..."
ssh "$VPS" "cd '$REMOTE/server' && npm install --production --no-audit --no-fund && pm2 restart mysignage"

echo ""
echo "Fertig."
