import { spawn } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type {
	Ack,
	HermesActiveProjectStatus,
	HermesCheckFreshnessResult,
	HermesConnectionStatus,
	HermesCreateProjectInput,
	HermesDeleteProjectInput,
	HermesEnsureProjectForPathInput,
	HermesEnsureProjectForPathResult,
	HermesGetActiveProjectsResult,
	HermesGetVectorGraphInput,
	HermesIndexingProgress,
	HermesListProjectsResult,
	HermesProjectFreshnessItem,
	HermesProjectInfo,
	HermesReindexProjectInput,
	HermesReindexResult,
	HermesSetActiveProjectsInput,
	HermesTestConnectionInput,
	HermesVectorEdge,
	HermesVectorGraphSample,
	HermesVectorNode,
	HermesFindSkillsInput,
	HermesFindSkillsResult,
	HermesInstallSkillInput,
	HermesInstallSkillResult,
	HermesManageSkillsInput,
	HermesManageSkillsResult,
	HermesSkillRepoResult,
	HermesInstalledSkill,
} from "@thinkrail/contracts";
import { logger } from "../log";

const log = logger("hermes");

export function resolveHermesHome(): string {
	if (process.env.HERMES_HOME) {
		return resolve(process.env.HERMES_HOME);
	}
	const userProfile = homedir();
	const defaultHermes = join(userProfile, ".hermes");
	if (existsSync(join(defaultHermes, "projects"))) {
		return defaultHermes;
	}
	if (process.env.LOCALAPPDATA) {
		const localAppDataHermes = join(process.env.LOCALAPPDATA, "hermes");
		if (existsSync(join(localAppDataHermes, "projects"))) {
			return localAppDataHermes;
		}
	}
	if (process.env.APPDATA) {
		const appDataHermes = join(process.env.APPDATA, "hermes");
		if (existsSync(join(appDataHermes, "projects"))) {
			return appDataHermes;
		}
	}
	// Para novas máquinas no Windows, prefere APPDATA se disponível
	if (process.env.APPDATA) {
		return join(process.env.APPDATA, "hermes");
	}
	return defaultHermes;
}

export function ensureHermesEnvironment(): {
	hermesHome: string;
	projectsDir: string;
	binDir: string;
} {
	const hermesHome = resolveHermesHome();
	const projectsDir = join(hermesHome, "projects");
	const binDir = join(hermesHome, "bin");
	const logsDir = join(hermesHome, "logs");
	const cacheDir = join(hermesHome, "cache");

	for (const dir of [hermesHome, projectsDir, binDir, logsDir, cacheDir]) {
		if (!existsSync(dir)) {
			try {
				mkdirSync(dir, { recursive: true });
			} catch (err) {
				log.warn(`Falha ao criar diretório Hermes: ${dir}`, { error: String(err) });
			}
		}
	}

	const activeFile = join(hermesHome, "active_projects.json");
	if (!existsSync(activeFile)) {
		try {
			writeFileSync(activeFile, JSON.stringify({ activeSlugs: [] }, null, 2), "utf8");
			log.info(`Arquivo active_projects.json inicializado em: ${activeFile}`);
		} catch (err) {
			log.warn(`Falha ao criar active_projects.json: ${err}`);
		}
	}

	// Se germes.exe não estiver no bin/ do Hermes, tenta copiar dos locais de distribuição
	const targetGermesExe = join(binDir, "germes.exe");
	if (!existsSync(targetGermesExe)) {
		const candidate = resolveGermesExecutable();
		if (candidate && existsSync(candidate) && resolve(candidate) !== resolve(targetGermesExe)) {
			try {
				copyFileSync(candidate, targetGermesExe);
				log.info(`germes.exe copiado com sucesso para: ${targetGermesExe}`);
			} catch (err) {
				log.warn(`Não foi possível copiar germes.exe para ${targetGermesExe}: ${err}`);
			}
		}
	}

	return { hermesHome, projectsDir, binDir };
}

export function resolveGermesExecutable(): string | null {
	const userProfile = homedir();
	const candidates = [
		join(dirname(process.execPath), "germes.exe"),
		join(process.cwd(), "apps", "cli", "dist", "germes.exe"),
		join(process.cwd(), "dist", "germes.exe"),
		join(process.cwd(), "germes.exe"),
		"D:/Projet_Thinkrail/source/thinkrail/apps/cli/dist/germes.exe",
		"D:/Projeto_Germes/hermes-3.0/dist/germes.exe",
		join(userProfile, ".hermes", "bin", "germes.exe"),
		...(process.env.APPDATA ? [join(process.env.APPDATA, "hermes", "bin", "germes.exe")] : []),
		...(process.env.LOCALAPPDATA
			? [join(process.env.LOCALAPPDATA, "hermes", "bin", "germes.exe")]
			: []),
	];

	for (const candidate of candidates) {
		try {
			if (existsSync(candidate)) {
				return resolve(candidate);
			}
		} catch {}
	}
	return null;
}

export function resolveRunnerScript(): string | null {
	const candidates = [
		join(process.cwd(), "apps", "cli", "scripts", "hermes-mcp-server.ts"),
		"D:/Projet_Thinkrail/source/thinkrail/apps/cli/scripts/hermes-mcp-server.ts",
		join(dirname(process.execPath), "..", "scripts", "hermes-mcp-server.ts"),
	];

	for (const candidate of candidates) {
		try {
			if (existsSync(candidate)) {
				return resolve(candidate);
			}
		} catch {}
	}
	return null;
}

export function resolveReindexScript(): string | null {
	const candidates = [
		join(process.cwd(), "scripts", "rag-reindex.ts"),
		"D:/Projet_Thinkrail/source/thinkrail/scripts/rag-reindex.ts",
		join(dirname(process.execPath), "..", "..", "scripts", "rag-reindex.ts"),
		join(dirname(process.execPath), "scripts", "rag-reindex.ts"),
	];

	for (const candidate of candidates) {
		try {
			if (existsSync(candidate)) {
				return resolve(candidate);
			}
		} catch {}
	}
	return null;
}

let activeIndexingProgress: HermesIndexingProgress = {
	isIndexing: false,
	projectSlug: null,
	processedFiles: 0,
	totalFiles: 0,
	percentage: 0,
	startTime: null,
	elapsedMs: 0,
	estimatedRemainingMs: null,
	status: "idle",
};

export function getHermesIndexingProgress(): HermesIndexingProgress {
	if (activeIndexingProgress.isIndexing && activeIndexingProgress.startTime) {
		const now = Date.now();
		const elapsed = now - activeIndexingProgress.startTime;
		let remaining: number | null = null;
		if (
			activeIndexingProgress.processedFiles > 0 &&
			activeIndexingProgress.totalFiles > activeIndexingProgress.processedFiles
		) {
			const rate = elapsed / activeIndexingProgress.processedFiles;
			remaining = Math.round(
				rate * (activeIndexingProgress.totalFiles - activeIndexingProgress.processedFiles),
			);
		}
		return {
			...activeIndexingProgress,
			elapsedMs: elapsed,
			estimatedRemainingMs: remaining,
		};
	}
	return activeIndexingProgress;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function listHermesProjects(): HermesListProjectsResult {
	const hermesHome = resolveHermesHome();
	const projectsDir = join(hermesHome, "projects");

	if (!existsSync(projectsDir)) {
		return { hermesHome, projects: [] };
	}

	const entries = readdirSync(projectsDir, { withFileTypes: true });
	const projects: HermesProjectInfo[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const slug = entry.name;
		const projectDir = join(projectsDir, slug);

		let workspacePath = "";
		const workspaceFile = join(projectDir, "workspace.path");
		if (existsSync(workspaceFile)) {
			try {
				workspacePath = readFileSync(workspaceFile, "utf8").trim();
			} catch {
				workspacePath = "";
			}
		}

		const dbPath = join(projectDir, "hermes.db");
		const hasDb = existsSync(dbPath);
		let dbSizeBytes: number | undefined;
		let dbSizeFormatted: string | undefined;
		let lastModifiedMs: number | undefined;

		if (hasDb) {
			try {
				const st = statSync(dbPath);
				dbSizeBytes = st.size;
				dbSizeFormatted = formatBytes(st.size);
				lastModifiedMs = st.mtimeMs;
			} catch {
				dbSizeFormatted = "DB presente";
			}
		}

		const hasActiveSession = existsSync(join(projectDir, "session_working.json"));
		const hasVectorsJson = existsSync(join(projectDir, "vectors.json"));

		let files: string[] = [];
		try {
			files = readdirSync(projectDir).slice(0, 30);
		} catch {
			files = [];
		}

		const name = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

		projects.push({
			slug,
			name,
			path: workspacePath || projectDir,
			hermesHome,
			projectDir,
			hasDb,
			dbSizeBytes,
			dbSizeFormatted,
			hasActiveSession,
			hasVectorsJson,
			files,
			lastModifiedMs,
		});
	}

	// Ordenar: primeiro com sessão ativa, depois com DB, depois alfabético
	projects.sort((a, b) => {
		if (a.hasActiveSession !== b.hasActiveSession) {
			return a.hasActiveSession ? -1 : 1;
		}
		if (a.hasDb !== b.hasDb) {
			return a.hasDb ? -1 : 1;
		}
		return a.slug.localeCompare(b.slug);
	});

	return { hermesHome, projects };
}

export function canonicalizeProjectPath(rawPath: string): string {
	if (!rawPath || typeof rawPath !== "string") return "";
	let resolved = rawPath.trim();
	try {
		if (existsSync(resolved)) {
			resolved = realpathSync(resolved);
		}
	} catch {}
	resolved = resolve(resolved).replace(/\\/g, "/");
	if (/^[a-zA-Z]:\//.test(resolved)) {
		resolved = (resolved[0]?.toLowerCase() ?? "") + resolved.slice(1);
	}
	if (resolved.length > 3 && resolved.endsWith("/")) {
		resolved = resolved.slice(0, -1);
	}
	// No Windows caminhos de arquivo são case-insensitive
	if (process.platform === "win32") {
		resolved = resolved.toLowerCase();
	}
	return resolved;
}

export function ensureHermesDatabaseSchema(dbPath: string, projectName: string): void {
	if (existsSync(dbPath)) {
		return;
	}
	try {
		const dir = dirname(dbPath);
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { Database } = require("bun:sqlite");
		const db = new Database(dbPath);
		db.run("PRAGMA journal_mode = WAL;");
		db.run("PRAGMA busy_timeout = 30000;");
		db.run("PRAGMA foreign_keys = ON;");

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
		db.close();
		log.info(`Schema Hermes DB criado com sucesso para [${projectName}] em: ${dbPath}`);
	} catch (err) {
		log.error(`Erro ao criar schema Hermes DB em ${dbPath}: ${err}`);
	}
}

export function createHermesProject(input: HermesCreateProjectInput): HermesProjectInfo {
	const { hermesHome } = ensureHermesEnvironment();
	const cleanSlug = input.slug
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9-_]/g, "-");
	if (!cleanSlug) {
		throw new Error("O slug do projeto Hermes não pode ser vazio.");
	}

	const projectDir = join(hermesHome, "projects", cleanSlug);
	if (!existsSync(projectDir)) {
		mkdirSync(projectDir, { recursive: true });
	}

	const workspaceFile = join(projectDir, "workspace.path");
	writeFileSync(workspaceFile, input.path.trim(), "utf8");

	const dbPath = join(projectDir, "hermes.db");
	ensureHermesDatabaseSchema(dbPath, cleanSlug);

	const name = input.name.trim() || cleanSlug;
	log.info(`Projeto Hermes criado: ${cleanSlug} -> ${input.path}`);

	return {
		slug: cleanSlug,
		name,
		path: input.path.trim(),
		hermesHome,
		projectDir,
		hasDb: existsSync(dbPath),
		hasActiveSession: false,
		hasVectorsJson: false,
		files: ["workspace.path", ...(existsSync(dbPath) ? ["hermes.db"] : [])],
		lastModifiedMs: Date.now(),
	};
}

