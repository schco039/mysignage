#!/bin/bash
# ─────────────────────────────────────────────────────────
# mySignage First Boot Auto-Setup
# Liest Server-URL aus /boot/firmware/mysignage-server.conf
# ─────────────────────────────────────────────────────────

LOG="/var/log/mysignage-setup.log"

# Output auf Log und Console (HDMI)
exec > >(tee -a "$LOG" > /dev/console 2>/dev/null) 2>&1

echo ""
echo "==========================================="
echo "  mySignage Auto-Setup gestartet"
echo "  $(date)"
echo "==========================================="
echo ""

# Server-URL aus Config laden (CRLF-tolerant — Windows-Line-Endings entfernen)
CONF="/boot/firmware/mysignage-server.conf"
MYSIGNAGE_SERVER=""
if [ -f "$CONF" ]; then
  MYSIGNAGE_SERVER=$(grep '^MYSIGNAGE_SERVER=' "$CONF" | head -1 | sed 's/^MYSIGNAGE_SERVER=//' | tr -d '\r\n[:space:]')
fi

if [ -z "$MYSIGNAGE_SERVER" ]; then
  echo "FEHLER: Keine Server-Konfiguration gefunden!"
  echo "Erwartet: $CONF mit MYSIGNAGE_SERVER=http://..."
  exit 1
fi

echo "Server: $MYSIGNAGE_SERVER"
echo ""

# Host aus URL extrahieren für Ping
SERVER_HOST=$(echo "$MYSIGNAGE_SERVER" | sed -E 's|^https?://([^:/]+).*|\1|')

# Wait for network (max 3 min)
echo "[1/4] Warte auf Netzwerk..."
for i in $(seq 1 180); do
  ping -c1 -W1 "$SERVER_HOST" >/dev/null 2>&1 && break
  [ $((i % 15)) -eq 0 ] && echo "  ... noch kein Netzwerk (${i}s)"
  sleep 1
done

if ! ping -c1 -W1 "$SERVER_HOST" >/dev/null 2>&1; then
  echo "FEHLER: Server $SERVER_HOST nach 3 Minuten nicht erreichbar!"
  exit 1
fi
echo "  Netzwerk OK"

# Wait for apt
echo "[2/4] Warte auf apt..."
for i in $(seq 1 60); do
  fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || break
  sleep 5
done
for i in $(seq 1 60); do
  fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || break
  sleep 5
done
sleep 5
echo "  apt frei"

# Setup-Script vom Server holen und ausführen
echo "[3/4] Starte mySignage Setup..."
echo ""

export MYSIGNAGE_NO_REBOOT=1
curl -sSL "$MYSIGNAGE_SERVER/setup.sh" | bash -s "$MYSIGNAGE_SERVER"

echo ""
echo "[4/4] Setup abgeschlossen!"

# Aufräumen
rm -f /boot/firmware/mysignage-firstboot.sh 2>/dev/null
# Server-Config behalten für späteren Re-Run

echo ""
echo "==========================================="
echo "  mySignage Installation fertig!"
echo "  Neustart in 3 Sekunden..."
echo "==========================================="
sleep 3
reboot
