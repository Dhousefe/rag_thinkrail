import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

// Localiza o executável germes.exe (prioriza o binário local do ThinkRail)
const repoRoot = resolve(__dirname, "..", "..", "..");
const candidatePaths = [
  join(repoRoot, "apps", "cli", "dist", "germes.exe"),
  "D:\\Projet_Thinkrail\\source\\thinkrail\\apps\\cli\\dist\\germes.exe",
  "D:\\Projeto_Germes\\hermes-3.0\\dist\\germes.exe",
];

let germesExe = candidatePaths.find((p) => existsSync(p));
if (!germesExe) {
  germesExe = "germes.exe"; // Tenta via PATH
}

const workspaceRoot = process.env.HERMES_WORKSPACE_ROOT || repoRoot;
const projectName = process.env.HERMES_PROJECT || "project-thinkrail";

// Informações de inicialização vão estritamente para o stderr para proteger o canal JSON-RPC no stdout
process.stderr.write(`[ThinkRail-MCP-Proxy] Iniciando Hermes MCP Server via ${germesExe}\n`);
process.stderr.write(`[ThinkRail-MCP-Proxy] Workspace: ${workspaceRoot} | Projeto: ${projectName}\n`);

const child: ChildProcess = spawn(germesExe, ["mcp"], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    HERMES_WORKSPACE_ROOT: workspaceRoot,
    HERMES_PROJECT: projectName,
    HERMES_PROJECTS_DIR: process.env.HERMES_PROJECTS_DIR || join(process.env.USERPROFILE || "", ".hermes", "projects"),
    EMBEDDINGS_URL: process.env.EMBEDDINGS_URL || "http://127.0.0.1:9085/api/embeddings",
  },
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

// Encaminha stdin transparente do cliente MCP para o germes
process.stdin.pipe(child.stdin!);

// Encaminha stderr do germes diretamente para o stderr do cliente MCP
child.stderr!.pipe(process.stderr);

// Filtro estrito de STDOUT: Apenas JSON-RPC puro passa para stdout. Logs vão para stderr.
let stdoutBuffer = "";
child.stdout!.on("data", (chunk: Buffer) => {
  stdoutBuffer += chunk.toString("utf-8");
  const lines = stdoutBuffer.split("\n");
  stdoutBuffer = lines.pop() || "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Valida se a linha é uma mensagem JSON-RPC válida (começa com '{' e termina com '}')
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        JSON.parse(line);
        // JSON válido: envia para stdout do cliente MCP
        process.stdout.write(line + "\n");
        continue;
      } catch {
        // Se falhar o parse, não é JSON válido
      }
    }

    // Linhas de log informativo (ex: [INFO], [JINA-MANAGER], [MCP-READY], etc.) são desviadas para stderr
    process.stderr.write(`[hermes-log] ${line}\n`);
  }
});

child.on("exit", (code, signal) => {
  process.stderr.write(`[ThinkRail-MCP-Proxy] Hermes finalizado com código ${code}, sinal ${signal}\n`);
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  process.stderr.write(`[ThinkRail-MCP-Proxy-ERROR] Falha ao executar germes.exe: ${err.message}\n`);
  process.exit(1);
});

function cleanExit() {
  if (!child.killed) {
    child.kill();
  }
}

process.on("SIGINT", cleanExit);
process.on("SIGTERM", cleanExit);
process.on("exit", cleanExit);
