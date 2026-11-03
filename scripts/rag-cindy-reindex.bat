@echo off
REM =============================================================================
REM Sincronizacao RAG Cirurgica e Incremental para o Projeto CINDY
REM Usa o runner TS com o germes.exe nativo e atualiza hermes.db do Cindy
REM =============================================================================
setlocal enabledelayedexpansion

set "CINDY_WORKSPACE=D:\Cindy\cindy"
set "CINDY_DB=%USERPROFILE%\.hermes\projects\cindy\hermes.db"

if not exist "%CINDY_WORKSPACE%" (
    echo [ERRO] Workspace do Cindy nao encontrado em: %CINDY_WORKSPACE%
    exit /b 1
)

cd /d "%~dp0.."
bun scripts/rag-reindex.ts --project cindy --workspace "%CINDY_WORKSPACE%" --db "%CINDY_DB%" %*
