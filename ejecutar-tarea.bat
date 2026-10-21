@echo off
rem Ejecuta scripts\tarea-actual.cmd (preparado por Claude) y guarda la salida en scripts\tarea.log
cd /d "%~dp0"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
set LOG=%~dp0scripts\tarea.log
echo === INICIO %date% %time% === > "%LOG%"
call "%~dp0scripts\tarea-actual.cmd" >> "%LOG%" 2>&1
echo EXIT_TAREA=%errorlevel% >> "%LOG%"
echo === FIN %date% %time% === >> "%LOG%"
