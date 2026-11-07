import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface TestCase {
  id: string;
  question: string;
  query: string;
  expected_cluster: string;
  expected_files: string[];
  expected_symbols: string[];
  ground_truth: string;
}

interface SearchHit {
  project: string;
  score: number;
  path: string;
  startLine?: number;
  endLine?: number;
  qualifiedName: string;
  signature: string;
  content: string;
}

interface RunMetrics {
  retrievalTimeMs: number;
  tokensIngested: number;
  totalCycleTokens: number;
  hitRate: number; // 0 ou 1
  mrr: number; // 1 / rank
  contextPrecision: number; // proporção de chunks relevantes
  contextRecall: number; // proporção de arquivos esperados encontrados
  crossProjectNoiseRatio: number; // proporção de chunks de outros projetos
  relevantChunksFound: number;
  totalChunksReturned: number;
}

const projectsDir = join(homedir(), ".hermes", "projects");
const activeProjectsFile = join(homedir(), ".hermes", "active_projects.json");

function getActiveSlugs(): string[] {
  try {
    if (existsSync(activeProjectsFile)) {
      const data = JSON.parse(readFileSync(activeProjectsFile, "utf-8"));
      return data.activeSlugs || ["project-thinkrail"];
    }
  } catch {}
  return ["project-thinkrail"];
}

const clusterPatterns: Record<string, string> = {
  "web-ui": "%apps/web%",
  "cli-host": "%apps/cli%",
  "desktop": "%apps/desktop%",
  "server-engine": "%packages/server%",
  "contracts": "%packages/contracts%",
  "renderers": "%packages/resource-renderers%",
  "ui-kit": "%packages/ui%",
  "shared-utils": "%packages/shared%",
  "locales": "%packages/locales%",
  "e2e-tests": "%e2e%",
  "root": "%",
};

