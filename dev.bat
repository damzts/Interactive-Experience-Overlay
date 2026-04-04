@echo off
:: dev.bat — manage IEOM dev services (Windows)
:: Usage: dev.bat [start|stop|restart]  (default: restart)

set CMD=%1
if "%CMD%"=="" set CMD=restart

if "%CMD%"=="stop" goto :stop
if "%CMD%"=="start" goto :start
if "%CMD%"=="restart" goto :restart

echo Usage: dev.bat [start^|stop^|restart]
exit /b 1

:stop
echo ^> Stopping processes on ports 3000, 3001, and 3002...
for %%P in (3000 3001 3002) do (
    for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        echo   killing port %%P (pid: %%i)
        taskkill /PID %%i /F >nul 2>&1
    )
)
echo ^> Stopped.
goto :eof

:start
echo ^> Starting IEOM dev (server :3000 ^| view :3001 ^| app :3002)...
cd /d "%~dp0"
pnpm dev
goto :eof

:restart
call :stop
goto :start
