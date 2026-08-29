@echo off
REM  Dublu-click. Exista pentru ca cmd.exe deschide fisierele .ps1 cu Notepad
REM  in loc sa le execute.

setlocal
cd /d "%~dp0"

echo.
echo   Verifica ce conturi legate expune FACEIT pentru cativa jucatori.
echo   Raspunde la intrebarea: apare Twitch in `platforms` sau nu?
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
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-player-platforms.ps1" -ApiKey "%KEY%" %*

echo.
pause
endlocal