export function deleteHermesProject(input: HermesDeleteProjectInput): Ack {
	const hermesHome = resolveHermesHome();
	const cleanSlug = input.slug.toLowerCase().trim();
	const projectDir = join(hermesHome, "projects", cleanSlug);

	if (!existsSync(projectDir)) {
		return { ok: true };
	}

	try {
		rmSync(projectDir, { recursive: true, force: true });
		log.info(`Projeto Hermes removido com sucesso: ${cleanSlug}`);
	} catch (err) {
		log.error(`Falha ao remover projeto Hermes ${cleanSlug}: ${err}`);
		throw new Error(`Não foi possível remover o diretório do projeto: ${err}`);
	}

	return { ok: true };
}

export async function reindexHermesProject(
	input: HermesReindexProjectInput,
): Promise<HermesReindexResult> {
	const startTime = Date.now();
	const hermesHome = resolveHermesHome();
	const projectDir = join(hermesHome, "projects", input.slug);

	if (!existsSync(projectDir)) {
		throw new Error(`Projeto Hermes "${input.slug}" não foi encontrado.`);
	}

	let targetPath = input.path?.trim();
	if (!targetPath) {
		const workspaceFile = join(projectDir, "workspace.path");
		if (existsSync(workspaceFile)) {
			targetPath = readFileSync(workspaceFile, "utf8").trim();
		}
	}

	if (!targetPath) {
		targetPath = projectDir;
	}

	const dbPath = join(projectDir, "hermes.db");
	log.info(`Iniciando reindexação Hermes para [${input.slug}] no caminho: ${targetPath}`);

	// Inicializa o progresso no singleton do host
	activeIndexingProgress = {
		isIndexing: true,
		projectSlug: input.slug,
		processedFiles: 0,
		totalFiles: 0,
		percentage: 0,
		startTime,
		elapsedMs: 0,
		estimatedRemainingMs: null,
		currentFile: "Varrendo arquivos elegíveis...",
		status: "scanning",
	};

	// Executa o script incremental inteligente rag-reindex.ts em subprocesso Bun
	const reindexScript = resolveReindexScript();
	const userHome = process.env.USERPROFILE || "";
	const bunCandidate = join(
		userHome,
		"AppData",
		"Roaming",
		"npm",
		"node_modules",
		"bun",
		"bin",
		"bun.exe",
	);
	const bunExe = existsSync(bunCandidate) ? bunCandidate : "bun";

	if (reindexScript) {
		try {
			const proc = spawn(
				bunExe,
				["run", reindexScript, "--project", input.slug, "--db", dbPath, "--workspace", targetPath],
				{
					cwd: targetPath,
					env: {
						...process.env,
						HERMES_PROJECT: input.slug,
						HERMES_WORKSPACE_ROOT: targetPath,
					},
					stdio: ["ignore", "pipe", "pipe"],
					windowsHide: true,
				},
			);

			let stdoutBuffer = "";
			proc.stdout?.on("data", (chunk: Buffer) => {
				stdoutBuffer += chunk.toString("utf-8");
				const lines = stdoutBuffer.split("\n");
				stdoutBuffer = lines.pop() || "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (trimmed.startsWith("PROGRESS:")) {
						const parts = trimmed.split(":");
						const rawProc = parts[1];
						const rawTotal = parts[2];
						if (parts.length >= 4 && rawProc !== undefined && rawTotal !== undefined) {
							const processed = parseInt(rawProc, 10);
							const total = parseInt(rawTotal, 10);
							const file = parts.slice(3).join(":");
							const elapsed = Date.now() - startTime;
							const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
							let remaining: number | null = null;
							if (processed > 0 && total > processed) {
								const rate = elapsed / processed;
								remaining = Math.round(rate * (total - processed));
							}

							activeIndexingProgress = {
								isIndexing: true,
								projectSlug: input.slug,
								processedFiles: processed,
								totalFiles: total,
								percentage: pct,
								startTime,
								elapsedMs: elapsed,
								estimatedRemainingMs: remaining,
								currentFile: file,
								status: "indexing",
							};
						}
					}
				}
			});

			proc.on("close", (code) => {
				const totalElapsed = Date.now() - startTime;
				if (code === 0) {
					log.info(`Reindexação Hermes para [${input.slug}] concluída em ${totalElapsed}ms`);
					activeIndexingProgress = {
						...activeIndexingProgress,
						isIndexing: false,
						percentage: 100,
						elapsedMs: totalElapsed,
						estimatedRemainingMs: 0,
						currentFile: undefined,
						status: "completed",
					};
					// Transiciona para idle após 4 segundos para evitar loop infinito de polling
					setTimeout(() => {
						if (activeIndexingProgress.status === "completed") {
							activeIndexingProgress = {
								...activeIndexingProgress,
								status: "idle",
								isIndexing: false,
							};
						}
					}, 4000);
				} else {
					log.warn(`Reindexação Hermes para [${input.slug}] finalizada com código ${code}`);
					activeIndexingProgress = {
						...activeIndexingProgress,
						isIndexing: false,
						status: "error",
						error: `Processo finalizado com código ${code}`,
					};
					setTimeout(() => {
						if (activeIndexingProgress.status === "error") {
							activeIndexingProgress = {
								...activeIndexingProgress,
								status: "idle",
								isIndexing: false,
							};
						}
					}, 6000);
				}
			});

			proc.on("error", (err) => {
				log.error(`Erro ao disparar processo de reindexação Hermes: ${err}`);
				activeIndexingProgress = {
					...activeIndexingProgress,
					isIndexing: false,
					status: "error",
					error: err.message,
				};
			});
		} catch (err) {
			log.error(`Exceção ao disparar runner: ${err}`);
			activeIndexingProgress = {
				...activeIndexingProgress,
				isIndexing: false,
				status: "error",
				error: String(err),
			};
		}
	}

	return {
		success: true,
		message: `Reindexação iniciada para o projeto ${input.slug}. Progresso em tempo real ativo.`,
		projectSlug: input.slug,
		elapsedMs: Date.now() - startTime,
	};
}

const pendingEnsureProjectPromises = new Map<string, Promise<HermesEnsureProjectForPathResult>>();

export function addActiveHermesProject(slug: string): void {
	const current = getActiveHermesProjects();
	const cleanSlug = slug.trim().toLowerCase();
	if (!current.activeSlugs.includes(cleanSlug)) {
		setActiveHermesProjects({
			slugs: [...current.activeSlugs, cleanSlug],
		});
	}
}

