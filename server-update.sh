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

echo "[1/5] Code aktualisieren..."
git pull origin main
echo "  OK"

echo "[2/5] Server-Dependencies..."
cd "$INSTALL_DIR/server"
npm install --production
echo "  OK"

echo "[3/5] Client bauen..."
cd "$INSTALL_DIR/client"
npm install
./node_modules/.bin/vite build
echo "  OK"

echo "[4/5] Self-Signed Cert prüfen..."
CERT_DIR="$INSTALL_DIR/certs"
mkdir -p "$CERT_DIR"
if [ ! -f "$CERT_DIR/cert.pem" ] || [ ! -f "$CERT_DIR/key.pem" ]; then
  command -v openssl >/dev/null 2>&1 || apt-get install -y -qq openssl
  SERVER_IP=$(hostname -I | awk '{print $1}')
  openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
    -days 3650 \
    -subj "/CN=mysignage" \
    -addext "subjectAltName = DNS:localhost,DNS:mysignage,IP:127.0.0.1,IP:${SERVER_IP}" \
    >/dev/null 2>&1
  chmod 600 "$CERT_DIR/key.pem"
  echo "  Cert angelegt für IP $SERVER_IP"

  # HTTPS_PORT in .env eintragen falls noch nicht da
  ENV_FILE="$INSTALL_DIR/server/.env"
  if [ -f "$ENV_FILE" ] && ! grep -q "HTTPS_PORT" "$ENV_FILE"; then
    echo "HTTPS_PORT=3443" >> "$ENV_FILE"
    echo "  HTTPS_PORT in .env ergänzt"
  fi
else
  echo "  OK"
fi

echo "[5/5] Server neu starten..."
pm2 restart mysignage
sleep 2
pm2 status

echo ""
echo "==========================================="
echo "  Update abgeschlossen!"
echo "==========================================="
