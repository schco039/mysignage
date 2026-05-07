@echo off
echo.
echo  ======================================
echo   mySignage SD-Karte vorbereiten
echo  ======================================
echo.

REM Finde Boot-Partition
set "DRIVE="
for %%d in (D E F G H I J K L M) do (
    if exist "%%d:\cmdline.txt" set "DRIVE=%%d:"
)

if "%DRIVE%"=="" (
    echo  [FEHLER] Keine SD-Karte gefunden!
    echo  Bitte zuerst mit Raspberry Pi Imager flashen.
    echo  SD-Karte muss eingesteckt bleiben.
    echo.
    pause
    exit /b 1
)

echo  [OK] Boot-Partition: %DRIVE%

REM Kopiere das Install-Script auf Boot-Partition
copy "%~dp0mysignage-firstboot.sh" "%DRIVE%\mysignage-firstboot.sh" >nul
echo  [OK] mysignage-firstboot.sh kopiert

REM Pruefe ob cloud-init (user-data) oder firstrun.sh
if exist "%DRIVE%\user-data" goto :cloudinit
if exist "%DRIVE%\firstrun.sh" goto :firstrun
echo  [FEHLER] Weder user-data noch firstrun.sh gefunden!
echo  Bitte Pi Imager nutzen mit SSH + WiFi + User pi
echo.
pause
exit /b 1

:cloudinit
echo  [OK] cloud-init erkannt (user-data)

REM Pruefe ob runcmd: schon in user-data existiert
findstr /b /c:"runcmd:" "%DRIVE%\user-data" >nul 2>&1
if %errorlevel%==0 goto :cloudinit_append

REM Kein runcmd vorhanden — neuen Block anfuegen
>> "%DRIVE%\user-data" echo.
>> "%DRIVE%\user-data" echo runcmd:
>> "%DRIVE%\user-data" echo   - chmod +x /boot/firmware/mysignage-firstboot.sh
>> "%DRIVE%\user-data" echo   - /bin/bash /boot/firmware/mysignage-firstboot.sh
echo  [OK] user-data: runcmd Block hinzugefuegt
goto :done

:cloudinit_append
REM runcmd existiert bereits — unsere Eintraege sicher einfuegen via PowerShell
REM (Batch for /f zerstoert Leerzeilen und Sonderzeichen in YAML)
powershell -Command "$f='%DRIVE%\user-data'; $c=(Get-Content $f -Raw); $insert=\"  - chmod +x /boot/firmware/mysignage-firstboot.sh`n  - /bin/bash /boot/firmware/mysignage-firstboot.sh`n\"; $c=$c -replace '(?m)^(runcmd:\s*\n)', \"`$1$insert\"; [IO.File]::WriteAllText($f, $c)"
echo  [OK] user-data: Eintraege an bestehendes runcmd angefuegt
goto :done

:firstrun
echo  [OK] firstrun.sh erkannt
>> "%DRIVE%\firstrun.sh" (
    echo.
    echo # --- mySignage Auto-Setup ---
    echo chmod +x /boot/firmware/mysignage-firstboot.sh 2^>/dev/null
    echo SCRIPT_PATH="/boot/firmware/mysignage-firstboot.sh"
    echo cat ^> /etc/systemd/system/mysignage-firstboot.service ^<^< SVCEOF
    echo [Unit]
    echo Description=mySignage Auto Setup
    echo After=network-online.target
    echo Wants=network-online.target
    echo [Service]
    echo Type=oneshot
    echo ExecStart=/bin/bash $SCRIPT_PATH
    echo TimeoutStartSec=900
    echo [Install]
    echo WantedBy=multi-user.target
    echo SVCEOF
    echo systemctl daemon-reload
    echo systemctl enable mysignage-firstboot.service
)
echo  [OK] firstrun.sh ergaenzt
goto :done

:done

echo.
echo  ======================================
echo   FERTIG! SD-Karte ist bereit.
echo.
echo   1. SD-Karte sicher auswerfen
echo   2. In Raspberry Pi stecken
echo   3. Strom dran - ca. 10 Min warten
echo   4. Player erscheint automatisch im
echo      Dashboard: http://91.98.144.84:3001
echo  ======================================
echo.
pause
