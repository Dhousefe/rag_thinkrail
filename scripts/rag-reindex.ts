import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
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
const PROJECT_SLUG = "project-thinkrail";
const EMBEDDINGS_URL = "http://127.0.0.1:9085";

const SUPPORTED_EXTS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".kt",
	".java",
	".md",
	".json",
]);

const IGNORED_DIRS = new Set([
	"node_modules",
	".git",
	"dist",
	".turbo",
	".next",
	"build",
	".cache",
	".gradle",
]);

function sha256(content: Buffer | string): string {
	return createHash("sha256").update(content).digest("hex");
}

function collectFiles(dir: string, fileList: string[] = []): string[] {
	if (!existsSync(dir)) return fileList;
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (!IGNORED_DIRS.has(entry.name)) {
				collectFiles(join(dir, entry.name), fileList);
			}
		} else if (entry.isFile()) {
			const ext = extname(entry.name).toLowerCase();
			if (SUPPORTED_EXTS.has(ext)) {
				fileList.push(join(dir, entry.name));
			}
		}
	}
	return fileList;
}

async function getEmbedding(text: string): Promise<number[] | null> {
	try {
		const res = await fetch(`${EMBEDDINGS_URL}/embed`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ texts: [text.slice(0, 4000)] }),
			signal: AbortSignal.timeout(4000),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { embeddings: number[][] };
		return json.embeddings?.[0] || null;
	} catch {
		return null;
	}
}

export async function runIncrementalReindex(targetPaths: string[]) {
	console.log("============================================================");
	console.log(" [RAG] Reindexação Incremental Inteligente (Hermes RAG)");
	console.log("============================================================");
	console.log(` Projeto   : ${PROJECT_SLUG}`);
	console.log(` Banco     : ${DB_PATH}`);
	console.log(` Raiz      : ${REPO_ROOT}`);
	console.log(
		` Alvos     : ${targetPaths.join(", ")}`,
	);
	console.log("============================================================\n");

	if (!existsSync(DB_PATH)) {
		console.error(`[X] Banco Hermes não encontrado em: ${DB_PATH}`);
		process.exit(1);
	}

	const db = new Database(DB_PATH);
	db.run("PRAGMA foreign_keys = ON;");

	const checkUnchangedStmt = db.prepare(`
		SELECT 1 FROM l2j_files 
		WHERE project_name = ? AND path = ? AND sha256 = ? AND mtime_ms = ? 
		LIMIT 1;
	`);

	const deleteFtsStmt = db.prepare(
		"DELETE FROM l2j_chunk_fts WHERE file_id = ?;",
	);
	const deleteFileStmt = db.prepare("DELETE FROM l2j_files WHERE id = ?;");
	const getFileIdStmt = db.prepare(
		"SELECT id FROM l2j_files WHERE project_name = ? AND path = ? LIMIT 1;",
	);

	const insertFileStmt = db.prepare(`
		INSERT OR REPLACE INTO l2j_files(id, project_name, path, sha256, mtime_ms, indexed_at)
		VALUES (?, ?, ?, ?, ?, ?);
	`);

	const insertChunkStmt = db.prepare(`
		INSERT OR REPLACE INTO l2j_chunks(id, file_id, symbol_id, project_name, path, chunk_kind, package_name, qualified_name, signature, content, keywords, start_line, end_line, token_estimate, embedding_model, embedding_dim, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`);

	const insertFtsStmt = db.prepare(`
		INSERT INTO l2j_chunk_fts(chunk_id, project_name, file_id, path, qualified_name, signature, content, keywords)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?);
	`);

	let skipped = 0;
	let indexed = 0;
	let chunksTotal = 0;

	for (const target of targetPaths) {
		const fullTarget = resolve(REPO_ROOT, target);
		const files = statSync(fullTarget, { throwIfNoEntry: false })?.isDirectory()
			? collectFiles(fullTarget)
			: [fullTarget];

		for (const filePath of files) {
			if (!existsSync(filePath)) continue;
			const stats = statSync(filePath);
			const mtime = Math.floor(stats.mtimeMs);
			const content = readFileSync(filePath);
			const hash = sha256(content);

			const isUnchanged = Boolean(
				checkUnchangedStmt.get(PROJECT_SLUG, filePath, hash, mtime),
			);

			if (isUnchanged) {
				skipped++;
				continue;
			}

			// Arquivo modificado ou novo: invalidação e indexação
			const existingRow = getFileIdStmt.get(PROJECT_SLUG, filePath) as
				| { id: string }
				| undefined;
			if (existingRow) {
				deleteFtsStmt.run(existingRow.id);
				deleteFileStmt.run(existingRow.id);
			}

			const fileId = sha256(`${PROJECT_SLUG}|${filePath}`);
			const now = Date.now();
			insertFileStmt.run(fileId, PROJECT_SLUG, filePath, hash, mtime, now);

			// Chunking básico baseado em quebras de bloco/parágrafo
			const textContent = content.toString("utf-8");
			const lines = textContent.split(/\r?\n/);
			const chunkSize = 60;
			let chunkIdx = 0;

			for (let i = 0; i < lines.length; i += chunkSize) {
				const chunkLines = lines.slice(i, i + chunkSize);
				const chunkText = chunkLines.join("\n");
				if (chunkText.trim().length === 0) continue;

				const chunkSeed = `chunk:${i}:${chunkText.length}`;
				const chunkId = sha256(`${PROJECT_SLUG}|${filePath}|${chunkSeed}`);
				const keywords = [
					extname(filePath).replace(".", ""),
					filePath.split(/[\\/]/).pop() || "",
				].join(" ");

				insertChunkStmt.run(
					chunkId,
					fileId,
					null,
					PROJECT_SLUG,
					filePath,
					"block",
					"",
					filePath,
					"",
					chunkText,
					keywords,
					i + 1,
					Math.min(i + chunkSize, lines.length),
					Math.ceil(chunkText.length / 4),
					"jina-embeddings-v2-base-code",
					768,
					now,
				);

				insertFtsStmt.run(
					chunkId,
					PROJECT_SLUG,
					fileId,
					filePath,
					filePath,
					"",
					chunkText,
					keywords,
				);

				chunkIdx++;
				chunksTotal++;
			}

			indexed++;
			console.log(
				` [indexed] ${filePath.replace(REPO_ROOT, "").replace(/^[\\/]/, "")} (chunks=${chunkIdx})`,
			);
		}
	}

	console.log("\n============================================================");
	console.log(` [done] Arquivos indexados: ${indexed}`);
	console.log(`        Arquivos inalterados pulados: ${skipped}`);
	console.log(`        Novos chunks gerados: ${chunksTotal}`);
	console.log("============================================================\n");

	db.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const targets = process.argv.slice(2);
	runIncrementalReindex(
		targets.length > 0 ? targets : ["scripts", "apps", "packages"],
	);
}
