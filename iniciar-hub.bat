@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Meu Hub

set "HUB_URL=http://127.0.0.1:5757"
set "HUB_PORT=5757"
set "BUILD=build\index.js"
set "SERVER_TITLE=Meu Hub - servidor"

where node >nul 2>&1
if errorlevel 1 (
	echo.
	echo [ERRO] Node.js nao encontrado no PATH.
	echo Instale o Node.js 24 ou superior em https://nodejs.org e abra este arquivo de novo.
	pause
	exit /b 1
)

set "NODE_MAJOR="
for /f "tokens=1 delims=." %%v in ('node --version') do set "NODE_MAJOR=%%v"
set "NODE_MAJOR=%NODE_MAJOR:v=%"
if not defined NODE_MAJOR goto node_ok
if %NODE_MAJOR% LSS 24 (
	echo.
	echo [ERRO] Node %NODE_MAJOR% encontrado. O Meu Hub exige Node 24 ou superior.
	pause
	exit /b 1
)
:node_ok

if exist "%BUILD%" goto main_menu

echo.
echo O build do hub nao foi encontrado em "%BUILD%".
choice /c SN /n /m "Rodar npm run build agora? [S/N] "
if errorlevel 2 goto missing_build
call :run_build
if errorlevel 1 (
	echo.
	pause
	exit /b 1
)
goto main_menu

:missing_build
echo.
echo Rode "npm run build" nesta pasta antes de iniciar o servidor.
pause
exit /b 1

:main_menu
cls
echo ============================================
echo   Meu Hub  -  %HUB_URL%
echo ============================================
echo.
echo   1^) Iniciar servidor
echo   2^) Abrir o hub no navegador
echo   3^) Iniciar e abrir
echo   4^) Recompilar ^(npm run build^)
echo   0^) Sair
echo.
choice /c 12340 /n /m "Escolha uma opcao: "
if errorlevel 5 goto quit
if errorlevel 4 goto rebuild
if errorlevel 3 goto start_and_open
if errorlevel 2 goto open_hub
if errorlevel 1 goto start_server
goto main_menu

:start_server
call :is_running
if "%HUB_RUNNING%"=="1" (
	echo.
	echo O servidor ja esta rodando em %HUB_URL%.
	timeout /t 2 /nobreak >nul 2>&1
	goto main_menu
)
call :start_server_process
echo.
echo Servidor iniciado em uma janela separada.
echo Para parar, feche a janela "%SERVER_TITLE%" ou pressione Ctrl+C nela.
timeout /t 3 /nobreak >nul 2>&1
goto main_menu

:open_hub
call :is_running
if "%HUB_RUNNING%"=="1" (
	echo.
	echo Abrindo %HUB_URL% ...
	start "" "%HUB_URL%"
	timeout /t 2 /nobreak >nul 2>&1
	goto main_menu
)
echo.
echo O servidor nao esta rodando.
choice /c SN /n /m "Iniciar o servidor e abrir agora? [S/N] "
if errorlevel 2 goto main_menu
goto start_and_open

:start_and_open
call :is_running
if "%HUB_RUNNING%"=="1" (
	echo.
	echo O servidor ja esta rodando. Abrindo o navegador...
	start "" "%HUB_URL%"
	timeout /t 2 /nobreak >nul 2>&1
	goto main_menu
)
call :start_server_process
echo.
echo Iniciando o servidor, aguarde...
call :wait_for_server
if not errorlevel 1 (
	start "" "%HUB_URL%"
	echo Hub aberto no navegador.
	timeout /t 2 /nobreak >nul 2>&1
	goto main_menu
)
echo.
echo [AVISO] O servidor nao respondeu em 20 segundos.
echo Veja a janela "%SERVER_TITLE%" para a mensagem de erro.
pause
goto main_menu

:rebuild
call :is_running
if "%HUB_RUNNING%"=="1" (
	echo.
	echo [AVISO] O servidor esta rodando. Pare-o antes de recompilar:
	echo feche a janela "%SERVER_TITLE%" ou pressione Ctrl+C nela.
	choice /c SN /n /m "Recompilar mesmo assim? [S/N] "
	if errorlevel 2 goto main_menu
)
call :run_build
if errorlevel 1 (
	echo.
	pause
	goto main_menu
)
timeout /t 3 /nobreak >nul 2>&1
goto main_menu

:start_server_process
start "%SERVER_TITLE%" cmd /k node scripts\start.mjs
exit /b 0

:is_running
set "HUB_RUNNING=0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $client = New-Object System.Net.Sockets.TcpClient; $client.Connect('127.0.0.1', %HUB_PORT%); $client.Dispose(); exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 set "HUB_RUNNING=1"
exit /b 0

:wait_for_server
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(20); while ((Get-Date) -lt $deadline) { try { $client = New-Object System.Net.Sockets.TcpClient; $client.Connect('127.0.0.1', %HUB_PORT%); $client.Dispose(); exit 0 } catch { Start-Sleep -Milliseconds 500 } }; exit 1" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:run_build
where npm >nul 2>&1
if errorlevel 1 (
	echo.
	echo [ERRO] npm nao encontrado no PATH. Reinstale o Node.js 24 ou superior.
	exit /b 1
)
echo.
echo Executando npm run build...
echo.
call npm run build
if errorlevel 1 (
	echo.
	echo [ERRO] O build falhou. Veja a mensagem acima.
	if not exist node_modules (
		echo Dica: as dependencias nao estao instaladas. Rode "npm install" e tente de novo.
	)
	exit /b 1
)
echo.
echo Build concluido com sucesso.
exit /b 0

:quit
endlocal
exit /b 0
