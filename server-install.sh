#!/bin/bash
# ─────────────────────────────────────────────────────────
# mySignage Server Install
#
# Richtet einen frischen Debian-Server als mySignage-Server ein.
#
# Nutzung:
#   curl -sSL https://raw.githubusercontent.com/schco039/mysignage/main/server-install.sh | bash
#
# Oder manuell:
#   bash server-install.sh
# ─────────────────────────────────────────────────────────

set -e

REPO="https://github.com/schco039/mysignage.git"
INSTALL_DIR="/opt/mysignage"
NODE_VERSION="18"

echo ""
echo "==========================================="
echo "  mySignage Server Install"
echo "  $(date)"
echo "==========================================="
echo ""

# Root-Check
if [ "$(id -u)" -ne 0 ]; then
  echo "FEHLER: Dieses Script muss als root ausgeführt werden."
  echo "  sudo bash server-install.sh"
  exit 1
fi

# ─── 1. System Update ────────────────────────────────────
echo "[1/7] System update..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt-get install -y -qq curl gnupg git ca-certificates lsb-release
echo "  OK"

# ─── 2. Node.js 18 ───────────────────────────────────────
echo "[2/7] Node.js ${NODE_VERSION} installieren..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node.js $(node -v) OK"

# ─── 3. MongoDB ──────────────────────────────────────────
echo "[3/7] MongoDB installieren..."
if ! command -v mongod &>/dev/null; then
  # MongoDB 8.0 offiziell nur bis Debian 12 (bookworm) — funktioniert auch auf 13
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi
systemctl enable mongod
systemctl start mongod
echo "  MongoDB $(mongod --version | head -1) OK"

# ─── 4. System-Tools (ffmpeg, sharp-deps) ────────────────
echo "[4/7] System-Tools installieren..."
apt-get install -y -qq \
  ffmpeg \
  libvips-dev \
  build-essential
echo "  ffmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}') OK"

# ─── 5. Projekt klonen / aktualisieren ───────────────────
echo "[5/7] mySignage Projekt einrichten..."
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  Bestehendes Verzeichnis gefunden — aktualisiere..."
  git -C "$INSTALL_DIR" pull
else
  git clone "$REPO" "$INSTALL_DIR"
fi

# npm install (Server)
cd "$INSTALL_DIR/server"
npm install --production
echo "  Server-Dependencies OK"

# npm install + build (Client)
cd "$INSTALL_DIR/client"
npm install
./node_modules/.bin/vite build
echo "  Client gebaut OK"

# ─── 6. .env anlegen (falls nicht vorhanden) ─────────────
echo "[6/7] Konfiguration..."
ENV_FILE="$INSTALL_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$ENV_FILE" << EOF
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/mysignage
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
EOF
  echo "  .env angelegt (JWT_SECRET zufällig generiert)"
else
  echo "  .env existiert bereits — nicht überschrieben"
fi

# ─── 7. pm2 einrichten ───────────────────────────────────
echo "[7/7] pm2 einrichten..."
npm install -g pm2 --quiet

cd "$INSTALL_DIR"
pm2 delete mysignage 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# Warten bis Server bereit ist (max 30s)
echo "  Warte auf Server..."
for i in $(seq 1 30); do
  curl -s http://localhost:3001/api/v1/auth/login >/dev/null 2>&1 && break
  sleep 1
done

# Admin-User anlegen falls DB leer
USER_COUNT=$(mongosh mysignage --eval 'db.users.countDocuments()' --quiet 2>/dev/null | tail -1)
if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "  Admin-User anlegen..."
  curl -s -X POST http://localhost:3001/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","email":"admin@mysignage.local","password":"admin"}' >/dev/null
  echo "  Admin-User angelegt (admin / admin)"
else
  echo "  User bereits vorhanden — übersprungen"
fi

echo ""
echo "==========================================="
echo "  mySignage Installation abgeschlossen!"
echo ""
echo "  URL:    http://$(hostname -I | awk '{print $1}'):3001"
echo "  Logs:   pm2 logs mysignage"
echo "  Status: pm2 status"
echo ""
echo "  Erster Login: admin / admin"
echo "  (Bitte Passwort sofort ändern!)"
echo "==========================================="