export async function ensureHermesProjectForPath(
	input: HermesEnsureProjectForPathInput,
): Promise<HermesEnsureProjectForPathResult> {
	const rawPath = input.path?.trim();
	if (!rawPath) {
		throw new Error("O caminho (path) do projeto não pode ser vazio.");
	}

	const canonicalPath = canonicalizeProjectPath(rawPath);
	if (!canonicalPath) {
		throw new Error(`Caminho de projeto inválido: ${rawPath}`);
	}

	// Lock atômico por caminho canônico para evitar race conditions
	const existingPromise = pendingEnsureProjectPromises.get(canonicalPath);
	if (existingPromise) {
		return existingPromise;
	}

	let resolvePromise!: (val: HermesEnsureProjectForPathResult) => void;
	let rejectPromise!: (err: unknown) => void;
	const promise = new Promise<HermesEnsureProjectForPathResult>((res, rej) => {
		resolvePromise = res;
		rejectPromise = rej;
	});

	pendingEnsureProjectPromises.set(canonicalPath, promise);

	(async () => {
		try {
			ensureHermesEnvironment();

			// 1. Varre todos os projetos existentes procurando match exato de path canônico
			const { projects } = listHermesProjects();
			const matchedProject = projects.find((p) => {
				const pCanonical = canonicalizeProjectPath(p.path);
				return pCanonical === canonicalPath;
			});

			if (matchedProject) {
				// Projeto JÁ EXISTE e está registrado!
				addActiveHermesProject(matchedProject.slug);

				const shouldAutoIndex = input.autoIndex !== false;
				const isCurrentlyIndexing =
					activeIndexingProgress.isIndexing &&
					activeIndexingProgress.projectSlug === matchedProject.slug;

				if (shouldAutoIndex && !matchedProject.hasDb && !isCurrentlyIndexing) {
					// Dispara indexação em background sem bloquear o retorno
					void reindexHermesProject({
						slug: matchedProject.slug,
						path: rawPath,
					}).catch((err) => {
						log.error(`Erro ao disparar auto-indexação para [${matchedProject.slug}]: ${err}`);
					});
				}

				resolvePromise({
					slug: matchedProject.slug,
					name: matchedProject.name,
					path: rawPath,
					isNewlyCreated: false,
					isAlreadyIndexed: matchedProject.hasDb,
					isIndexing: isCurrentlyIndexing || (!matchedProject.hasDb && shouldAutoIndex),
					dbSizeBytes: matchedProject.dbSizeBytes,
					message: `Projeto já registrado no Hermes RAG: ${matchedProject.slug}`,
				});
				return;
			}

			// 2. Projeto INÉDITO: Gerar slug único sem colisão
			const folderName = basename(canonicalPath) || "project";
			let baseSlug = (input.name || folderName)
				.toLowerCase()
				.trim()
				.replace(/[^a-z0-9-_]/g, "-")
				.replace(/-+/g, "-");
			if (!baseSlug || baseSlug === "-") {
				baseSlug = "project";
			}

			// Previne colisão se o slug já for usado por OUTRO caminho
			let uniqueSlug = baseSlug;
			let counter = 2;
			const existingSlugs = new Set(projects.map((p) => p.slug));
			while (existingSlugs.has(uniqueSlug)) {
				uniqueSlug = `${baseSlug}-${counter}`;
				counter++;
			}

			const displayName = input.name?.trim() || folderName;
			log.info(`Registrando novo projeto Hermes: ${uniqueSlug} para ${rawPath}`);

			// Cria o projeto e o schema do banco
			createHermesProject({
				slug: uniqueSlug,
				name: displayName,
				path: rawPath,
			});

			// Ativa no active_projects.json
			addActiveHermesProject(uniqueSlug);

			const shouldAutoIndex = input.autoIndex !== false;
			if (shouldAutoIndex) {
				void reindexHermesProject({
					slug: uniqueSlug,
					path: rawPath,
				}).catch((err) => {
					log.error(`Erro ao disparar indexação inicial para [${uniqueSlug}]: ${err}`);
				});
			}

			resolvePromise({
				slug: uniqueSlug,
				name: displayName,
				path: rawPath,
				isNewlyCreated: true,
				isAlreadyIndexed: false,
				isIndexing: shouldAutoIndex,
				message: `Projeto registrado com sucesso no Hermes RAG: ${uniqueSlug}`,
			});
		} catch (err) {
			rejectPromise(err);
		} finally {
			pendingEnsureProjectPromises.delete(canonicalPath);
		}
	})();

	return promise;
}

export function getActiveHermesProjects(): HermesGetActiveProjectsResult {
	const hermesHome = resolveHermesHome();
	const projectsDir = join(hermesHome, "projects");
	const activeFile = join(hermesHome, "active_projects.json");
	if (existsSync(activeFile)) {
		try {
			const content = readFileSync(activeFile, "utf8");
			const data = JSON.parse(content) as { activeSlugs?: string[] };
			if (Array.isArray(data.activeSlugs) && data.activeSlugs.length > 0) {
				// Higienização: remove slugs órfãos cujo diretório não existe mais em projects/
				const validSlugs = data.activeSlugs.filter((s) => {
					const slug = s.trim().toLowerCase();
					return slug.length > 0 && existsSync(join(projectsDir, slug));
				});
				if (validSlugs.length > 0) {
					if (validSlugs.length !== data.activeSlugs.length) {
						try {
							writeFileSync(
								activeFile,
								JSON.stringify({ activeSlugs: validSlugs }, null, 2),
								"utf8",
							);
							log.info(
								`Slugs órfãos removidos de active_projects.json: ${data.activeSlugs
									.filter((s) => !validSlugs.includes(s))
									.join(", ")}`,
							);
						} catch {}
					}
					return { activeSlugs: validSlugs };
				}
			}
		} catch {}
	}
	return { activeSlugs: ["project-thinkrail"] };
}

export function setActiveHermesProjects(
	input: HermesSetActiveProjectsInput,
): HermesGetActiveProjectsResult {
	const hermesHome = resolveHermesHome();
	const activeFile = join(hermesHome, "active_projects.json");
	const cleanSlugs = (input.slugs || []).map((s) => s.trim().toLowerCase()).filter(Boolean);
	const activeSlugs = cleanSlugs.length > 0 ? cleanSlugs : ["project-thinkrail"];
	try {
		writeFileSync(activeFile, JSON.stringify({ activeSlugs }, null, 2), "utf8");
		log.info(`Projetos Hermes ativos atualizados: ${activeSlugs.join(", ")}`);
	} catch (err) {
		log.error(`Falha ao salvar active_projects.json: ${err}`);
	}
	return { activeSlugs };
}

let isAutoStartingJina = false;

export async function ensureJinaEmbeddingsServer(): Promise<boolean> {
	const embeddingsUrl = process.env.EMBEDDINGS_URL || "http://127.0.0.1:9085/api/embeddings";
	let jinaBaseUrl = "http://127.0.0.1:9085";
	try {
		const u = new URL(embeddingsUrl);
		jinaBaseUrl = `${u.protocol}//${u.host}`;
	} catch {
		jinaBaseUrl = "http://127.0.0.1:9085";
	}

	// 1. Checa se já está respondendo
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 1200);
		const res = await fetch(`${jinaBaseUrl}/health`, {
			method: "GET",
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		if (res.ok) return true;
	} catch {}

	if (isAutoStartingJina) return false;
	isAutoStartingJina = true;

	try {
		// Procura start_embeddings.bat em locais conhecidos do Hermes
		const candidates = [
			"D:\\Projeto_Germes\\hermes-3.0\\start_embeddings.bat",
			"D:\\Projeto_Germes\\hermes-2.0\\start_embeddings.bat",
		];
		let batPath = "";
		for (const cand of candidates) {
			if (existsSync(cand)) {
				batPath = cand;
				break;
			}
		}

		if (batPath) {
			const hermesDir = dirname(batPath);
			log.info(`[Auto-Start] Disparando Jina Embeddings via ${batPath}...`);
			if (process.platform === "win32") {
				spawn("cmd.exe", ["/c", "start", "/min", batPath], {
					cwd: hermesDir,
					detached: true,
					stdio: "ignore",
				});
			} else {
				spawn(batPath, [], {
					cwd: hermesDir,
					detached: true,
					stdio: "ignore",
				});
			}

			// Aguarda até 3 segundos para que o servidor suba
			for (let i = 0; i < 6; i++) {
				await new Promise((r) => setTimeout(r, 500));
				try {
					const controller = new AbortController();
					const timeoutId = setTimeout(() => controller.abort(), 1000);
					const res = await fetch(`${jinaBaseUrl}/health`, {
						method: "GET",
						signal: controller.signal,
					});
					clearTimeout(timeoutId);
					if (res.ok) {
						log.info("[Auto-Start] Servidor Jina Embeddings iniciado com sucesso!");
						return true;
					}
				} catch {}
			}
		}
	} catch (err) {
		log.error(`[Auto-Start] Falha ao disparar Jina Embeddings: ${err}`);
	} finally {
		isAutoStartingJina = false;
	}

	return false;
}

