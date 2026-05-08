@echo off
setlocal enabledelayedexpansion

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
echo.

REM Server-Adresse abfragen
:askserver
set "SERVER_HOST="
set /p "SERVER_HOST=  Server-Adresse (IP oder Hostname): "
if "!SERVER_HOST!"=="" (
    echo  [FEHLER] Server-Adresse darf nicht leer sein.
    goto :askserver
)

REM Port abfragen (Default 3001)
set "SERVER_PORT=3001"
set /p "SERVER_PORT=  Port [3001]: "
if "!SERVER_PORT!"=="" set "SERVER_PORT=3001"

set "SERVER_URL=http://!SERVER_HOST!:!SERVER_PORT!"
echo.
echo  Server-URL: !SERVER_URL!
echo.

REM Server-Config auf Boot-Partition schreiben
> "%DRIVE%\mysignage-server.conf" echo MYSIGNAGE_SERVER=!SERVER_URL!
echo  [OK] mysignage-server.conf geschrieben

REM Install-Script auf Boot-Partition kopieren
copy "%~dp0mysignage-firstboot.sh" "%DRIVE%\mysignage-firstboot.sh" >nul
echo  [OK] mysignage-firstboot.sh kopiert

REM cloud-init oder firstrun.sh
if exist "%DRIVE%\user-data" goto :cloudinit
if exist "%DRIVE%\firstrun.sh" goto :firstrun
echo  [FEHLER] Weder user-data noch firstrun.sh gefunden!
echo  Bitte Pi Imager nutzen mit SSH + WiFi + User pi
echo.
pause
exit /b 1

:cloudinit
echo  [OK] cloud-init erkannt (user-data)

findstr /b /c:"runcmd:" "%DRIVE%\user-data" >nul 2>&1
if %errorlevel%==0 goto :cloudinit_append

>> "%DRIVE%\user-data" echo.
>> "%DRIVE%\user-data" echo runcmd:
>> "%DRIVE%\user-data" echo   - chmod +x /boot/firmware/mysignage-firstboot.sh
>> "%DRIVE%\user-data" echo   - /bin/bash /boot/firmware/mysignage-firstboot.sh
echo  [OK] user-data: runcmd Block hinzugefuegt
goto :done

:cloudinit_append
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
echo   Server: !SERVER_URL!
echo.
echo   1. SD-Karte sicher auswerfen
echo   2. In Raspberry Pi stecken
echo   3. Strom dran - ca. 10 Min warten
echo   4. Player erscheint im Dashboard:
echo      !SERVER_URL!
echo  ======================================
echo.
pause
endlocal
