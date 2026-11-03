@echo off
setlocal enabledelayedexpansion

:: Define o diretorio raiz do ThinkRail
set "ROOT_DIR=%~dp0.."
cd /d "%ROOT_DIR%"

:: Variaveis de ambiente padrao do Hermes MCP
if "%HERMES_PROJECT%"=="" set "HERMES_PROJECT=project-thinkrail"
if "%HERMES_WORKSPACE_ROOT%"=="" set "HERMES_WORKSPACE_ROOT=%ROOT_DIR%"
if "%EMBEDDINGS_URL%"=="" set "EMBEDDINGS_URL=http://127.0.0.1:9085/api/embeddings"

:: Executa o runner filtrado de MCP com Bun ou Node
where bun >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    bun run "%ROOT_DIR%\apps\cli\scripts\hermes-mcp-server.ts"
) else (
    node -r esbuild-register "%ROOT_DIR%\apps\cli\scripts\hermes-mcp-server.ts"
)