export async function testHermesConnection(
	_input?: HermesTestConnectionInput,
): Promise<HermesConnectionStatus> {
	const timestamp = Date.now();

	// Auto-inicializa Jina Embeddings em background se estiver offline
	await ensureJinaEmbeddingsServer().catch(() => false);

	// 1. Testa Servidor Jina Embeddings
	const embeddingsUrl = process.env.EMBEDDINGS_URL || "http://127.0.0.1:9085/api/embeddings";
	let jinaBaseUrl = "http://127.0.0.1:9085";
	try {
		const u = new URL(embeddingsUrl);
		jinaBaseUrl = `${u.protocol}//${u.host}`;
	} catch {
		jinaBaseUrl = "http://127.0.0.1:9085";
	}

	let jinaActive = false;
	let jinaLatencyMs: number | undefined;
	let jinaStatusText = "Não iniciado (offline)";

	const jinaStart = Date.now();
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 2000);
		const res = await fetch(`${jinaBaseUrl}/health`, {
			method: "GET",
			signal: controller.signal,
		});
		clearTimeout(timeoutId);
		jinaLatencyMs = Date.now() - jinaStart;
		if (res.ok) {
			jinaActive = true;
			const data = (await res.json().catch(() => ({}))) as { provider?: string; gpu?: boolean };
			const gpuInfo = data.gpu ? " (GPU DirectML ativo)" : "";
			jinaStatusText = `Online e respondendo${gpuInfo}`;
		} else {
			jinaStatusText = `Resposta HTTP ${res.status}`;
		}
	} catch (err: unknown) {
		jinaLatencyMs = Date.now() - jinaStart;
		const msg = err instanceof Error ? err.message : String(err);
		jinaStatusText = msg.includes("aborted")
			? "Timeout de conexão (>2s)"
			: "Inacessível na porta 9085";
	}

	// 2. Testa Servidor Hermes MCP
	let mcpConnected = false;
	let mcpLatencyMs: number | undefined;
	let mcpStatusText = "Não configurado";
	let toolsCount: number | undefined;
	const mcpServerName = "hermes-rag";

	const mcpStart = Date.now();
	try {
		const germesPath = resolveGermesExecutable();
		const runnerPath = resolveRunnerScript();

		if (!germesPath && !runnerPath) {
			mcpStatusText = "Binário germes.exe não encontrado em apps/cli/dist";
		} else {
			const probeResult = await new Promise<{ ok: boolean; toolsCount?: number; error?: string }>(
				(resolvePromise) => {
					const userHome = process.env.USERPROFILE || "";
					const bunCandidate = join(
						userHome,
						"AppData",
						"Roaming",
						"npm",
						"node_modules",
						"bun",
						"bin",
						"bun.exe",
					);
					const hasBun = existsSync(bunCandidate) || existsSync("bun");
					const bunExe = existsSync(bunCandidate) ? bunCandidate : "bun";

					let cmd: string;
					let args: string[];

					if (runnerPath && hasBun) {
						cmd = bunExe;
						args = ["run", runnerPath];
					} else if (germesPath) {
						cmd = germesPath;
						args = ["mcp"];
					} else {
						resolvePromise({ ok: false, error: "Nenhum executável viável para o Hermes MCP" });
						return;
					}

					const targetWorkspace =
						process.env.HERMES_WORKSPACE_ROOT ||
						(existsSync("D:/Projet_Thinkrail/source/thinkrail")
							? "D:/Projet_Thinkrail/source/thinkrail"
							: process.cwd());

					const proc = spawn(cmd, args, {
						cwd: targetWorkspace,
						env: {
							...process.env,
							HERMES_PROJECT: "project-thinkrail",
							HERMES_WORKSPACE_ROOT: targetWorkspace,
						},
						stdio: ["pipe", "pipe", "ignore"],
						windowsHide: true,
					});

					let stdoutData = "";
					const timer = setTimeout(() => {
						proc.kill();
						resolvePromise({ ok: false, error: "Timeout ao inicializar handshake MCP (>3s)" });
					}, 3000);

					proc.stdout?.on("data", (chunk: Buffer) => {
						stdoutData += chunk.toString("utf-8");
						const lines = stdoutData.split("\n");
						for (const line of lines) {
							const trimmed = line.trim();
							if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
								try {
									const parsed = JSON.parse(trimmed) as {
										id?: number;
										result?: { serverInfo?: unknown; tools?: unknown[] };
									};
									if (parsed.id === 1 && parsed.result?.serverInfo) {
										proc.stdin?.write(
											JSON.stringify({
												jsonrpc: "2.0",
												id: 2,
												method: "tools/list",
												params: {},
											}) + "\n",
										);
									} else if (parsed.id === 2 && Array.isArray(parsed.result?.tools)) {
										clearTimeout(timer);
										proc.kill();
										resolvePromise({ ok: true, toolsCount: parsed.result.tools.length });
										return;
									}
								} catch {}
							}
						}
					});

					proc.on("error", (err) => {
						clearTimeout(timer);
						resolvePromise({ ok: false, error: err.message });
					});

					proc.stdin?.write(
						JSON.stringify({
							jsonrpc: "2.0",
							id: 1,
							method: "initialize",
							params: {
								protocolVersion: "2024-11-05",
								capabilities: {},
								clientInfo: { name: "probe", version: "1.0" },
							},
						}) + "\n",
					);
				},
			);

			mcpLatencyMs = Date.now() - mcpStart;
			if (probeResult.ok) {
				mcpConnected = true;
				toolsCount = probeResult.toolsCount ?? 30;
				mcpStatusText = `Conectado e operacional (${toolsCount} ferramentas ativas)`;
			} else {
				mcpStatusText = probeResult.error || "Falha na inicialização do protocolo MCP";
			}
		}
	} catch (err: unknown) {
		mcpLatencyMs = Date.now() - mcpStart;
		mcpStatusText = err instanceof Error ? err.message : String(err);
	}

	// 3. Testa e audita cada Projeto Ativo listado para o RAG
	const { activeSlugs } = getActiveHermesProjects();
	const hermesHome = resolveHermesHome();
	const activeProjects: HermesActiveProjectStatus[] = [];

	for (const slug of activeSlugs) {
		const projectDir = join(hermesHome, "projects", slug);
		const dbPath = join(projectDir, "hermes.db");
		let workspacePath = "";
		const wsFile = join(projectDir, "workspace.path");
		if (existsSync(wsFile)) {
			try {
				workspacePath = readFileSync(wsFile, "utf8").trim();
			} catch {}
		}

		if (!existsSync(projectDir)) {
			activeProjects.push({
				slug,
				name: slug,
				path: workspacePath || projectDir,
				hasDb: false,
				status: "error",
				errorMessage: "Diretório do projeto não encontrado",
			});
			continue;
		}

		if (!existsSync(dbPath)) {
			activeProjects.push({
				slug,
				name: slug,
				path: workspacePath || projectDir,
				hasDb: false,
				status: "missing_db",
				errorMessage: "Banco hermes.db ausente. Execute indexação.",
			});
			continue;
		}

		let dbSizeBytes: number | undefined;
		let dbSizeFormatted: string | undefined;
		let chunksCount: number | undefined;
		try {
			const st = statSync(dbPath);
			dbSizeBytes = st.size;
			dbSizeFormatted = formatBytes(st.size);

			try {
				const { Database } = await import("bun:sqlite");
				const db = new Database(dbPath, { readonly: true });
				const row = db.query("SELECT count(*) as cnt FROM l2j_chunks").get() as { cnt?: number };
				chunksCount = row?.cnt ?? 0;
				db.close();
			} catch {}
		} catch {
			dbSizeFormatted = "Erro ao inspecionar DB";
		}

		activeProjects.push({
			slug,
			name: slug,
			path: workspacePath || projectDir,
			hasDb: true,
			dbSizeBytes,
			dbSizeFormatted,
			chunksCount,
			status: "ok",
		});
	}

	const allProjectsOk = activeProjects.length > 0 && activeProjects.every((p) => p.status === "ok");
	const overallSuccess = jinaActive && mcpConnected && allProjectsOk;

	return {
		jinaActive,
		jinaUrl: `${jinaBaseUrl}/health`,
		jinaLatencyMs,
		jinaStatusText,
		mcpConnected,
		mcpServerName,
		mcpLatencyMs,
		mcpStatusText,
		toolsCount,
		activeProjects,
		activeProjectsCount: activeProjects.length,
		overallSuccess,
		timestamp,
	};
}

/**
 * Retorna amostra representativa de nós e arestas semânticas do banco vetorial
 * dos projetos ativos para visualização geométrica 3D no Neural Core.
 * Organiza os polígonos em disposição semântica tipo 'louça' (bandeja/prato aberto sem oclusão),
 * garantindo espaçamento anti-colisão e visibilidade desimpedida de cada nó.
 */
