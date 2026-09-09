@echo off
REM  Dublu-click. Exista pentru ca cmd.exe deschide fisierele .ps1 cu Notepad
REM  in loc sa le execute.

setlocal
cd /d "%~dp0"

echo.
echo   De ce difera numarul de meciuri fata de alte site-uri?
echo   Desparte meciurile pe mod de joc si compara CS2 cu CS:GO.
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
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-match-count.ps1" -ApiKey "%KEY%" %*

echo.
pause
endlocal
