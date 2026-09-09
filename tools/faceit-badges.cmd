@echo off
REM  Dublu-click. Exista pentru ca cmd.exe deschide fisierele .ps1 cu Notepad
REM  in loc sa le execute.

setlocal
cd /d "%~dp0"

echo.
echo   Verifica daca badge-urile de pe profilul FACEIT vin prin API.
echo   Testeaza: chei nedocumentate, endpoint dedicat, sau huburi.
echo.
set /p KEY=  Lipeste cheia de API si apasa Enter:

if "%KEY%"=="" (
  echo.
  echo   N-ai pus nicio cheie. Iesim.
  echo.
  pause
  exit /b 1
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-badges.ps1" -ApiKey "%KEY%" %*

echo.
pause
endlocal
