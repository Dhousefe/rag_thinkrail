import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// Caminhos padrão Hermes
const home = process.env.USERPROFILE || process.env.HOME || "";
const DB_PATH = join(
	home,
	".hermes",
	"projects",
	"project-thinkrail",
	"hermes.db",
);

console.log("============================================================");
console.log(" [RAG] Sincronização & Prune de Arquivos Órfãos");
console.log("============================================================");
console.log(` Projeto : project-thinkrail`);
console.log(` Banco   : ${DB_PATH}`);
console.log(` Raiz    : ${REPO_ROOT}`);
console.log("============================================================\n");

if (!existsSync(DB_PATH)) {
	console.error(`[X] Banco de dados não encontrado em: ${DB_PATH}`);
	process.exit(1);
}

const db = new Database(DB_PATH);
db.run("PRAGMA foreign_keys = ON;");

// Buscar todos os arquivos indexados do projeto
const filesQuery = db.query(
	"SELECT id, path FROM l2j_files WHERE project_name = ?;",
);
const rows = filesQuery.all("project-thinkrail") as Array<{
	id: string;
	path: string;
}>;

console.log(`[i] Total de arquivos indexados no banco: ${rows.length}`);

const deletedFiles: Array<{ id: string; path: string }> = [];

for (const row of rows) {
	if (!existsSync(row.path)) {
		deletedFiles.push(row);
	}
}

if (deletedFiles.length === 0) {
	console.log("[V] Nenhum arquivo órfão detectado. O banco está 100% íntegro.");
	db.close();
	process.exit(0);
}

console.log(
	`[!] Foram detectados ${deletedFiles.length} arquivo(s) órfão(s) que foram removidos do disco:`,
);
for (const file of deletedFiles.slice(0, 10)) {
	console.log(`    - ${file.path}`);
}
if (deletedFiles.length > 10) {
	console.log(`    ... e mais ${deletedFiles.length - 10} arquivo(s)`);
}

console.log("\n[i] Limpando registros órfãos (FTS5 + Chunks + Symbols)...");

const deleteFtsStmt = db.prepare(
	"DELETE FROM l2j_chunk_fts WHERE file_id = ?;",
);
const deleteFileStmt = db.prepare("DELETE FROM l2j_files WHERE id = ?;");

const transaction = db.transaction((files: typeof deletedFiles) => {
	for (const f of files) {
		try {
			deleteFtsStmt.run(f.id);
		} catch (e) {
			console.warn(`[!] Aviso ao limpar FTS para ${f.id}:`, e);
		}
		deleteFileStmt.run(f.id);
	}
});

transaction(deletedFiles);

console.log(
	`[V] Concluído com sucesso! ${deletedFiles.length} arquivo(s) órfão(s) purgados do RAG.`,
);
db.close();
