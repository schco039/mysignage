#!/bin/bash
# mySignage Player - First Boot Setup
#
# ANLEITUNG:
# 1. Raspberry Pi OS 64-bit mit Pi Imager flashen
#    (SSH aktivieren, User: pi, Passwort setzen, WLAN konfigurieren)
# 2. Diese Datei auf die Boot-Partition (bootfs) kopieren
# 3. SD-Karte in den Pi, booten, warten (~10 Min)
# 4. Player erscheint im Dashboard: http://91.98.144.84:3001

set -e

SERVER_URL="http://91.98.144.84:3001"
INSTALL_DIR="/home/pi/mysignage"

exec > /var/log/mysignage-setup.log 2>&1
echo "mySignage setup started: $(date)"

# Wait for network
echo "Waiting for network..."
for i in $(seq 1 30); do
  if ping -c1 91.98.144.84 >/dev/null 2>&1; then
    echo "Network ready"
    break
  fi
  sleep 2
done

# Install Node.js 18
echo "Installing Node.js..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js $(node -v)"

# Install Chromium + X11
echo "Installing Chromium + X11..."
apt-get update -qq
apt-get install -y -qq chromium-browser xserver-xorg x11-xserver-utils xinit openbox unclutter cec-utils

# Download player app from server
echo "Downloading player app..."
mkdir -p "$INSTALL_DIR/public" "$INSTALL_DIR/media"
curl -sSL "$SERVER_URL/player-download/package.json" -o "$INSTALL_DIR/package.json"
curl -sSL "$SERVER_URL/player-download/player.js" -o "$INSTALL_DIR/player.js"
curl -sSL "$SERVER_URL/player-download/public/index.html" -o "$INSTALL_DIR/public/index.html"

# Player config
cat > "$INSTALL_DIR/config.json" << CONF
{
  "serverUrl": "$SERVER_URL",
  "playerName": "$(hostname)",
  "localPort": 8000
}
CONF

# Install npm dependencies
cd "$INSTALL_DIR" && npm install --production
chown -R pi:pi "$INSTALL_DIR"

# Systemd service for Node.js player client
cat > /etc/systemd/system/mysignage-player.service << 'SVC'
[Unit]
Description=mySignage Player
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/mysignage
ExecStart=/usr/bin/node player.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable mysignage-player.service

# Chromium kiosk autostart via Openbox
mkdir -p /home/pi/.config/openbox
cat > /home/pi/.config/openbox/autostart << 'KIOSK'
xset s off
xset s noblank
xset -dpms
unclutter -idle 3 -root &
sleep 5
chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --start-fullscreen --autoplay-policy=no-user-gesture-required http://localhost:8000
KIOSK
chown -R pi:pi /home/pi/.config

# Auto-login on tty1
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/override.conf << 'AUTOLOGIN'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin pi --noclear %I $TERM
AUTOLOGIN

# Auto-start X on tty1 login
grep -q "startx" /home/pi/.bash_profile 2>/dev/null || cat >> /home/pi/.bash_profile << 'XSTART'

# mySignage - auto-start display
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx /usr/bin/openbox-session -- -nocursor
fi
XSTART
chown pi:pi /home/pi/.bash_profile

# GPU memory for video playback
grep -q "gpu_mem" /boot/firmware/config.txt 2>/dev/null || echo "gpu_mem=256" >> /boot/firmware/config.txt

# Disable swap (SD card life)
systemctl disable dphys-swapfile 2>/dev/null || true

# Timezone
timedatectl set-timezone Europe/Vienna 2>/dev/null || true

# Cleanup
rm -f /boot/firmware/firstrun.sh

echo "mySignage setup complete: $(date)"
reboot
