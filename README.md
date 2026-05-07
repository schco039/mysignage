# mySignage

Digital Signage System — Server + Raspberry Pi Player

---

## Server installieren

Voraussetzungen: Frischer Debian-Server (12 oder 13), root-Zugang.

```bash
curl -sSL https://raw.githubusercontent.com/schco039/mysignage/main/server-install.sh | bash
```

Das Script installiert automatisch: Node.js 18, MongoDB 8.0, ffmpeg, pm2 — klont das Repo, baut den Client und startet alles.

Nach der Installation erreichbar unter: `http://<server-ip>:3001`  
Erster Login: **admin / admin** (bitte sofort ändern)

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

SD-Karte **eingesteckt lassen**, dann auf dem Windows-PC ausführen:

```
player\prepare-sd.bat
```

Das Script findet die SD-Karte automatisch, kopiert das Setup-Script drauf und trägt es in den Autostart ein.

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

## Manuelle Pi-Installation (ohne SD-Karte vorbereiten)

SSH auf den Pi, dann:

```bash
curl -sSL http://<server-ip>:3001/setup.sh | sudo bash
```

---

## Nützliche Befehle (Server)

```bash
pm2 status                        # Status anzeigen
pm2 logs mysignage                # Live-Logs
pm2 restart mysignage             # Server neu starten
```