export async function getHermesVectorGraph(
	params: HermesGetVectorGraphInput,
): Promise<HermesVectorGraphSample> {
	const hermesHome = resolveHermesHome();
	const active = await getActiveHermesProjects();
	const targetSlugs = params.projectSlug
		? [params.projectSlug]
		: active.activeSlugs.length > 0
			? active.activeSlugs
			: ["project-thinkrail"];

	const primarySlug = targetSlugs[0] || "project-thinkrail";

	interface RawChunkRow {
		id: string;
		path: string;
		qualified_name?: string | undefined;
		chunk_kind?: string | undefined;
		token_estimate?: number | undefined;
		snippet?: string | undefined;
		vector_blob: Uint8Array;
		projectSlug: string;
	}

	interface RawMethodRow {
		id: string;
		path: string;
		qualified_name?: string | undefined;
		chunk_kind?: string | undefined;
		token_estimate?: number | undefined;
		snippet?: string | undefined;
	}

	const collectedRows: RawChunkRow[] = [];
	const methodsByPath = new Map<string, RawMethodRow[]>();
	let totalChunks = 0;
	let totalEmbeddings = 0;

	const targetLimit = Math.min(180, Math.max(24, params.limit || 100));
	const perProjectLimit = Math.max(12, Math.floor(targetLimit / targetSlugs.length));

	try {
		const { Database } = await import("bun:sqlite");

		for (const slug of targetSlugs) {
			const dbPath = join(hermesHome, "projects", slug, "hermes.db");
			if (!existsSync(dbPath)) continue;

			try {
				const db = new Database(dbPath, { readonly: true });
				const totalChunksRow = db.query("SELECT count(*) as c FROM l2j_chunks").get() as {
					c?: number;
				};
				const totalEmbeddingsRow = db
					.query("SELECT count(*) as c FROM l2j_embeddings_cache")
					.get() as { c?: number };
				totalChunks += totalChunksRow?.c ?? 0;
				totalEmbeddings += totalEmbeddingsRow?.c ?? 0;

				// Busca ultrarrápida de chunks estruturais chave (6ms) sem table scan nem temp b-tree
				const rows = db
					.query(`
					SELECT rowid, id, path, qualified_name, chunk_kind, token_estimate,
					       substr(content, 1, 140) as snippet
					FROM l2j_chunks
					WHERE chunk_kind IN ('class', 'interface', 'struct', 'document', 'function')
					LIMIT ?;
				`)
					.all(perProjectLimit) as Array<{
					rowid: number;
					id: string;
					path: string;
					qualified_name?: string;
					chunk_kind?: string;
					token_estimate?: number;
					snippet?: string;
				}>;

				// Busca os blobs separadamente por rowid (rápido, sem full scan)
				if (rows.length > 0) {
					const rowids = rows.map((r) => r.rowid);
					const ph = rowids.map(() => "?").join(",");
					const blobRows = db
						.query(`SELECT rowid, vector_blob FROM l2j_embeddings_cache WHERE rowid IN (${ph})`)
						.all(...rowids) as Array<{ rowid: number; vector_blob: Uint8Array }>;
					const blobByRowid = new Map<number, Uint8Array>();
					for (const b of blobRows) blobByRowid.set(b.rowid, b.vector_blob);

					for (const r of rows) {
						const blob = blobByRowid.get(r.rowid);
						if (!blob) continue;
						collectedRows.push({
							id: r.id,
							path: r.path,
							qualified_name: r.qualified_name,
							chunk_kind: r.chunk_kind,
							token_estimate: r.token_estimate,
							snippet: r.snippet,
							vector_blob: blob,
							projectSlug: slug,
						});
					}
				}

				const uniquePaths = Array.from(new Set(rows.map((r) => r.path)));
				if (uniquePaths.length > 0) {
					const pathPlaceholders = uniquePaths.map(() => "?").join(", ");
					const methodRows = db
						.query(`
						SELECT id, path, qualified_name, chunk_kind, token_estimate, substr(content, 1, 120) as snippet
						FROM l2j_chunks
						WHERE chunk_kind IN ('method', 'function', 'constructor')
						  AND path IN (${pathPlaceholders})
						ORDER BY token_estimate DESC;
					`)
						.all(...uniquePaths) as RawMethodRow[];

					for (const m of methodRows) {
						const list = methodsByPath.get(m.path) || [];
						if (list.length < 8) {
							list.push(m);
							methodsByPath.set(m.path, list);
						}
					}
				}

				db.close();
			} catch (projErr) {
				log.warn(`Erro ao ler banco hermes.db do projeto [${slug}]: ${projErr}`);
			}
		}

		if (collectedRows.length === 0) {
			return {
				projectSlug: primarySlug,
				nodes: [],
				edges: [],
				totalChunks,
				totalEmbeddings,
				modules: [],
			};
		}

		// Projeção n-dimensional -> 3D usando projeção ortonormal determinística com proporção áurea.
		// Suporta robustamente qualquer dimensionalidade (ex: 384, 512, 768, 1024, 1536) e trata
		// possíveis desalinhamentos de memória no Uint8Array sem lançar RangeError.
		const extractFloatVector = (uint8: Uint8Array): Float32Array => {
			if (!uint8 || uint8.byteLength < 4) {
				return new Float32Array(0);
			}
			try {
				const count = Math.floor(uint8.byteLength / 4);
				const isAligned = uint8.byteOffset % 4 === 0;
				if (isAligned && uint8.buffer.byteLength >= uint8.byteOffset + count * 4) {
					return new Float32Array(uint8.buffer, uint8.byteOffset, count);
				}
				const copy = new Uint8Array(uint8);
				return new Float32Array(copy.buffer, 0, count);
			} catch {
				return new Float32Array(0);
			}
		};

		const rawCoords: Array<[number, number, number]> = [];
		const vectors: Float32Array[] = [];

		for (let rowIdx = 0; rowIdx < collectedRows.length; rowIdx++) {
			const r = collectedRows[rowIdx]!;
			const vec = extractFloatVector(r.vector_blob);
			vectors.push(vec);

			let x = 0;
			let y = 0;
			let z = 0;
			const vLen = vec.length;
			if (vLen > 0) {
				for (let i = 0; i < vLen; i++) {
					const val = vec[i]!;
					x += val * Math.sin(i * 1.6180339887);
					y += val * Math.cos(i * 2.7182818284);
					z += val * Math.sin(i * 3.1415926535);
				}
			} else {
				// Fallback determinístico caso o blob de embedding seja vazio
				x = Math.sin(rowIdx * 1.6180339887);
				y = Math.cos(rowIdx * 2.7182818284);
				z = Math.sin(rowIdx * 3.1415926535);
			}
			rawCoords.push([x, y, z]);
		}

		// Função auxiliar para detectar linguagem de arquivo
		const detectLanguage = (filePath: string): string => {
			const lower = filePath.toLowerCase();
			if (lower.endsWith(".java")) return "java";
			if (lower.endsWith(".kt")) return "kotlin";
			if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
			if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
			if (lower.endsWith(".md") || lower.endsWith(".txt")) return "markdown";
			if (
				lower.endsWith(".json") ||
				lower.endsWith(".yaml") ||
				lower.endsWith(".yml") ||
				lower.endsWith(".toml")
			)
				return "config";
			if (
				lower.endsWith(".bat") ||
				lower.endsWith(".sh") ||
				lower.endsWith(".cmd") ||
				lower.endsWith(".ps1")
			)
				return "script";
			if (lower.endsWith(".rs")) return "rust";
			if (lower.endsWith(".py")) return "python";
			if (lower.endsWith(".go")) return "go";
			return "code";
		};

		const moduleSet = new Set<string>();
		const preliminaryNodes: Array<{
			id: string;
			path: string;
			relPath: string;
			qualifiedName: string;
			chunkKind: string;
			module: string;
			language: string;
			tokenEstimate: number;
			contentSnippet: string;
			orbitLayer: number;
			pos: [number, number, number];
			methods: Array<any>;
		}> = [];

		// Mapeia módulos semânticos
		const categorizedItems = collectedRows.map((r, i) => {
			const normalizedPath = r.path.replace(/\\/g, "/");
			const lang = detectLanguage(normalizedPath);
			let mod = "core";
			let layer = 2;

			if (
				normalizedPath.includes("/packages/contracts") ||
				normalizedPath.includes("/domain") ||
				r.chunk_kind === "interface"
			) {
				mod = "contracts";
				layer = 1;
			} else if (
				normalizedPath.includes("/packages/server") ||
				normalizedPath.includes("/br/com/hermes") ||
				normalizedPath.includes("/agent/") ||
				normalizedPath.includes("/rag/")
			) {
				mod = "packages/server";
				layer = 2;
			} else if (normalizedPath.includes("/apps/web")) {
				mod = "apps/web";
				layer = 3;
			} else if (normalizedPath.includes("/packages/ui")) {
				mod = "packages/ui";
				layer = 2;
			} else if (normalizedPath.includes("/scripts/")) {
				mod = "scripts";
				layer = 3;
			} else if (normalizedPath.includes("/extensions/")) {
				mod = "extensions";
				layer = 3;
			}

			// Se multi-projeto, prefixa com slug do projeto
			if (targetSlugs.length > 1) {
				mod = `${r.projectSlug}:${mod}`;
			}
			moduleSet.add(mod);

			return { r, index: i, mod, layer, lang, normalizedPath };
		});

		// Agrupa itens por módulo para ordenação e layout harmonioso em "Louça" (Dish / Tray layout)
		// Em vez de esferas concêntricas densas onde nós ficam na frente uns dos outros na mesma linha de visada,
		// organizamos como peças de louça dispostas sobre uma bandeja convexa elíptica aberta (plano suave XZ com leve curvatura Y).
		const itemsByModule = new Map<string, typeof categorizedItems>();
		for (const it of categorizedItems) {
			const list = itemsByModule.get(it.mod) || [];
			list.push(it);
			itemsByModule.set(it.mod, list);
		}

		const moduleNames = Array.from(itemsByModule.keys());
		const totalModules = moduleNames.length;

		// Raio e proporções da bandeja (dish)
		const dishBaseRadius = 2.4;
		const dishSectorAngle = (Math.PI * 2) / Math.max(1, totalModules);

		for (let mIdx = 0; mIdx < totalModules; mIdx++) {
			const modName = moduleNames[mIdx]!;
			const items = itemsByModule.get(modName)!;
			const clusterAngle = mIdx * dishSectorAngle;

			// Centro do setor do módulo na bandeja
			const clusterDist = dishBaseRadius * (0.65 + (mIdx % 2) * 0.25);
			const clusterCenterX = Math.cos(clusterAngle) * clusterDist;
			const clusterCenterZ = Math.sin(clusterAngle) * clusterDist;

			const nItems = items.length;
			const goldenRatio = 1.6180339887;

			for (let itemIdx = 0; itemIdx < nItems; itemIdx++) {
				const it = items[itemIdx]!;
				const r = it.r;

				// Distribuição tipo phyllotaxis (girassol/louça) dentro de cada setor do prato
				// Garante que cada item tenha raio radial crescente e ângulo sem colisão frontal
				const spiralRadius = 0.32 * Math.sqrt(itemIdx + 0.5);
				const spiralAngle = clusterAngle + itemIdx * goldenRatio * Math.PI * 2;

				const [rx, ry, rz] = rawCoords[it.index]!;
				const normEmb = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
				const semOffX = (rx / normEmb) * 0.12;
				const semOffZ = (rz / normEmb) * 0.12;

				const px = clusterCenterX + Math.cos(spiralAngle) * spiralRadius + semOffX;
				const pz = clusterCenterZ + Math.sin(spiralAngle) * spiralRadius + semOffZ;

				// Elevação suave tipo "louça côncava" (Y eleva-se levemente com a distância do centro)
				const distFromCenter = Math.sqrt(px * px + pz * pz);
				// Tigela/prato suave: nós no centro são mais baixos, bordas sobem levemente
				const py = distFromCenter * distFromCenter * 0.08 - 0.45 + (ry / normEmb) * 0.14;

				const relPath = it.normalizedPath.split("/").slice(-2).join("/");

				const rawMethods = methodsByPath.get(r.path) || [];
				const childMethods = rawMethods.map((m, cmIdx) => {
					const totalM = rawMethods.length;
					const angle = (cmIdx / Math.max(1, totalM)) * Math.PI * 2;
					const simpleName = (m.qualified_name || "").split(".").pop() || "fn";
					return {
						id: m.id,
						name: simpleName,
						kind: (m.chunk_kind as any) || "method",
						signature: m.qualified_name || simpleName,
						tokenEstimate: m.token_estimate || 0,
						contentSnippet: (m.snippet || "").trim(),
						orbitAngle: angle,
						orbitRadius: 0.18 + (cmIdx % 2) * 0.04,
					};
				});

				preliminaryNodes.push({
					id: r.id,
					path: r.path,
					relPath,
					qualifiedName: r.qualified_name || relPath,
					chunkKind: r.chunk_kind || "code",
					module: it.mod,
					language: it.lang,
					tokenEstimate: r.token_estimate || 0,
					contentSnippet: (r.snippet || "").trim(),
					orbitLayer: it.layer,
					pos: [px, py, pz],
					methods: childMethods,
				});
			}
		}

		// Relaxação anti-colisão em 2.5D com restrição de separação mínima no plano da louça
		// Garante que nenhum polígono fique em cima ou logo atrás de outro
		const minSafeDist2D = 0.46; // Distância mínima estrita no plano XZ
		const minSafeDist3D = 0.42;
		const relaxationIterations = 24;

		for (let iter = 0; iter < relaxationIterations; iter++) {
			for (let i = 0; i < preliminaryNodes.length; i++) {
				const n1 = preliminaryNodes[i]!;
				for (let j = i + 1; j < preliminaryNodes.length; j++) {
					const n2 = preliminaryNodes[j]!;

					const dx = n2.pos[0] - n1.pos[0];
					const dz = n2.pos[2] - n1.pos[2];
					const dist2D = Math.sqrt(dx * dx + dz * dz) || 0.0001;

					if (dist2D < minSafeDist2D) {
						const overlap2D = (minSafeDist2D - dist2D) * 0.5;
						const nx = (dx / dist2D) * overlap2D;
						const nz = (dz / dist2D) * overlap2D;

						n1.pos[0] -= nx;
						n1.pos[2] -= nz;
						n2.pos[0] += nx;
						n2.pos[2] += nz;
					}

					const dy = n2.pos[1] - n1.pos[1];
					const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
					if (dist3D < minSafeDist3D) {
						const overlap3D = (minSafeDist3D - dist3D) * 0.35;
						const ny = (dy / dist3D) * overlap3D;
						n1.pos[1] -= ny;
						n2.pos[1] += ny;
					}
				}
			}
		}

		const nodes: HermesVectorNode[] = preliminaryNodes.map((pn) => ({
			id: pn.id,
			path: pn.path,
			relPath: pn.relPath,
			qualifiedName: pn.qualifiedName,
			chunkKind: pn.chunkKind,
			module: pn.module,
			language: pn.language,
			tokenEstimate: pn.tokenEstimate,
			contentSnippet: pn.contentSnippet,
			orbitLayer: pn.orbitLayer,
			position: pn.pos,
			methods: pn.methods,
		}));

		// Grafo k-NN: similaridade de cosseno entre nós (conecta os 2 vizinhos mais próximos)
		const edges: HermesVectorEdge[] = [];
		const kNeighbors = 2;

		for (let i = 0; i < vectors.length; i++) {
			const v1 = vectors[i]!;
			if (v1.length === 0) continue;
			const sims: Array<{ idx: number; sim: number }> = [];

			for (let j = 0; j < vectors.length; j++) {
				if (i === j) continue;
				const v2 = vectors[j]!;
				if (v2.length === 0) continue;
				const commonLen = Math.min(v1.length, v2.length);
				let dot = 0;
				const step = Math.max(1, Math.floor(commonLen / 96));
				for (let d = 0; d < commonLen; d += step) {
					dot += v1[d]! * v2[d]!;
				}
				sims.push({ idx: j, sim: dot });
			}

			sims.sort((a, b) => b.sim - a.sim);
			for (let k = 0; k < kNeighbors && k < sims.length; k++) {
				const neighbor = sims[k]!;
				if (neighbor.idx > i) {
					edges.push({
						source: i,
						target: neighbor.idx,
						similarity: neighbor.sim,
					});
				}
			}
		}

		return {
			projectSlug: primarySlug,
			nodes,
			edges,
			totalChunks,
			totalEmbeddings,
			modules: Array.from(moduleSet),
		};
	} catch (err) {
		log.warn("getHermesVectorGraph.failed", { error: String(err), projectSlug: primarySlug });
		return {
			projectSlug: primarySlug,
			nodes: [],
			edges: [],
			totalChunks: 0,
			totalEmbeddings: 0,
			modules: [],
		};
	}
}

