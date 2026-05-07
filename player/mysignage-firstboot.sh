#!/bin/bash
# ─────────────────────────────────────────────────────────
# mySignage First Boot Auto-Setup
# Called by cloud-init runcmd on first boot
# ─────────────────────────────────────────────────────────

LOG="/var/log/mysignage-setup.log"

# Alles loggen UND auf Console (HDMI) anzeigen
exec > >(tee -a "$LOG" > /dev/console 2>/dev/null) 2>&1

echo ""
echo "==========================================="
echo "  mySignage Auto-Setup gestartet"
echo "  $(date)"
echo "==========================================="
echo ""

# Wait for network (max 3 min)
echo "[1/4] Warte auf Netzwerk..."
for i in $(seq 1 180); do
  ping -c1 -W1 91.98.144.84 >/dev/null 2>&1 && break
  [ $((i % 15)) -eq 0 ] && echo "  ... noch kein Netzwerk (${i}s)"
  sleep 1
done

if ! ping -c1 -W1 91.98.144.84 >/dev/null 2>&1; then
  echo "FEHLER: Kein Netzwerk nach 3 Minuten!"
  exit 1
fi
echo "  Netzwerk OK"

# Wait for apt to be free
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

# Download and run the main setup script
echo "[3/4] Starte mySignage Setup..."
echo ""

# Tell setup.sh not to reboot — we do it ourselves at the end
export MYSIGNAGE_NO_REBOOT=1
curl -sSL http://91.98.144.84:3001/setup.sh | bash

echo ""
echo "[4/4] Setup abgeschlossen!"

# Clean up firstboot script from boot partition
rm -f /boot/firmware/mysignage-firstboot.sh 2>/dev/null

echo ""
echo "==========================================="
echo "  mySignage Installation fertig!"
echo "  Neustart in 3 Sekunden..."
echo "==========================================="
sleep 3
reboot
