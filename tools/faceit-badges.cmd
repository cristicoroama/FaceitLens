@echo off
REM  Dublu-click. Exista pentru ca cmd.exe deschide fisierele .ps1 cu Notepad
REM  in loc sa le execute.

setlocal
cd /d "%~dp0"

echo.
echo   Cauta badge-urile de profil in API-ul intern FACEIT.
echo   Nu cere cheie de API. Dureaza cateva secunde.
echo.

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-badges.ps1" %*

echo.
pause
endlocal
