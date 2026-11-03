import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "..");
const home = process.env.USERPROFILE || process.env.HOME || "";
const DEFAULT_DB_PATH = join(home, ".hermes", "projects", "project-thinkrail", "hermes.db");
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
	".rs",
	".go",
	".py",
	".c",
	".cpp",
	".h",
	".cs",
	".sql",
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
	".idea",
	".vscode",
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

export interface ReindexOptions {
	projectSlug?: string;
	dbPath?: string;
	workspaceRoot?: string;
	targetPaths?: string[];
}

export async function runIncrementalReindex(options: ReindexOptions = {}) {
	const projectSlug = options.projectSlug || process.env.HERMES_PROJECT || "project-thinkrail";
	const workspaceRoot = options.workspaceRoot || process.env.HERMES_WORKSPACE_ROOT || DEFAULT_REPO_ROOT;
	const dbPath = options.dbPath || join(home, ".hermes", "projects", projectSlug, "hermes.db");
	const targetPaths = options.targetPaths && options.targetPaths.length > 0
		? options.targetPaths
		: ["scripts", "apps", "packages", "src"];

	console.log("============================================================");
	console.log(" [RAG] Reindexação Incremental Inteligente (Hermes RAG)");
	console.log("============================================================");
	console.log(` Projeto   : ${projectSlug}`);
	console.log(` Banco     : ${dbPath}`);
	console.log(` Raiz      : ${workspaceRoot}`);
	console.log(` Alvos     : ${targetPaths.join(", ")}`);
	console.log("============================================================\n");

	if (!existsSync(dbPath)) {
		console.error(`[X] Banco Hermes não encontrado em: ${dbPath}`);
		process.exit(1);
	}

	const db = new Database(dbPath);
	db.run("PRAGMA foreign_keys = ON;");

	const checkUnchangedStmt = db.prepare(`
		SELECT 1 FROM l2j_files 
		WHERE project_name = ? AND path = ? AND sha256 = ? AND mtime_ms = ? 
		LIMIT 1;
	`);

	const deleteFtsStmt = db.prepare("DELETE FROM l2j_chunk_fts WHERE file_id = ?;");
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

	// Coleta todos os arquivos de todos os alvos primeiro para saber a contagem total exata
	const allFiles: string[] = [];
	for (const target of targetPaths) {
		const fullTarget = resolve(workspaceRoot, target);
		if (!existsSync(fullTarget)) continue;
		const isDir = statSync(fullTarget, { throwIfNoEntry: false })?.isDirectory();
		if (isDir) {
			collectFiles(fullTarget, allFiles);
		} else {
			allFiles.push(fullTarget);
		}
	}

	// Se nenhum arquivo foi coletado com os alvos padrão, varre a raiz do workspace
	if (allFiles.length === 0) {
		collectFiles(workspaceRoot, allFiles);
	}

	const uniqueFiles = Array.from(new Set(allFiles));
	const totalFiles = uniqueFiles.length;

	console.log(`[INFO] Total de arquivos elegíveis detectados: ${totalFiles}`);

	let skipped = 0;
	let indexed = 0;
	let chunksTotal = 0;
	let processed = 0;

	for (const filePath of uniqueFiles) {
		processed++;
		const relPath = relative(workspaceRoot, filePath) || filePath;
		// Emite evento de progresso padronizado para o servidor
		console.log(`PROGRESS:${processed}:${totalFiles}:${relPath}`);

		if (!existsSync(filePath)) continue;
		const stats = statSync(filePath);
		const mtime = Math.floor(stats.mtimeMs);
		const content = readFileSync(filePath);
		const hash = sha256(content);

		const isUnchanged = Boolean(
			checkUnchangedStmt.get(projectSlug, filePath, hash, mtime),
		);

		if (isUnchanged) {
			skipped++;
			continue;
		}

		// Arquivo modificado ou novo: invalidação e indexação
		const existingRow = getFileIdStmt.get(projectSlug, filePath) as
			| { id: string }
			| undefined;
		if (existingRow) {
			deleteFtsStmt.run(existingRow.id);
			deleteFileStmt.run(existingRow.id);
		}

		const fileId = sha256(`${projectSlug}|${filePath}`);
		const now = Date.now();
		insertFileStmt.run(fileId, projectSlug, filePath, hash, mtime, now);

		// Chunking baseado em quebras de bloco de até 60 linhas
		const textContent = content.toString("utf-8");
		const lines = textContent.split(/\r?\n/);
		const chunkSize = 60;
		let chunkIdx = 0;

		for (let i = 0; i < lines.length; i += chunkSize) {
			const chunkLines = lines.slice(i, i + chunkSize);
			const chunkText = chunkLines.join("\n");
			if (chunkText.trim().length === 0) continue;

			const chunkSeed = `chunk:${i}:${chunkText.length}`;
			const chunkId = sha256(`${projectSlug}|${filePath}|${chunkSeed}`);
			const keywords = [
				extname(filePath).replace(".", ""),
				filePath.split(/[\\/]/).pop() || "",
			].join(" ");

			insertChunkStmt.run(
				chunkId,
				fileId,
				null,
				projectSlug,
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
				projectSlug,
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
		console.log(` [indexed] ${relPath} (chunks=${chunkIdx})`);
	}

	console.log("\n============================================================");
	console.log(` [done] Arquivos indexados: ${indexed}`);
	console.log(`        Arquivos inalterados pulados: ${skipped}`);
	console.log(`        Novos chunks gerados: ${chunksTotal}`);
	console.log("============================================================\n");

	db.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const opts: ReindexOptions = {};
	const targets: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--project" && args[i + 1]) {
			opts.projectSlug = args[++i];
		} else if (arg === "--db" && args[i + 1]) {
			opts.dbPath = args[++i];
		} else if (arg === "--workspace" && args[i + 1]) {
			opts.workspaceRoot = args[++i];
		} else if (!arg.startsWith("--")) {
			targets.push(arg);
		}
	}
	if (targets.length > 0) {
		opts.targetPaths = targets;
	}

	runIncrementalReindex(opts);
}
