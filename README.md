# mySignage

Digital Signage System — Server + Raspberry Pi Player

---

## Server installieren

Voraussetzungen: Frischer Debian-Server (12 oder 13), root-Zugang.

```bash
curl -sSL https://raw.githubusercontent.com/schco039/mysignage/main/server-install.sh | bash
```

Das Script installiert automatisch: Node.js 18, MongoDB 8.0, ffmpeg, pm2 — klont das Repo, baut den Client und startet alles.

Nach der Installation:

- **Admin UI:** `https://<server-ip>:3443` (self-signed Zertifikat, beim ersten Aufruf akzeptieren)
- **Player-Verbindung:** `http://<server-ip>:3001` (HTTP für Player, von HTTPS-Redirect ausgenommen)

Erster Login: **admin / admin** (Passwort muss beim ersten Login geändert werden)

> HTTP-Aufrufe der Admin-UI werden automatisch nach HTTPS umgeleitet.
> Player-Pfade (`/sync_folders`, `/socket.io`, `/setup.sh` etc.) bleiben über HTTP erreichbar.

---

## Raspberry Pi installieren (unattended)

### Voraussetzung
Der Server muss laufen und erreichbar sein.

### Schritt 1 — SD-Karte flashen

Mit **Raspberry Pi Imager** flashen:
- OS: **Raspberry Pi OS Desktop (64-bit)**
- Einstellungen (Zahnrad):
  - Hostname setzen
  - User: `pi` mit Passwort
  - WLAN konfigurieren
  - SSH aktivieren

### Schritt 2 — SD-Karte vorbereiten

Lade beide Dateien in den **selben Ordner** auf dem Windows-PC:

- [prepare-sd.bat](https://raw.githubusercontent.com/schco039/mysignage/main/player/prepare-sd.bat)
- [mysignage-firstboot.sh](https://raw.githubusercontent.com/schco039/mysignage/main/player/mysignage-firstboot.sh)

SD-Karte **eingesteckt lassen**, dann `prepare-sd.bat` doppelklicken.

Das Script:
- fragt nach Server-Adresse und Port (Default 3001)
- findet die SD-Karte automatisch
- kopiert das Setup-Script + Config drauf
- trägt es in cloud-init Autostart ein

### Schritt 3 — Pi booten

1. SD-Karte sicher auswerfen
2. In den Raspberry Pi stecken
3. Strom anschließen
4. Ca. 10 Minuten warten

Auf dem angeschlossenen Bildschirm ist der Fortschritt sichtbar:
```
[1/4] Warte auf Netzwerk...
[2/4] Warte auf apt...
[3/4] Starte mySignage Setup...
  [1/7] System update...
  [2/7] Node.js installieren...
  ...
  [7/7] System optimieren...
[4/4] Setup abgeschlossen!
```

Nach dem automatischen Neustart erscheint der Player im Dashboard und zeigt den Default-Screen.

---

---

## Intel NUC / x86-PC als Player installieren

Alternative zum Raspberry Pi — gleiche Software, gleiche Bedienung.

### Schritt 1 — Debian installieren

**Debian 12 oder 13** vom USB-Stick installieren. Bei der Software-Auswahl:

- **Keine** Desktop-Umgebung ankreuzen
- **SSH-Server** und **Standard-Systemwerkzeuge** ankreuzen

Das Setup-Script installiert die Wayland-Session (labwc) selbst. Eine
mitinstallierte Desktop-Umgebung wie GNOME wuerde damit kollidieren.

### Schritt 2 — Setup-Script ausfuehren

SSH auf den NUC, dann:

```bash
curl -sSL http://<server>:3001/setup.sh | sudo bash -s http://<server>:3001
```

Das Script erkennt die Plattform automatisch und installiert den x86-Zweig:
labwc, lightdm, Chromium und den Player-Service. Nach dem Neustart erscheint
der NUC im Dashboard wie ein Pi.

### Unterschiede zum Pi

| | Raspberry Pi | Intel NUC |
|---|---|---|
| Player-ID | CPU-Serial aus `/proc/cpuinfo` | `/etc/machine-id` |
| TV-Sleep | `wlopm` über labwc | identisch (labwc wird mitinstalliert) |
| CEC | nicht genutzt | nicht verfügbar |
| Boot-Tuning | `gpu_mem`, Bluetooth aus, Swap aus | entfällt |
| Installation | SD-Karte vorbereiten oder SSH | nur SSH |

> **TV-Sleep prüfen:** Nach der Installation testen, ob der Bildschirm zur
> eingestellten Zeit ausgeht. Falls nicht, zeigt `journalctl -u mysignage-player`
> welche Methode gegriffen hat — der Player loggt sie beim ersten Schaltvorgang.

## Manuelle Pi-Installation (ohne SD-Karte vorbereiten)

SSH auf den Pi, dann:

```bash
curl -sSL http://<server>:3001/setup.sh | sudo bash -s http://<server>:3001
```

## Pi: Fortschritt überwachen

Während `prepare-sd.bat` läuft, kannst du dich per SSH auf den Pi einloggen und den Live-Fortschritt mitverfolgen:

```bash
ssh pi@<pi-ip>
sudo tail -f /var/log/mysignage-setup.log
```

Falls noch nichts im Log steht (cloud-init läuft noch nicht):
```bash
sudo journalctl -u cloud-init -f
```

Aktuellen Setup-Schritt anzeigen (0–7):
```bash
cat /tmp/mysignage-setup-progress
```

---

## Nützliche Befehle (Server)

```bash
pm2 status                        # Status anzeigen
pm2 logs mysignage                # Live-Logs
pm2 restart mysignage             # Server neu starten
```
