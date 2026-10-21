@echo off
rem Arranca La Roda City en este equipo:
rem   - ventana "servidor": servidor multijugador (puerto 2567)
rem   - esta ventana: el juego en http://localhost:5173
rem Para jugar desde el movil en la misma Wi-Fi, usa la direccion "Network" que aparece abajo.
rem Para pararlo todo, cierra las dos ventanas.
cd /d "%~dp0"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if not exist node_modules call npm install
if not exist scripts mkdir scripts
start "La Roda City - servidor" powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run server:dev 2>&1 | Tee-Object -FilePath scripts\servidor.log"
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev -- --port 5173 --strictPort 2>&1 | Tee-Object -FilePath scripts\dev-server.log"
pause
