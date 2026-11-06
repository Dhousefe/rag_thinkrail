import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "..");
const home = process.env.USERPROFILE || process.env.HOME || "";

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
	projectSlug?: string | undefined;
	dbPath?: string | undefined;
	workspaceRoot?: string | undefined;
	targetPaths?: string[] | undefined;
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

	const dbDir = dirname(dbPath);
	if (!existsSync(dbDir)) {
		const { mkdirSync } = await import("node:fs");
		mkdirSync(dbDir, { recursive: true });
	}

	const db = new Database(dbPath);
	db.run("PRAGMA journal_mode = WAL;");
	db.run("PRAGMA busy_timeout = 60000;");
	db.run("PRAGMA foreign_keys = OFF;");

	// Garante schema inicial caso seja um banco novo
	db.run(`
		CREATE TABLE IF NOT EXISTS l2j_files (
			id TEXT PRIMARY KEY,
			project_name TEXT NOT NULL,
			path TEXT NOT NULL,
			sha256 TEXT NOT NULL,
			mtime_ms INTEGER NOT NULL,
			indexed_at INTEGER NOT NULL
		);
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS l2j_symbols (
			id TEXT PRIMARY KEY,
			file_id TEXT NOT NULL,
			project_name TEXT NOT NULL,
			path TEXT NOT NULL,
			symbol_kind TEXT NOT NULL,
			package_name TEXT,
			qualified_name TEXT NOT NULL,
			simple_name TEXT NOT NULL,
			signature TEXT,
			start_line INTEGER,
			end_line INTEGER,
			token_estimate INTEGER,
			ast_fingerprint TEXT,
			created_at INTEGER NOT NULL
		);
	`);
	db.run(`
		CREATE TABLE IF NOT EXISTS l2j_chunks (
			id TEXT PRIMARY KEY,
			file_id TEXT NOT NULL,
			symbol_id TEXT,
			project_name TEXT NOT NULL,
			path TEXT NOT NULL,
			chunk_kind TEXT NOT NULL,
			package_name TEXT,
			qualified_name TEXT NOT NULL,
			signature TEXT,
			content TEXT NOT NULL,
			keywords TEXT,
			start_line INTEGER,
			end_line INTEGER,
			token_estimate INTEGER,
			embedding_model TEXT,
			embedding_dim INTEGER,
			created_at INTEGER NOT NULL
		);
	`);
	db.run(`
		CREATE VIRTUAL TABLE IF NOT EXISTS l2j_chunk_fts USING fts5(
			chunk_id UNINDEXED,
			project_name UNINDEXED,
			file_id UNINDEXED,
			path UNINDEXED,
			qualified_name,
			signature,
			content,
			keywords,
			tokenize = 'porter unicode61'
		);
	`);

	const deleteFtsStmt = db.prepare("DELETE FROM l2j_chunk_fts WHERE file_id = ?;");
	const deleteChunksStmt = db.prepare("DELETE FROM l2j_chunks WHERE file_id = ?;");
	const deleteSymbolsStmt = db.prepare("DELETE FROM l2j_symbols WHERE file_id = ?;");
	const deleteFileStmt = db.prepare("DELETE FROM l2j_files WHERE id = ?;");

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

	// Pré-carrega todos os arquivos indexados do projeto em memória para eliminar I/O concorrente de leitura
	const existingFilesQuery = db.query(
		"SELECT id, path, sha256, mtime_ms FROM l2j_files WHERE project_name = ?;",
	);
	const existingRows = existingFilesQuery.all(projectSlug) as Array<{
		id: string;
		path: string;
		sha256: string;
		mtime_ms: number;
	}>;
	const existingFilesMap = new Map<string, { id: string; sha256: string; mtime_ms: number }>();
	for (const row of existingRows) {
		existingFilesMap.set(row.path, row);
	}

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

		const existingEntry = existingFilesMap.get(filePath);
		if (existingEntry && existingEntry.sha256 === hash && existingEntry.mtime_ms === mtime) {
			skipped++;
			continue;
		}

		const fileId = existingEntry ? existingEntry.id : sha256(`${projectSlug}|${filePath}`);

		const indexFileTx = db.transaction(() => {
			if (existingEntry) {
				try {
					deleteFtsStmt.run(existingEntry.id);
				} catch {}
				try {
					deleteChunksStmt.run(existingEntry.id);
				} catch {}
				try {
					deleteSymbolsStmt.run(existingEntry.id);
				} catch {}
				deleteFileStmt.run(existingEntry.id);
			}

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
			return chunkIdx;
		});

		let fileChunks = 0;
		let attempts = 0;
		while (attempts < 5) {
			try {
				fileChunks = indexFileTx();
				break;
			} catch (err: any) {
				if (err?.code === "SQLITE_BUSY" && attempts < 4) {
					attempts++;
					const waitMs = 50 * attempts;
					Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
					continue;
				}
				throw err;
			}
		}
		indexed++;
		console.log(` [indexed] ${relPath} (chunks=${fileChunks})`);
	}

	console.log("\n============================================================");
	console.log(` [done] Arquivos indexados: ${indexed}`);
	console.log(`        Arquivos inalterados pulados: ${skipped}`);
	console.log(`        Novos chunks gerados: ${chunksTotal}`);
	console.log("============================================================\n");

	try {
		db.run("PRAGMA wal_checkpoint(PASSIVE);");
	} catch {}
	db.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const opts: ReindexOptions = {};
	const targets: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;
		if (arg === "--project" && args[i + 1]) {
			const val = args[++i];
			if (val) opts.projectSlug = val;
		} else if (arg === "--db" && args[i + 1]) {
			const val = args[++i];
			if (val) opts.dbPath = val;
		} else if (arg === "--workspace" && args[i + 1]) {
			const val = args[++i];
			if (val) opts.workspaceRoot = val;
		} else if (!arg.startsWith("--")) {
			targets.push(arg);
		}
	}
	if (targets.length > 0) {
		opts.targetPaths = targets;
	}

	runIncrementalReindex(opts);
}