/**
 * Verifica se os arquivos do workspace de projetos ativos sofreram modificações
 * mais recentes que a data de indexação do banco SQLite (hermes.db) ou hash/mtime.
 */
export async function checkHermesProjectsFreshness(
	_input?: { workspaceId?: string | undefined },
): Promise<HermesCheckFreshnessResult> {
	const timestamp = Date.now();
	const { activeSlugs } = getActiveHermesProjects();
	const hermesHome = resolveHermesHome();
	const results: HermesProjectFreshnessItem[] = [];

	for (const slug of activeSlugs) {
		const projectDir = join(hermesHome, "projects", slug);
		const dbPath = join(projectDir, "hermes.db");
		let workspacePath = "";
		const wsFile = join(projectDir, "workspace.path");
		if (existsSync(wsFile)) {
			try {
				workspacePath = readFileSync(wsFile, "utf8").trim();
			} catch {}
		}

		if (!workspacePath && slug === "project-thinkrail") {
			workspacePath = existsSync("D:/Projet_Thinkrail/source/thinkrail")
				? "D:/Projet_Thinkrail/source/thinkrail"
				: process.cwd();
		} else if (!workspacePath && slug === "cindy") {
			workspacePath = "D:/Cindy/cindy";
		} else if (!workspacePath && slug.includes("hermes")) {
			workspacePath = "D:/Projeto_Germes/hermes-3.0";
		}

		let lastIndexedMs = 0;
		if (existsSync(dbPath)) {
			try {
				const st = statSync(dbPath);
				lastIndexedMs = st.mtimeMs;
			} catch {}
		}

		let isStale = false;
		let changedFilesCount = 0;
		const changedFilesSample: string[] = [];
		let lastFileModifiedMs = 0;

		// Verifica arquivos recentes se o diretório do workspace existe
		if (workspacePath && existsSync(workspacePath)) {
			try {
				const scanExtensions = new Set([
					".ts",
					".tsx",
					".js",
					".jsx",
					".kt",
					".java",
					".py",
					".json",
					".md",
					".css",
				]);
				const ignoreDirs = new Set([
					"node_modules",
					".git",
					"dist",
					".turbo",
					".next",
					".cache",
					".thinkrail",
					".hermes",
					"venv",
					".venv",
					"jina-env",
					"build",
					"out",
				]);

				const stack = [workspacePath];
				let filesChecked = 0;

				while (stack.length > 0 && filesChecked < 800) {
					const currentDir = stack.pop()!;
					let entries: string[] = [];
					try {
						entries = readdirSync(currentDir);
					} catch {
						continue;
					}

					for (const entry of entries) {
						if (entry.startsWith(".") && entry !== ".thinkrail") continue;
						const full = join(currentDir, entry);
						let st;
						try {
							st = statSync(full);
						} catch {
							continue;
						}

						if (st.isDirectory()) {
							if (!ignoreDirs.has(entry) && !entry.includes(".venv") && !entry.includes("env")) {
								stack.push(full);
							}
						} else if (st.isFile()) {
							const dotIdx = entry.lastIndexOf(".");
							const ext = dotIdx !== -1 ? entry.slice(dotIdx).toLowerCase() : "";
							if (scanExtensions.has(ext)) {
								filesChecked++;
								if (st.mtimeMs > lastFileModifiedMs) {
									lastFileModifiedMs = st.mtimeMs;
								}
								// Se o arquivo foi modificado após a última gravação do hermes.db
								// com margem de segurança de 15 segundos
								if (lastIndexedMs > 0 && st.mtimeMs > lastIndexedMs + 15000) {
									isStale = true;
									changedFilesCount++;
									if (changedFilesSample.length < 5) {
										changedFilesSample.push(entry);
									}
								}
							}
						}
					}
				}
			} catch (scanErr) {
				log.warn(`Erro ao verificar frescor do projeto ${slug}: ${scanErr}`);
			}
		}

		// Comando sugerido de reindexação
		let suggestedCommand = `bun scripts/rag-reindex.bat`;
		if (slug === "cindy") {
			suggestedCommand = `scripts\\rag-cindy-reindex.bat`;
		} else if (slug.includes("hermes")) {
			suggestedCommand = `cd D:\\Projeto_Germes\\hermes-3.0 && indexar.bat`;
		}

		results.push({
			slug,
			name: slug,
			path: workspacePath,
			isStale,
			changedFilesCount,
			changedFilesSample,
			lastIndexedMs: lastIndexedMs || undefined,
			lastFileModifiedMs: lastFileModifiedMs || undefined,
			suggestedCommand,
		});
	}

	const anyStale = results.some((r) => r.isStale);

	return {
		timestamp,
		projects: results,
		anyStale,
	};
}

