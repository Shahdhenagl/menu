@echo off
REM ============================================================
REM  QZ Tray - Reset the blocked-sites list
REM  Use this when Block was clicked by mistake on the QZ prompt
REM  and printing stopped working.
REM
REM  Works on Windows 7 and later. Right-click > Run as administrator.
REM ============================================================

echo.
echo  ==========================================
echo   QZ Tray - Fix blocked printing
echo  ==========================================
echo.

echo  [1/4] Closing QZ Tray...
taskkill /F /IM "qz-tray.exe" >nul 2>&1
taskkill /F /IM "QZ Tray.exe" >nul 2>&1
REM QZ runs on the Java VM, so close any leftover instance too
wmic process where "CommandLine like '%%qz-tray%%' and Name like '%%java%%'" call terminate >nul 2>&1
timeout /t 3 /nobreak >nul
echo        done.
echo.

echo  [2/4] Clearing the blocked list...
if exist "%APPDATA%\qz\blocked.dat" (
    del /F /Q "%APPDATA%\qz\blocked.dat"
    echo        blocked.dat removed.
) else (
    echo        no blocked.dat found - nothing was blocked here.
)
echo.

echo  [3/4] Clearing the saved-decisions list...
if exist "%APPDATA%\qz\allowed.dat" (
    del /F /Q "%APPDATA%\qz\allowed.dat"
    echo        allowed.dat removed.
) else (
    echo        no allowed.dat found.
)
echo.

echo  [4/4] Starting QZ Tray again...
set "QZEXE="
if exist "%ProgramFiles%\QZ Tray\qz-tray.exe" set "QZEXE=%ProgramFiles%\QZ Tray\qz-tray.exe"
if exist "%ProgramFiles(x86)%\QZ Tray\qz-tray.exe" set "QZEXE=%ProgramFiles(x86)%\QZ Tray\qz-tray.exe"

if defined QZEXE (
    start "" "%QZEXE%"
    echo        started.
) else (
    echo        QZ Tray was not found in Program Files.
    echo        Start it manually from the Start menu.
)

echo.
echo  ==========================================
echo   Done. Now:
echo    1. Reload the POS page in the browser
echo    2. Print again
echo    3. On the QZ prompt click ALLOW  (not Block)
echo  ==========================================
echo.
pause
