@echo off
rem Instala dependencias, compila y deja el resultado en comprobacion.log
cd /d "%~dp0"
set LOG=comprobacion.log
echo === Comprobacion La Roda City %date% %time% === > %LOG%
rem Si Node.js esta instalado pero no en el PATH, lo buscamos en las rutas habituales
where node >nul 2>&1 || (
  for %%D in ("%ProgramFiles%\nodejs" "%ProgramFiles(x86)%\nodejs" "%LOCALAPPDATA%\Programs\nodejs" "%APPDATA%\nvm" "%LOCALAPPDATA%\Volta\bin") do (
    if exist "%%~D\node.exe" set "PATH=%%~D;%PATH%"
  )
)
echo --- node -v >> %LOG%
where node >> %LOG% 2>&1
if errorlevel 1 (
  echo NODE_NO_INSTALADO >> %LOG%
  dir /b "%ProgramFiles%" >> %LOG% 2>&1
  echo === FIN === >> %LOG%
  echo.
  echo Node.js no esta instalado. Descargalo de https://nodejs.org (version LTS^) y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
node -v >> %LOG% 2>&1
echo --- npm -v >> %LOG%
call npm -v >> %LOG% 2>&1
echo --- npm install >> %LOG%
call npm install >> %LOG% 2>&1
echo EXIT_INSTALL=%errorlevel% >> %LOG%
echo --- npm run build >> %LOG%
call npm run build >> %LOG% 2>&1
echo EXIT_BUILD=%errorlevel% >> %LOG%
echo === FIN === >> %LOG%
type %LOG%
pause