// ---------------------------------------------------------------------------
// Gestão e Busca de Skills via Hermes (GitHub + skills.sh)
// ---------------------------------------------------------------------------

const agentSkillsDir = join(homedir(), ".agents", "skills");
const disabledSkillsDir = join(homedir(), ".agents", "disabled_skills");

export async function findHermesSkills(
	input: HermesFindSkillsInput,
): Promise<HermesFindSkillsResult> {
	const query = input.query.trim();
	const limit = input.limit ?? 10;
	const minStars = input.minStars ?? 50;

	const results: HermesSkillRepoResult[] = [];

	// 1. skills.sh API
	try {
		const encQuery = encodeURIComponent(query);
		const res = await fetch(`https://skills.sh/api/v1/skills/search?q=${encQuery}&limit=${limit}`, {
			headers: { Accept: "application/json", "User-Agent": "thinkrail-hermes/3.0" },
			signal: AbortSignal.timeout(10000),
		});
		if (res.ok) {
			const data: any = await res.json();
			const items = Array.isArray(data) ? data : data?.skills || data?.results || [];
			for (const item of items) {
				if (item.isDuplicate === true || item.isDuplicate === "true") continue;
				const name = item.name || item.slug;
				if (!name) continue;
				const installs = Number(item.installs) || 0;
				results.push({
					fullName: item.source || name,
					description: item.description || name,
					stars: Math.floor(installs / 10),
					url: `https://skills.sh/${item.id || item.slug || ""}`,
					topics: [],
					source: "skills.sh",
					installCmd: item.installUrl ? `npx skills add ${item.installUrl}` : "",
					installs,
				});
			}
		}
	} catch (err) {
		log.warn(`Erro na busca do skills.sh: ${err}`);
	}

	// 2. GitHub Search API
	try {
		const encQuery = encodeURIComponent(`${query} stars:>${minStars}`);
		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "thinkrail-hermes/3.0",
		};
		const ghToken = process.env.GITHUB_TOKEN;
		if (ghToken) headers.Authorization = `token ${ghToken}`;

		const res = await fetch(`https://api.github.com/search/repositories?q=${encQuery}&sort=stars&order=desc&per_page=${limit}`, {
			headers,
			signal: AbortSignal.timeout(12000),
		});
		if (res.ok) {
			const data: any = await res.json();
			const items = data.items || [];
			for (const item of items) {
				results.push({
					fullName: item.full_name,
					description: item.description || "",
					stars: item.stargazers_count || 0,
					url: item.html_url,
					topics: Array.isArray(item.topics) ? item.topics.slice(0, 8) : [],
					source: "github",
					installCmd: `git clone ${item.html_url}`,
					installs: 0,
				});
			}
		}
	} catch (err) {
		log.warn(`Erro na busca do GitHub: ${err}`);
	}

	// Deduplicação e ordenação por estrelas
	const seen = new Set<string>();
	const deduped: HermesSkillRepoResult[] = [];
	for (const r of results) {
		const key = r.fullName.toLowerCase();
		if (!seen.has(key) && r.stars >= minStars) {
			seen.add(key);
			deduped.push(r);
		}
	}
	deduped.sort((a, b) => b.stars - a.stars);

	return {
		query,
		results: deduped.slice(0, limit),
	};
}

function findSkillDirsRecursively(dir: string, depth = 0, maxDepth = 4): string[] {
	if (depth > maxDepth || !existsSync(dir)) return [];
	const results: string[] = [];
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		const hasSkillMd = entries.some((e) => e.isFile() && e.name.toLowerCase() === "skill.md");
		if (hasSkillMd) {
			results.push(dir);
		}
		for (const e of entries) {
			if (e.isDirectory() && !e.name.startsWith(".")) {
				results.push(...findSkillDirsRecursively(join(dir, e.name), depth + 1, maxDepth));
			}
		}
	} catch {}
	return results;
}

function generateAutoSkillMd(cloneDir: string, skillName: string, repoUrl: string): string {
	let description = `Integration and tooling for ${skillName} cloned from ${repoUrl}`;
	let readmeContent = "";

	try {
		const files = readdirSync(cloneDir);
		const readmeName = files.find((f) => /^readme(\.(md|markdown|txt))?$/i.test(f));
		if (readmeName) {
			readmeContent = readFileSync(join(cloneDir, readmeName), "utf8").trim();
			const firstLines = readmeContent
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("[") && !l.startsWith("!"))
				.slice(0, 3)
				.join(" ");
			if (firstLines) {
				description = firstLines.slice(0, 200).replace(/"/g, "'");
			}
		}
	} catch {}

	let detectedStack = "Generic CLI / Script repository";
	let usageHint = "Examine repo files or run main script via bash/python.";

	try {
		const files = readdirSync(cloneDir);
		if (files.includes("pyproject.toml") || files.includes("requirements.txt") || files.includes("setup.py")) {
			detectedStack = "Python";
			usageHint = "Use Python/pip/uv to execute package tools, scripts or import the module.";
		} else if (files.includes("package.json")) {
			detectedStack = "Node.js / Bun / TypeScript";
			usageHint = "Use bun/npm to run scripts, CLI commands or import modules.";
		} else if (files.includes("Cargo.toml")) {
			detectedStack = "Rust";
			usageHint = "Compile or run using cargo run/build.";
		}
	} catch {}

	const excerpt = readmeContent ? readmeContent.slice(0, 1500) : "No README provided.";

	return [
		"---",
		`name: ${skillName}`,
		`description: ${description}`,
		"---",
		"",
		`# ${skillName}`,
		"",
		`Automated Skill scaffolded by ThinkRail/Hermes from [${repoUrl}](${repoUrl}).`,
		"",
		"## Environment & Stack",
		`- **Type**: ${detectedStack}`,
		`- **Repository URL**: ${repoUrl}`,
		`- **Local Path**: Resolved via skill folder`,
		"",
		"## How to Use this Skill",
		usageHint,
		"",
		"Whenever interacting with this tool:",
		"1. Inspect the source repository files in this skill directory using bash/read tools.",
		"2. Run scripts or CLI commands directly in the skill folder when needed.",
		"",
		"## Repository Overview (README Excerpt)",
		"```markdown",
		excerpt,
		"```",
		"",
	].join("\n");
}

export async function installHermesSkill(
	input: HermesInstallSkillInput,
): Promise<HermesInstallSkillResult> {
	const cleanUrl = input.repoUrl.trim().replace(/\/+$/, "");
	if (!cleanUrl) {
		return { success: false, message: "URL do repositório inválida." };
	}

	const rawName = cleanUrl.split("/").pop()?.replace(/\.git$/, "") || `skill_${Date.now()}`;
	const safeRepoName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
	const tmpCloneDir = join(homedir(), `.thinkrail_skill_tmp_${safeRepoName}_${Date.now()}`);

	try {
		const cloneProc = Bun.spawnSync(["git", "clone", "--depth", "1", cleanUrl, tmpCloneDir], {
			timeout: 60000,
		});
		if (!cloneProc.success) {
			const errText = cloneProc.stderr.toString("utf-8");
			return { success: false, message: `Erro ao clonar repositório: ${errText}` };
		}

		const skillDirs = findSkillDirsRecursively(tmpCloneDir);
		let targetDir = tmpCloneDir;
		let isAutoScaffolded = false;

		if (skillDirs.length > 0) {
			targetDir = skillDirs[0];
			const requestedSkill = input.skillName?.trim();
			if (requestedSkill) {
				const matched = skillDirs.find((d) => basename(d).toLowerCase().includes(requestedSkill.toLowerCase()));
				if (matched) targetDir = matched;
			}
		} else {
			// Auto-scaffolding: cria SKILL.md diretamente no repositório clonado
			isAutoScaffolded = true;
			const effectiveName = (input.skillName?.trim() || safeRepoName).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
			const scaffoldedContent = generateAutoSkillMd(tmpCloneDir, effectiveName, cleanUrl);
			writeFileSync(join(tmpCloneDir, "SKILL.md"), scaffoldedContent, "utf8");
		}

		const requestedSkill = input.skillName?.trim();
		const finalSkillName = (requestedSkill || (isAutoScaffolded ? safeRepoName : basename(targetDir)))
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "-");

		if (!existsSync(agentSkillsDir)) {
			mkdirSync(agentSkillsDir, { recursive: true });
		}
		const destPath = join(agentSkillsDir, finalSkillName);

		if (existsSync(destPath)) {
			rmSync(tmpCloneDir, { recursive: true, force: true });
			return {
				success: false,
				message: `A skill '${finalSkillName}' já está instalada em ${destPath}.`,
			};
		}

		const { cpSync } = await import("node:fs");
		cpSync(targetDir, destPath, { recursive: true });
		rmSync(tmpCloneDir, { recursive: true, force: true });

		let message = `Skill '${finalSkillName}' instalada com sucesso em ~/.agents/skills/${finalSkillName}`;
		if (isAutoScaffolded) {
			message += "\n✨ SKILL.md inteligente foi gerado automaticamente com documentação, stack detectada e instruções operacionais!";
		}

		return {
			success: true,
			message,
			skillName: finalSkillName,
			destPath,
		};
	} catch (err: any) {
		if (existsSync(tmpCloneDir)) {
			rmSync(tmpCloneDir, { recursive: true, force: true });
		}
		return {
			success: false,
			message: `Falha ao instalar skill: ${err?.message || err}`,
		};
	}
}

