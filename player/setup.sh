#!/bin/bash
# ─────────────────────────────────────────────────────────
# mySignage Player Setup Script
#
# Macht ein frisches Raspberry Pi OS zum Signage-Player.
#
# Nutzung (manuell):
#   curl -sSL http://<server>:3001/setup.sh | sudo bash -s http://<server>:3001
#
# Oder via cloud-init: prepare-sd.bat erstellt eine Config-Datei,
# firstboot.sh liest sie und ruft dieses Script mit der URL auf.
# ─────────────────────────────────────────────────────────

# Server-URL: Argument > Config-Datei > Fehler (CRLF-tolerant)
SERVER_URL="${1:-}"
if [ -z "$SERVER_URL" ] && [ -f /boot/firmware/mysignage-server.conf ]; then
  SERVER_URL=$(grep '^MYSIGNAGE_SERVER=' /boot/firmware/mysignage-server.conf | head -1 | sed 's/^MYSIGNAGE_SERVER=//' | tr -d '\r\n[:space:]')
fi
# Sicherheitshalber auch \r aus dem Argument entfernen
SERVER_URL=$(echo "$SERVER_URL" | tr -d '\r\n[:space:]')
if [ -z "$SERVER_URL" ]; then
  echo "FEHLER: Keine Server-URL angegeben!"
  echo "Nutzung: curl -sSL <url>/setup.sh | sudo bash -s <url>"
  exit 1
fi
INSTALL_DIR="/home/pi/mysignage"
NODE_VERSION="18"
PROGRESS_FILE="/tmp/mysignage-setup-progress"

# Track progress so we can resume after reboot
get_progress() {
  if [ -f "$PROGRESS_FILE" ]; then
    cat "$PROGRESS_FILE"
  else
    echo "0"
  fi
}

set_progress() {
  echo "$1" > "$PROGRESS_FILE"
}

STEP=$(get_progress)

echo ""
echo "======================================"
echo "  mySignage Player Setup (ab Schritt $STEP)"
echo "  Server: $SERVER_URL"
echo "======================================"
echo ""

# ─── 1. System Update ────────────────────────────────────
if [ "$STEP" -lt 1 ]; then
  echo "[1/7] System update..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get upgrade -y -qq -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" || true
  echo "  System update fertig"
  set_progress 1
fi

# ─── 2. Install Node.js 18 ───────────────────────────────
if [ "$STEP" -lt 2 ]; then
  echo "[2/7] Node.js ${NODE_VERSION} installieren..."
  if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
  fi
  echo "  Node.js $(node -v) installiert"
  set_progress 2
fi

# ─── 3. Install Chromium + dependencies ──────────────────
if [ "$STEP" -lt 3 ]; then
  echo "[3/7] Chromium installieren..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -qq chromium unclutter || true
  echo "  Chromium installiert"
  set_progress 3
fi

# ─── 4. Install CEC tools (TV control) ───────────────────
if [ "$STEP" -lt 4 ]; then
  echo "[4/7] CEC-Tools installieren..."
  apt-get install -y -qq cec-utils || true
  echo "  CEC-Tools installiert"
  set_progress 4
fi

# ─── 5. Setup Player App ─────────────────────────────────
if [ "$STEP" -lt 5 ]; then
  echo "[5/7] Player-App einrichten..."
  mkdir -p "$INSTALL_DIR"

  # Download player files from server
  curl -sSL "${SERVER_URL}/player-download/package.json" -o "${INSTALL_DIR}/package.json"
  curl -sSL "${SERVER_URL}/player-download/player.js" -o "${INSTALL_DIR}/player.js"
  mkdir -p "${INSTALL_DIR}/public"
  curl -sSL "${SERVER_URL}/player-download/public/index.html" -o "${INSTALL_DIR}/public/index.html"
  mkdir -p "${INSTALL_DIR}/media"

  # Write config
  cat > "${INSTALL_DIR}/config.json" << EOF
{
  "serverUrl": "${SERVER_URL}",
  "playerName": "$(hostname)",
  "localPort": 8000
}
EOF

  # Install npm dependencies
  cd "$INSTALL_DIR"
  npm install --production

  chown -R pi:pi "$INSTALL_DIR"
  echo "  Player-App eingerichtet"
  set_progress 5
fi

# ─── 6. Setup Autostart ──────────────────────────────────
if [ "$STEP" -lt 6 ]; then
  echo "[6/7] Autostart konfigurieren..."

  # Systemd service for the Node.js player client
  cat > /etc/systemd/system/mysignage-player.service << EOF
[Unit]
Description=mySignage Player Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node player.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable mysignage-player.service
  systemctl start mysignage-player.service

  # Clean up any old autostart files
  rm -f /home/pi/.config/autostart/mysignage-kiosk.desktop 2>/dev/null

  # labwc autostart — runs inside the Wayland session on boot
  mkdir -p /home/pi/.config/labwc
  cat > /home/pi/.config/labwc/autostart << 'EOF'
# mySignage Kiosk — launched by labwc at session start
/home/pi/mysignage/start-kiosk.sh &
EOF

  # Kiosk start script (uses Xwayland display :0 inside labwc)
  cat > /home/pi/mysignage/start-kiosk.sh << 'EOFKIOSK'
#!/bin/bash
# Wait for player local server to be ready
for i in $(seq 1 30); do
  curl -s http://localhost:8000 > /dev/null && break
  sleep 1
done

# Hide cursor
unclutter -idle 0 &

