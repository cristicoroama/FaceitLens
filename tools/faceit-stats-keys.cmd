@echo off
REM  Dublu-click pe acest fisier, sau ruleaza-l din cmd.
REM
REM  Exista pentru ca cmd.exe nu executa fisiere .ps1 — le deschide cu
REM  programul asociat, care e Notepad. Asta le trimite la PowerShell asa cum
REM  trebuie si tine fereastra deschisa ca sa apuci sa citesti raspunsul.

setlocal
cd /d "%~dp0"

echo.
echo   Cheia de API FACEIT (din developers.faceit.com, aplicatia ta)
echo.
set /p KEY=  Lipeste cheia si apasa Enter:

if "%KEY%"=="" (
  echo.
  echo   N-ai pus nicio cheie. Iesim.
  echo.
  pause
  exit /b 1
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-stats-keys.ps1" -ApiKey "%KEY%" %*

echo.
pause
endlocal
