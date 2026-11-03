import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const home = process.env.USERPROFILE || process.env.HOME || "";
const DB_PATH = join(
	home,
	".hermes",
	"projects",
	"project-thinkrail",
	"hermes.db",
);

console.log("============================================================");
console.log(" [RAG] Auditoria e Cobertura do Repositório");
console.log("============================================================");
console.log(` Projeto : project-thinkrail`);
console.log(` Banco   : ${DB_PATH}`);
console.log("============================================================\n");

if (!existsSync(DB_PATH)) {
	console.error(`[X] Banco de dados não encontrado em: ${DB_PATH}`);
	process.exit(1);
}

const db = new Database(DB_PATH);

const totalFilesRow = db
	.query(
		"SELECT count(*) as count FROM l2j_files WHERE project_name = 'project-thinkrail';",
	)
	.get() as { count: number };
const totalChunksRow = db
	.query(
		"SELECT count(*) as count FROM l2j_chunks WHERE project_name = 'project-thinkrail';",
	)
	.get() as { count: number };
const totalSymbolsRow = db
	.query(
		"SELECT count(*) as count FROM l2j_symbols WHERE project_name = 'project-thinkrail';",
	)
	.get() as { count: number };

console.log(`Arquivos Indexados : ${totalFilesRow.count}`);
console.log(`Total de Chunks    : ${totalChunksRow.count}`);
console.log(`Total de Símbolos   : ${totalSymbolsRow.count}`);
console.log("------------------------------------------------------------");

// Checar últimos arquivos indexados
const recentRows = db
	.query(
		"SELECT path, datetime(indexed_at/1000, 'unixepoch', 'localtime') as dt FROM l2j_files WHERE project_name = 'project-thinkrail' ORDER BY indexed_at DESC LIMIT 5;",
	)
	.all() as Array<{ path: string; dt: string }>;

console.log("Últimos arquivos indexados:");
for (const r of recentRows) {
	console.log(`  - [${r.dt}] ${relative(REPO_ROOT, r.path)}`);
}

db.close();
