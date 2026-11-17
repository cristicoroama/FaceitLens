@echo off
REM  Dublu-click. Ruleaza-l CAT TIMP jucatorul e in meci.

setlocal
cd /d "%~dp0"

echo.
echo   Verifica de ce nu apare "Playing now" pentru un jucator aflat in meci.
echo   Ruleaza-l acum, cat timp meciul e in desfasurare.
echo.
set /p KEY=  Cheia de API FACEIT:
set /p NICK=  Nickname-ul jucatorului care e in meci:
set /p BACK=  URL backend Render (Enter ca sa sari peste):

if "%KEY%"=="" ( echo   Lipseste cheia. & pause & exit /b 1 )
if "%NICK%"=="" ( echo   Lipseste nickname-ul. & pause & exit /b 1 )

echo.
if "%BACK%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-live.ps1" -ApiKey "%KEY%" -Nickname "%NICK%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0faceit-live.ps1" -ApiKey "%KEY%" -Nickname "%NICK%" -Backend "%BACK%"
)

echo.
pause
endlocal
