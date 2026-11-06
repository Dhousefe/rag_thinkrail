0</* :
@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 > nul

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
*/0;

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pruneTs = join(__dirname, "rag-prune.ts");
const reindexTs = join(__dirname, "rag-reindex.ts");

console.log("[1/2] Limpando arquivos orfaos e verificando integridade do RAG...");
const p1 = spawnSync(process.execPath, [pruneTs], { stdio: "inherit" });
if (p1.status !== 0) process.exit(p1.status ?? 1);

console.log("\n[2/2] Reindexando alteracoes de codigo...");
const p2 = spawnSync(process.execPath, [reindexTs, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(p2.status ?? 0);