export function manageHermesSkills(
	input: HermesManageSkillsInput,
): HermesManageSkillsResult {
	if (!existsSync(agentSkillsDir)) {
		mkdirSync(agentSkillsDir, { recursive: true });
	}
	if (!existsSync(disabledSkillsDir)) {
		mkdirSync(disabledSkillsDir, { recursive: true });
	}

	switch (input.action) {
		case "list": {
			const activeEntries: HermesInstalledSkill[] = readdirSync(agentSkillsDir, { withFileTypes: true })
				.filter((e) => e.isDirectory() && existsSync(join(agentSkillsDir, e.name, "SKILL.md")))
				.map((e) => {
					let description = "";
					let declaredName = e.name;
					const skillMdPath = join(agentSkillsDir, e.name, "SKILL.md");
					try {
						const skillMd = readFileSync(skillMdPath, "utf-8");
						const nameMatch = skillMd.match(/^name:\s*["']?([^"'\n]+)["']?/im);
						if (nameMatch && nameMatch[1]) declaredName = nameMatch[1].trim();
						const descMatch = skillMd.match(/^description:\s*["']?([^"'\n]+)["']?/im);
						if (descMatch && descMatch[1]) description = descMatch[1].trim();
					} catch {}
					return {
						name: declaredName,
						folderName: e.name,
						active: true,
						path: join(agentSkillsDir, e.name),
						skillMdPath,
						description,
					};
				});

			const disabledEntries: HermesInstalledSkill[] = readdirSync(disabledSkillsDir, { withFileTypes: true })
				.filter((e) => e.isDirectory() && existsSync(join(disabledSkillsDir, e.name, "SKILL.md")))
				.map((e) => {
					let description = "";
					let declaredName = e.name;
					const skillMdPath = join(disabledSkillsDir, e.name, "SKILL.md");
					try {
						const skillMd = readFileSync(skillMdPath, "utf-8");
						const nameMatch = skillMd.match(/^name:\s*["']?([^"'\n]+)["']?/im);
						if (nameMatch && nameMatch[1]) declaredName = nameMatch[1].trim();
						const descMatch = skillMd.match(/^description:\s*["']?([^"'\n]+)["']?/im);
						if (descMatch && descMatch[1]) description = descMatch[1].trim();
					} catch {}
					return {
						name: declaredName,
						folderName: e.name,
						active: false,
						path: join(disabledSkillsDir, e.name),
						skillMdPath,
						description,
					};
				});

			const all = [...activeEntries, ...disabledEntries].sort((a, b) => a.name.localeCompare(b.name));
			return {
				success: true,
				message: `${all.length} skills encontradas (${activeEntries.length} ativas).`,
				skills: all,
			};
		}

		case "disable": {
			if (!input.skillName) return { success: false, message: "Nome da skill obrigatório.", skills: [] };
			const key = input.skillName;
			// Procura pelo nome da pasta direto ou pelo nome declarado
			let targetFolder = key;
			if (!existsSync(join(agentSkillsDir, targetFolder))) {
				const found = readdirSync(agentSkillsDir, { withFileTypes: true })
					.filter((e) => e.isDirectory())
					.find((e) => {
						try {
							const md = readFileSync(join(agentSkillsDir, e.name, "SKILL.md"), "utf-8");
							const m = md.match(/^name:\s*["']?([^"'\n]+)["']?/im);
							return m && m[1].trim() === key;
						} catch { return false; }
					});
				if (found) targetFolder = found.name;
			}
			const curPath = join(agentSkillsDir, targetFolder);
			if (!existsSync(curPath)) {
				return { success: false, message: `Skill '${input.skillName}' não encontrada em skills ativas.`, skills: [] };
			}
			const dest = join(disabledSkillsDir, targetFolder);
			if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
			const { renameSync } = require("node:fs");
			renameSync(curPath, dest);
			return {
				success: true,
				message: `Skill '${input.skillName}' desativada com sucesso.`,
				skills: [],
			};
		}

		case "enable": {
			if (!input.skillName) return { success: false, message: "Nome da skill obrigatório.", skills: [] };
			const key = input.skillName;
			let targetFolder = key;
			if (!existsSync(join(disabledSkillsDir, targetFolder))) {
				const found = readdirSync(disabledSkillsDir, { withFileTypes: true })
					.filter((e) => e.isDirectory())
					.find((e) => {
						try {
							const md = readFileSync(join(disabledSkillsDir, e.name, "SKILL.md"), "utf-8");
							const m = md.match(/^name:\s*["']?([^"'\n]+)["']?/im);
							return m && m[1].trim() === key;
						} catch { return false; }
					});
				if (found) targetFolder = found.name;
			}
			const curPath = join(disabledSkillsDir, targetFolder);
			if (!existsSync(curPath)) {
				return { success: false, message: `Skill '${input.skillName}' não encontrada em skills desativadas.`, skills: [] };
			}
			const dest = join(agentSkillsDir, targetFolder);
			if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
			const { renameSync } = require("node:fs");
			renameSync(curPath, dest);
			return {
				success: true,
				message: `Skill '${input.skillName}' ativada com sucesso.`,
				skills: [],
			};
		}

		case "remove": {
			if (!input.skillName) return { success: false, message: "Nome da skill obrigatório.", skills: [] };
			const key = input.skillName;
			let activeTarget = key;
			if (!existsSync(join(agentSkillsDir, activeTarget))) {
				const found = readdirSync(agentSkillsDir, { withFileTypes: true })
					.filter((e) => e.isDirectory())
					.find((e) => {
						try {
							const md = readFileSync(join(agentSkillsDir, e.name, "SKILL.md"), "utf-8");
							const m = md.match(/^name:\s*["']?([^"'\n]+)["']?/im);
							return m && m[1].trim() === key;
						} catch { return false; }
					});
				if (found) activeTarget = found.name;
			}
			let disabledTarget = key;
			if (!existsSync(join(disabledSkillsDir, disabledTarget))) {
				const found = readdirSync(disabledSkillsDir, { withFileTypes: true })
					.filter((e) => e.isDirectory())
					.find((e) => {
						try {
							const md = readFileSync(join(disabledSkillsDir, e.name, "SKILL.md"), "utf-8");
							const m = md.match(/^name:\s*["']?([^"'\n]+)["']?/im);
							return m && m[1].trim() === key;
						} catch { return false; }
					});
				if (found) disabledTarget = found.name;
			}
			const activePath = join(agentSkillsDir, activeTarget);
			const disabledPath = join(disabledSkillsDir, disabledTarget);
			if (existsSync(activePath)) {
				rmSync(activePath, { recursive: true, force: true });
				return { success: true, message: `Skill '${input.skillName}' removida.`, skills: [] };
			} else if (existsSync(disabledPath)) {
				rmSync(disabledPath, { recursive: true, force: true });
				return { success: true, message: `Skill '${input.skillName}' removida.`, skills: [] };
			}
			return { success: false, message: `Skill '${input.skillName}' não encontrada para remoção.`, skills: [] };
		}
		default:
			return { success: false, message: `Ação desconhecida: ${input.action}`, skills: [] };
	}
}

export function readHermesSkill(
	input: { skillName: string; skillMdPath?: string },
): { success: boolean; message?: string; content?: string; skillName: string; skillMdPath: string } {
	let targetPath = input.skillMdPath?.trim();
	if (!targetPath || !existsSync(targetPath)) {
		const activePath = join(agentSkillsDir, input.skillName, "SKILL.md");
		const disabledPath = join(disabledSkillsDir, input.skillName, "SKILL.md");
		if (existsSync(activePath)) targetPath = activePath;
		else if (existsSync(disabledPath)) targetPath = disabledPath;
	}

	if (!targetPath || !existsSync(targetPath)) {
		return {
			success: false,
			message: `Arquivo SKILL.md não encontrado para a skill '${input.skillName}'.`,
			skillName: input.skillName,
			skillMdPath: targetPath || "",
		};
	}

	try {
		const content = readFileSync(targetPath, "utf-8");
		return {
			success: true,
			content,
			skillName: input.skillName,
			skillMdPath: targetPath,
		};
	} catch (err: any) {
		return {
			success: false,
			message: `Erro ao ler SKILL.md: ${err?.message || err}`,
			skillName: input.skillName,
			skillMdPath: targetPath,
		};
	}
}

export function revealHermesSkillFolder(input: { path: string }): { success: boolean; message: string } {
	const folder = input.path?.trim();
	if (!folder || !existsSync(folder)) {
		return { success: false, message: `Pasta não encontrada no disco: ${folder}` };
	}

	try {
		const { revealInFileManager } = require("../editors");
		revealInFileManager(folder);
		return { success: true, message: `Pasta aberta no gerenciador de arquivos: ${folder}` };
	} catch (err: any) {
		return { success: false, message: `Falha ao abrir pasta no gerenciador de arquivos: ${err?.message || err}` };
	}
}

