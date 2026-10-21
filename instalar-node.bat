@echo off
rem Descarga Node.js LTS oficial, verifica su huella SHA-256 e instala con opciones por defecto.
cd /d "%~dp0"
set LOG=%~dp0instalacion-node.log
set VER=v24.22.0
set MSI=%USERPROFILE%\Downloads\node-%VER%-x64.msi
set SHA=97ebad47ad35da4b59182a5fbe9fad2b1a1836f1042b4833ff5b4b9571175088
echo === Instalacion Node.js %VER% %date% %time% === > "%LOG%"
echo Descargando Node.js %VER% (33 MB)...
curl.exe -L --fail -o "%MSI%" https://nodejs.org/dist/%VER%/node-%VER%-x64.msi >> "%LOG%" 2>&1
if errorlevel 1 ( echo DESCARGA_FALLIDA >> "%LOG%" & echo La descarga ha fallado. & pause & exit /b 1 )
certutil -hashfile "%MSI%" SHA256 > "%TEMP%\nodehash.txt" 2>&1
findstr /i "%SHA%" "%TEMP%\nodehash.txt" >nul
if errorlevel 1 ( echo HUELLA_INCORRECTA >> "%LOG%" & type "%TEMP%\nodehash.txt" >> "%LOG%" & del "%MSI%" & echo El archivo no coincide con el oficial; no se instala. & pause & exit /b 1 )
echo HUELLA_OK >> "%LOG%"
echo.
echo Instalando... Si Windows pregunta "Quieres permitir que esta aplicacion haga cambios", pulsa SI.
msiexec /i "%MSI%" /passive /norestart
echo EXIT_MSI=%errorlevel% >> "%LOG%"
if exist "%ProgramFiles%\nodejs\node.exe" ( echo NODE_INSTALADO >> "%LOG%" & "%ProgramFiles%\nodejs\node.exe" -v >> "%LOG%" 2>&1 ) else ( echo NODE_NO_ENCONTRADO >> "%LOG%" )
echo === FIN === >> "%LOG%"
