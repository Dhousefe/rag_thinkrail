@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul

REM ============================================================================
REM Reindexação Incremental RAG para ThinkRail
REM Invalida e reindexa apenas arquivos modificados (sha256 + mtime)
REM Paths totalmente relativos a partir da raiz do repositório
REM ============================================================================

set "REPO_ROOT=%~dp0.."
cd /d "%REPO_ROOT%"

REM 1) Prune de arquivos deletados ou renomeados
echo [1/2] Limpando arquivos orfaos e verificando integridade do RAG...
call bun scripts\rag-prune.ts
if errorlevel 1 (
    echo [X] Erro ao sincronizar arquivos orfaos.
    exit /b 1
)

REM 2) Reindexacao incremental inteligente
echo.
echo [2/2] Reindexando alteracoes de codigo...
call bun scripts\rag-reindex.ts %*
if errorlevel 1 (
    echo [X] Falha na reindexacao.
    exit /b 1
)

exit /b 0
