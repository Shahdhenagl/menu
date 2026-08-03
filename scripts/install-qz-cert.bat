@echo off
REM ============================================================
REM  QZ Tray - Trust the Meridien POS certificate
REM
REM  Installs override.crt into the QZ Tray folder so print jobs
REM  from the POS are allowed automatically - no prompt, ever.
REM
REM  HOW TO USE:
REM    Keep override.crt in the SAME folder as this file,
REM    then right-click this file > Run as administrator.
REM ============================================================

echo.
echo  ==========================================
echo   QZ Tray - Install trusted certificate
echo  ==========================================
echo.

REM --- make sure the certificate is next to this script ---
if not exist "%~dp0override.crt" (
    echo  ERROR: override.crt was not found next to this file.
    echo         Copy override.crt into:
    echo         %~dp0
    echo.
    pause
    exit /b 1
)

REM --- locate the QZ Tray installation ---
set "QZDIR="
if exist "%ProgramFiles%\QZ Tray\" set "QZDIR=%ProgramFiles%\QZ Tray"
if exist "%ProgramFiles(x86)%\QZ Tray\" set "QZDIR=%ProgramFiles(x86)%\QZ Tray"

if not defined QZDIR (
    echo  ERROR: QZ Tray is not installed on this machine.
    echo         Install QZ Tray first, then run this file again.
    echo.
    pause
    exit /b 1
)

echo  QZ Tray found at:
echo    %QZDIR%
echo.

echo  [1/3] Closing QZ Tray...
taskkill /F /IM "qz-tray.exe" >nul 2>&1
taskkill /F /IM "QZ Tray.exe" >nul 2>&1
timeout /t 3 /nobreak >nul
echo        done.
echo.

echo  [2/3] Installing the certificate...
copy /Y "%~dp0override.crt" "%QZDIR%\override.crt" >nul
if errorlevel 1 (
    echo        FAILED. Did you run this file as administrator?
    echo.
    pause
    exit /b 1
)
echo        override.crt installed.

REM --- clear any stale allow/block decisions so the new cert takes over ---
if exist "%APPDATA%\qz\blocked.dat" del /F /Q "%APPDATA%\qz\blocked.dat" >nul 2>&1
if exist "%APPDATA%\qz\allowed.dat" del /F /Q "%APPDATA%\qz\allowed.dat" >nul 2>&1
echo        old allow/block lists cleared.
echo.

echo  [3/3] Starting QZ Tray again...
if exist "%QZDIR%\qz-tray.exe" (
    start "" "%QZDIR%\qz-tray.exe"
    echo        started.
) else (
    echo        Start QZ Tray manually from the Start menu.
)

echo.
echo  ==========================================
echo   Done.
echo   Open the POS page and print - it should
echo   print straight away with no prompt.
echo  ==========================================
echo.
pause