# Kill any old Chromium instances
pkill -f 'chromium.*kiosk' 2>/dev/null
sleep 1

# Start Chromium via Xwayland (DISPLAY=:0 provided by labwc)
export DISPLAY=:0
exec chromium \
  --kiosk \
  --password-store=basic \
  --use-mock-keychain \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --no-first-run \
  --start-fullscreen \
  --lang=de \
  --disable-features=TranslateUI \
  --disable-component-update \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  http://localhost:8000
EOFKIOSK
  chmod +x /home/pi/mysignage/start-kiosk.sh

  # ─── Chromium Preferences (pre-configure to avoid popups) ───
  CHROME_DIR="/home/pi/.config/chromium"
  mkdir -p "$CHROME_DIR/Default"
  cat > "$CHROME_DIR/Default/Preferences" << 'PREFS'
{
  "translate_blocked_languages": ["de","en"],
  "translate": {"enabled": false},
  "browser": {"enable_spellchecking": false, "check_default_browser": false},
  "intl": {"accept_languages": "de,en"},
  "credentials_enable_service": false,
  "credentials_enable_autosignin": false
}
PREFS
  cat > "$CHROME_DIR/First Run" << 'EOF'
EOF
  cat > "$CHROME_DIR/Local State" << 'LOCALSTATE'
{
  "browser": {"enabled_labs_experiments": []},
  "dns_over_https": {"mode": "off"},
  "hardware_acceleration_mode": {"enabled": true}
}
LOCALSTATE

  # ─── Disable GNOME Keyring completely ───
  apt-get remove -y gnome-keyring 2>/dev/null || true
  systemctl --user mask gnome-keyring-daemon.service 2>/dev/null || true
  mkdir -p /home/pi/.config/autostart
  for svc in gnome-keyring-ssh gnome-keyring-secrets gnome-keyring-pkcs11; do
    cat > "/home/pi/.config/autostart/${svc}.desktop" << EOF2
[Desktop Entry]
Type=Application
Hidden=true
EOF2
  done

  # Fix all ownership
  chown -R pi:pi /home/pi/.config /home/pi/.local 2>/dev/null || true
  chown -R pi:pi /home/pi/mysignage

  # Auto-login to desktop (labwc session)
  raspi-config nonint do_boot_behaviour B4 2>/dev/null || true

  # Remove any old .bash_profile X11 autostart
  sed -i '/startx\|xinit\|openbox/d' /home/pi/.bash_profile 2>/dev/null || true

  echo "  Autostart konfiguriert"
  set_progress 6
fi

# ─── 7. Optimize for Signage ─────────────────────────────
if [ "$STEP" -lt 7 ]; then
  echo "[7/7] System optimieren..."

  # Find the correct config.txt path (newer Pi OS uses /boot/firmware/)
  BOOT_CONFIG="/boot/config.txt"
  [ -f /boot/firmware/config.txt ] && BOOT_CONFIG="/boot/firmware/config.txt"

  # Increase GPU memory for video playback
  if ! grep -q "gpu_mem" "$BOOT_CONFIG" 2>/dev/null; then
    echo "gpu_mem=256" >> "$BOOT_CONFIG"
  fi

  # Disable Bluetooth (saves power, reduces interference)
  if ! grep -q "dtoverlay=disable-bt" "$BOOT_CONFIG" 2>/dev/null; then
    echo "dtoverlay=disable-bt" >> "$BOOT_CONFIG"
  fi

  # Disable swap (extend SD card life)
  systemctl disable dphys-swapfile 2>/dev/null || true

  # Set timezone
  timedatectl set-timezone Europe/Vienna 2>/dev/null || true

  # ─── Disable Raspbian Update Popups / Notifications ───
  # Disable PackageKit (Software Center update checks)
  systemctl disable packagekit 2>/dev/null || true
  systemctl mask packagekit 2>/dev/null || true

  # Disable apt-daily update timers
  systemctl disable apt-daily.timer 2>/dev/null || true
  systemctl disable apt-daily-upgrade.timer 2>/dev/null || true
  systemctl mask apt-daily.timer 2>/dev/null || true
  systemctl mask apt-daily-upgrade.timer 2>/dev/null || true

  # Remove update notifier / welcome wizard if installed
  apt-get remove -y update-notifier rpd-plym-splash piwiz 2>/dev/null || true

  # Disable lxplug-updater (LXDE panel update plugin)
  rm -f /etc/xdg/autostart/lxplug-updater.desktop 2>/dev/null || true
  mkdir -p /home/pi/.config/autostart
  cat > /home/pi/.config/autostart/lxplug-updater.desktop << 'UPDEOF'
[Desktop Entry]
Type=Application
Hidden=true
UPDEOF

  # Disable LXDE/Pixel notifications
  rm -f /etc/xdg/autostart/pprompt.desktop 2>/dev/null || true

  chown -R pi:pi /home/pi/.config 2>/dev/null || true

  echo "  System optimiert"
  set_progress 7
fi

# ─── Done ─────────────────────────────────────────────────
# Clean up progress file
rm -f "$PROGRESS_FILE"

echo ""
echo "======================================"
echo "  Setup complete!"
echo "  Server: ${SERVER_URL}"
echo "  Player: $(hostname)"
echo "======================================"

# Only reboot if run directly (not from firstboot script)
if [ -z "$MYSIGNAGE_NO_REBOOT" ]; then
  echo "Rebooting in 5 seconds..."
  sleep 5
  reboot
else
  echo "Skipping reboot (will be done by firstboot script)"
fi
