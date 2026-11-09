@echo off
rem PoorDown: doppio clic per accendere il gioco. Per spegnerlo chiudi questa finestra.
title PoorDown
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto senzanode
node scripts\avvia.js
if errorlevel 1 pause
exit /b

:senzanode
echo.
echo   Per giocare serve Node.js, che su questo PC manca.
echo   Si apre il sito: scarica la versione LTS, installala e poi riapri questo file.
echo.
start "" https://nodejs.org
pause
exit /b 1
