import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface TestCase {
  id: string;
  question: string;
  query: string;
  expected_cluster: string;
  expected_files: string[];
  expected_symbols: string[];
  ground_truth: string;
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--") && i + 1 < args.length) {
      const key = arg.slice(2);
      result[key] = args[i + 1];
      i++;
    }
  }
  return result;
}

export function recordDiscovery(entry: {
  question: string;
  query: string;
  cluster: string;
  files: string[];
  symbols: string[];
  groundTruth: string;
}): { success: boolean; id: string; totalCases: number } {
  const datasetPath = join(process.cwd(), "benchmarks", "rag-golden-dataset.json");

  let dataset: TestCase[] = [];
  if (existsSync(datasetPath)) {
    try {
      dataset = JSON.parse(readFileSync(datasetPath, "utf-8"));
    } catch {
      dataset = [];
    }
  }

  // Gera ID único sequencial
  const nextIdx = dataset.length + 1;
  const id = `tc_${String(nextIdx).padStart(2, "0")}_${entry.cluster}_${entry.symbols[0]?.toLowerCase() || "discovery"}`;

  // Deduplicação básica: checa se já existe pergunta ou query idêntica
  const exists = dataset.find(
    (item) =>
      item.question.toLowerCase() === entry.question.toLowerCase() ||
      (item.query.toLowerCase() === entry.query.toLowerCase() && item.expected_cluster === entry.cluster)
  );

  if (exists) {
    console.log(`[GoldenDataset] Caso já existente encontrado (${exists.id}). Atualizando ground truth e referências...`);
    exists.expected_files = Array.from(new Set([...exists.expected_files, ...entry.files]));
    exists.expected_symbols = Array.from(new Set([...exists.expected_symbols, ...entry.symbols]));
    exists.ground_truth = entry.groundTruth || exists.ground_truth;
    writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));
    return { success: true, id: exists.id, totalCases: dataset.length };
  }

  const newCase: TestCase = {
    id,
    question: entry.question,
    query: entry.query,
    expected_cluster: entry.cluster,
    expected_files: entry.files,
    expected_symbols: entry.symbols,
    ground_truth: entry.groundTruth,
  };

  dataset.push(newCase);
  writeFileSync(datasetPath, JSON.stringify(dataset, null, 2));

  return { success: true, id, totalCases: dataset.length };
}

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));

  if (!parsed.question || !parsed.query || !parsed.cluster) {
    console.error("Uso obrigatório:");
    console.error('  bun scripts/record-rag-discovery.ts --question "<dúvida>" --query "<termos>" --cluster "<cluster_id>" --files "p/a,p/b" --symbols "s1,s2" --ground-truth "<resumo>"');
    process.exit(1);
  }

  const files = parsed.files ? parsed.files.split(",").map((s) => s.trim()) : [];
  const symbols = parsed.symbols ? parsed.symbols.split(",").map((s) => s.trim()) : [];

  const res = recordDiscovery({
    question: parsed.question,
    query: parsed.query,
    cluster: parsed.cluster,
    files,
    symbols,
    groundTruth: parsed["ground-truth"] || "",
  });

  console.log(`[GoldenDataset] Nova descoberta técnica gravada com sucesso!`);
  console.log(`  • ID: ${res.id}`);
  console.log(`  • Total de Casos de Referência: ${res.totalCases}`);
}
