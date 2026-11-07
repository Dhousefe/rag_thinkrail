import { spawn } from "child_process";

async function runMcp(toolName: string, args: Record<string, any>): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn("bun", ["apps/cli/scripts/hermes-mcp-server.ts"], {
      stdio: ["pipe", "pipe", "ignore"],
    });

    let stdout = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    const msg =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }) + "\n";

    proc.stdin.write(msg);

    setTimeout(() => {
      proc.kill();
      try {
        const lines = stdout.split("\n").filter((l) => l.trim().startsWith("{"));
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          const json = JSON.parse(lastLine);
          resolve(json.result?.content?.[0]?.text || stdout);
        } else {
          resolve(stdout);
        }
      } catch {
        resolve(stdout);
      }
    }, 1800);
  });
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function main() {
  console.log("=== BENCHMARK DE ECONOMIA DE TOKENS (HERMES RAG) ===");

  // Simulação de Investigação: Localizar o tipo e implementação de MatchTier / matchFields no ThinkRail

  console.log("\n[Cenário 1: Busca Livre Convencional (code_search global sem escopo)]");
  const unconstrainedResult = await runMcp("code_search", { query: "matchFields", limit: 10 });
  const unconstrainedTokens = estimateTokens(unconstrainedResult);
  console.log(`Caracteres retornados: ${unconstrainedResult.length} | Tokens estimados: ~${unconstrainedTokens}`);

  console.log("\n[Cenário 2: Pipeline Progressivo L0 -> L1 -> L2]");
  // Passo L0: Mapa global
  const l0 = await runMcp("get_project_l0_index", { project: "project-thinkrail" });
  const l0Tokens = estimateTokens(l0);
  console.log(`L0 (Índice Global): ${l0.length} chars | ~${l0Tokens} tokens`);

  // Passo L1: Expansão do cluster identificado (contracts)
  const l1 = await runMcp("expand_graph_node", { cluster_id: "contracts", project: "project-thinkrail" });
  const l1Tokens = estimateTokens(l1);
  console.log(`L1 (Sub-grafo e Contratos): ${l1.length} chars | ~${l1Tokens} tokens`);

  // Passo L2: Busca vetorial cirúrgica focada no cluster identificado
  const l2 = await runMcp("code_search", { query: "matchFields", limit: 2, cluster_id: "contracts" });
  const l2Tokens = estimateTokens(l2);
  console.log(`L2 (Chunks Cirúrgicos Restritos): ${l2.length} chars | ~${l2Tokens} tokens`);

  const progressiveTotalTokens = l0Tokens + l1Tokens + l2Tokens;

  console.log("\n=== RESULTADO COMPARATIVO ===");
  console.log(`Busca Global Bruta (10 chunks sem filtro): ~${unconstrainedTokens} tokens`);
  console.log(`Acesso Cirúrgico L2 (após isolar o nó): ~${l2Tokens} tokens`);
  console.log(`Ciclo Completo com Navegação (L0 + L1 + L2): ~${progressiveTotalTokens} tokens`);
  console.log(`Economia direta na recuperação de código (L2 vs Global): ~${Math.round((1 - l2Tokens / unconstrainedTokens) * 100)}% de tokens poupados!`);
}

main().catch(console.error);