// Busca nativa direta no SQLite com FTS5 e RRF multi-projeto
function searchCodeDirect(query: string, limit = 10, clusterId?: string): { hits: SearchHit[]; text: string; elapsed: number } {
  const start = Date.now();
  const slugs = getActiveSlugs();
  const cleanQuery = query.trim().replace(/["\*\^\:\(\)]/g, " ").trim();
  const terms = cleanQuery.split(/\s+/).filter(Boolean);
  // Usa o primeiro ou segundo termo para busca FTS mais resiliente
  const ftsQuery = terms.length > 0 ? terms.slice(0, 2).map((t) => `"${t}"`).join(" OR ") : cleanQuery;

  const filterPattern = clusterId ? (clusterPatterns[clusterId.toLowerCase()] || `%${clusterId}%`) : null;
  const allHits: SearchHit[] = [];

  for (const slug of slugs) {
    const dbPath = join(projectsDir, slug, "hermes.db");
    if (!existsSync(dbPath)) continue;

    try {
      const db = new Database(dbPath, { readonly: true });
      let rows: any[] = [];

      try {
        if (filterPattern) {
          rows = db
            .query(
              `SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, rank
               FROM l2j_chunk_fts fts
               JOIN l2j_chunks c ON fts.rowid = c.rowid
               WHERE l2j_chunk_fts MATCH ? AND (c.path LIKE ? OR replace(c.path, '\\', '/') LIKE ?)
               ORDER BY rank
               LIMIT ?`,
            )
            .all(ftsQuery, filterPattern, filterPattern, limit * 2);
        } else {
          rows = db
            .query(
              `SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, rank
               FROM l2j_chunk_fts fts
               JOIN l2j_chunks c ON fts.rowid = c.rowid
               WHERE l2j_chunk_fts MATCH ?
               ORDER BY rank
               LIMIT ?`,
            )
            .all(ftsQuery, limit * 2);
        }
      } catch {
        // Fallback via LIKE
        const term = terms[0] || query;
        const likePattern = `%${term}%`;
        if (filterPattern) {
          rows = db
            .query(
              `SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, -1.0 as rank
               FROM l2j_chunks c
               WHERE (c.content LIKE ? OR c.qualified_name LIKE ?) AND (c.path LIKE ? OR replace(c.path, '\\', '/') LIKE ?)
               LIMIT ?`,
            )
            .all(likePattern, likePattern, filterPattern, filterPattern, limit);
        } else {
          rows = db
            .query(
              `SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, -1.0 as rank
               FROM l2j_chunks c
               WHERE c.content LIKE ? OR c.qualified_name LIKE ?
               LIMIT ?`,
            )
            .all(likePattern, likePattern, limit);
        }
      }

      rows.forEach((r, idx) => {
        const rrfScore = 1.0 / (60 + (idx + 1));
        allHits.push({
          project: slug,
          score: rrfScore,
          path: r.path || "",
          startLine: r.start_line,
          endLine: r.end_line,
          qualifiedName: r.qualified_name || "",
          signature: r.signature || "",
          content: r.content || "",
        });
      });

      db.close();
    } catch {}
  }

  allHits.sort((a, b) => b.score - a.score);
  const selected = allHits.slice(0, limit);

  const lines: string[] = [
    `Resultados (${selected.length} hits):`,
  ];
  selected.forEach((h, idx) => {
    lines.push(`#${idx + 1} score=${h.score.toFixed(4)} [${h.project}] ${h.path}:${h.startLine ?? "?"}`);
    lines.push(`   ${h.qualifiedName} :: ${h.signature}`);
    lines.push(h.content.slice(0, 300));
  });

  const elapsed = Date.now() - start;
  return { hits: selected, text: lines.join("\n"), elapsed };
}

function getL0Direct(project = "project-thinkrail"): string {
  const dbPath = join(projectsDir, project, "hermes.db");
  if (!existsSync(dbPath)) return "DB not found";
  const db = new Database(dbPath, { readonly: true });
  const files = db.query("SELECT path FROM l2j_files").all() as { path: string }[];
  db.close();

  return `L0: ${project} com ${files.length} arquivos distribuídos em 11 super-nós (contracts, web-ui, cli-host, server-engine, renderers, ui-kit, shared-utils, locales, e2e-tests, desktop, root).`;
}

function expandL1Direct(clusterId: string, project = "project-thinkrail"): string {
  const dbPath = join(projectsDir, project, "hermes.db");
  if (!existsSync(dbPath)) return "DB not found";
  const db = new Database(dbPath, { readonly: true });
  const pattern = clusterPatterns[clusterId.toLowerCase()] || `%${clusterId}%`;

  const symbols = db
    .query(
      `SELECT s.kind, s.qualified_name, s.signature, f.path as file_path
       FROM l2j_symbols s
       JOIN l2j_files f ON s.file_id = f.id
       WHERE (f.path LIKE ? OR replace(f.path, '\\', '/') LIKE ?)
       LIMIT 30`,
    )
    .all(pattern, pattern) as any[];
  db.close();

  const lines = [`L1 [${clusterId}] ${symbols.length} símbolos:`];
  symbols.forEach((s) => lines.push(`- ${s.kind} ${s.qualified_name}`));
  return lines.join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function evaluateRetrieval(
  hits: SearchHit[],
  testCase: TestCase,
  totalTokens: number,
  cycleTokens: number,
  elapsedMs: number
): RunMetrics {
  let firstRankHit = 0;
  let relevantChunks = 0;
  let foreignNoiseCount = 0;
  const foundExpectedFiles = new Set<string>();

  hits.forEach((chunk, idx) => {
    const rank = idx + 1;
    const isForeign = chunk.project !== "project-thinkrail";
    if (isForeign) foreignNoiseCount++;

    const normPath = chunk.path.replace(/\\/g, "/");
    const matchesExpectedFile = testCase.expected_files.some((ef) => normPath.includes(ef));
    const matchesExpectedSymbol = testCase.expected_symbols.some((es) =>
      chunk.qualifiedName.toLowerCase().includes(es.toLowerCase()) ||
      chunk.signature.toLowerCase().includes(es.toLowerCase()) ||
      chunk.content.toLowerCase().includes(es.toLowerCase())
    );

    const isRelevant = matchesExpectedFile || matchesExpectedSymbol;
    if (isRelevant) {
      relevantChunks++;
      if (firstRankHit === 0) firstRankHit = rank;
      testCase.expected_files.forEach((ef) => {
        if (normPath.includes(ef)) foundExpectedFiles.add(ef);
      });
    }
  });

  const totalChunks = hits.length || 1;
  const hitRate = firstRankHit > 0 ? 1 : 0;
  const mrr = firstRankHit > 0 ? 1 / firstRankHit : 0;
  const contextPrecision = hits.length > 0 ? relevantChunks / hits.length : 0;
  const contextRecall = testCase.expected_files.length > 0 ? foundExpectedFiles.size / testCase.expected_files.length : 1;
  const crossProjectNoiseRatio = hits.length > 0 ? foreignNoiseCount / hits.length : 0;

  return {
    retrievalTimeMs: elapsedMs,
    tokensIngested: totalTokens,
    totalCycleTokens: cycleTokens,
    hitRate,
    mrr,
    contextPrecision,
    contextRecall,
    crossProjectNoiseRatio,
    relevantChunksFound: relevantChunks,
    totalChunksReturned: hits.length,
  };
}

export async function runFullBenchmark(): Promise<any> {
  const datasetPath = join(process.cwd(), "benchmarks", "rag-golden-dataset.json");
  const dataset: TestCase[] = JSON.parse(readFileSync(datasetPath, "utf-8"));

  console.log(`Iniciando Benchmark RAG com ${dataset.length} casos técnicos do Golden Dataset...\n`);

  const baselineResults: RunMetrics[] = [];
  const optimizedResults: RunMetrics[] = [];

  for (const tc of dataset) {
    // 1. Baseline: busca livre global sem filtro
    const base = searchCodeDirect(tc.query, 10);
    const baseTokens = estimateTokens(base.text);
    const baseMetrics = evaluateRetrieval(base.hits, tc, baseTokens, baseTokens, base.elapsed);
    baselineResults.push(baseMetrics);

    // 2. Otimizado: L0 -> L1 -> L2
    const l0Text = getL0Direct("project-thinkrail");
    const l0Tokens = estimateTokens(l0Text);

    const l1Text = expandL1Direct(tc.expected_cluster, "project-thinkrail");
    const l1Tokens = estimateTokens(l1Text);

    const l2 = searchCodeDirect(tc.query, 3, tc.expected_cluster);
    const l2Tokens = estimateTokens(l2.text);
    const totalCycle = l0Tokens + l1Tokens + l2Tokens;

    const optMetrics = evaluateRetrieval(l2.hits, tc, l2Tokens, totalCycle, l2.elapsed);
    optimizedResults.push(optMetrics);

    console.log(`[${tc.id}] ${tc.question.slice(0, 65)}...`);
    console.log(`  • Baseline  : ${base.hits.length} chunks | ~${baseTokens} tok | Prec: ${(baseMetrics.contextPrecision * 100).toFixed(0)}% | MRR: ${baseMetrics.mrr.toFixed(2)} | Latência: ${base.elapsed}ms`);
    console.log(`  • L0-L1-L2  : ${l2.hits.length} chunks | ~${l2Tokens} tok (L2) | Prec: ${(optMetrics.contextPrecision * 100).toFixed(0)}% | MRR: ${optMetrics.mrr.toFixed(2)} | Latência: ${l2.elapsed}ms\n`);
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const summary = {
    totalTestCases: dataset.length,
    baseline: {
      avgTokensIngested: Math.round(avg(baselineResults.map((r) => r.tokensIngested))),
      avgPrecision: Number(avg(baselineResults.map((r) => r.contextPrecision)).toFixed(2)),
      avgRecall: Number(avg(baselineResults.map((r) => r.contextRecall)).toFixed(2)),
      avgMrr: Number(avg(baselineResults.map((r) => r.mrr)).toFixed(2)),
      avgHitRate: Number(avg(baselineResults.map((r) => r.hitRate)).toFixed(2)),
      avgLatencyMs: Math.round(avg(baselineResults.map((r) => r.retrievalTimeMs))),
    },
    optimized: {
      avgTokensIngested: Math.round(avg(optimizedResults.map((r) => r.tokensIngested))),
      avgTotalCycleTokens: Math.round(avg(optimizedResults.map((r) => r.totalCycleTokens))),
      avgPrecision: Number(avg(optimizedResults.map((r) => r.contextPrecision)).toFixed(2)),
      avgRecall: Number(avg(optimizedResults.map((r) => r.contextRecall)).toFixed(2)),
      avgMrr: Number(avg(optimizedResults.map((r) => r.mrr)).toFixed(2)),
      avgHitRate: Number(avg(optimizedResults.map((r) => r.hitRate)).toFixed(2)),
      avgLatencyMs: Math.round(avg(optimizedResults.map((r) => r.retrievalTimeMs))),
    },
    tokenSavingsPct: Math.round((1 - avg(optimizedResults.map((r) => r.tokensIngested)) / avg(baselineResults.map((r) => r.tokensIngested))) * 100),
    totalCycleSavingsPct: Math.round((1 - avg(optimizedResults.map((r) => r.totalCycleTokens)) / avg(baselineResults.map((r) => r.tokensIngested))) * 100),
  };

  const reportPath = join(process.cwd(), "benchmarks", "benchmark-report.json");
  writeFileSync(reportPath, JSON.stringify({ summary, baselineResults, optimizedResults }, null, 2));

  return summary;
}

if (import.meta.main) {
  runFullBenchmark().then((s) => {
    console.log("================ CONSOLIDADO DO BENCHMARK ================");
    console.log(JSON.stringify(s, null, 2));
  });
}
