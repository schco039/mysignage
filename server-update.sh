#!/bin/bash
# ─────────────────────────────────────────────────────────
# mySignage Server Update
#
# Zieht den aktuellen Stand von GitHub und startet neu.
#
# Nutzung:
#   bash server-update.sh
# ─────────────────────────────────────────────────────────

set -e
INSTALL_DIR="/opt/mysignage"

echo ""
echo "==========================================="
echo "  mySignage Server Update"
echo "  $(date)"
echo "==========================================="
echo ""

if [ "$(id -u)" -ne 0 ]; then
  echo "FEHLER: Als root ausführen."
  exit 1
fi

cd "$INSTALL_DIR"

echo "[1/4] Code aktualisieren..."
git pull origin main
echo "  OK"

echo "[2/4] Server-Dependencies..."
cd "$INSTALL_DIR/server"
npm install --production
echo "  OK"

echo "[3/4] Client bauen..."
cd "$INSTALL_DIR/client"
npm install
./node_modules/.bin/vite build
echo "  OK"

echo "[4/4] Server neu starten..."
pm2 restart mysignage
sleep 2
pm2 status

echo ""
echo "==========================================="
echo "  Update abgeschlossen!"
echo "==========================================="
