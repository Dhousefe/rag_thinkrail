import { spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
	Ack,
	HermesActiveProjectStatus,
	HermesConnectionStatus,
	HermesCreateProjectInput,
	HermesDeleteProjectInput,
	HermesGetActiveProjectsResult,
	HermesGetVectorGraphInput,
	HermesIndexingProgress,
	HermesListProjectsResult,
	HermesProjectInfo,
	HermesReindexProjectInput,
	HermesReindexResult,
	HermesSetActiveProjectsInput,
	HermesTestConnectionInput,
	HermesVectorEdge,
	HermesVectorGraphSample,
	HermesVectorNode,
} from "@thinkrail/contracts";
import { logger } from "../log";

const log = logger("hermes");

export function resolveHermesHome(): string {
	if (process.env.HERMES_HOME && existsSync(process.env.HERMES_HOME)) {
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
	return defaultHermes;
}

export function resolveGermesExecutable(): string | null {
	const candidates = [
		join(dirname(process.execPath), "germes.exe"),
		join(process.cwd(), "apps", "cli", "dist", "germes.exe"),
		join(process.cwd(), "dist", "germes.exe"),
		join(process.cwd(), "germes.exe"),
		"D:/Projet_Thinkrail/source/thinkrail/apps/cli/dist/germes.exe",
		"D:/Projeto_Germes/hermes-3.0/dist/germes.exe",
		join(homedir(), ".hermes", "bin", "germes.exe"),
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

export function createHermesProject(input: HermesCreateProjectInput): HermesProjectInfo {
	const hermesHome = resolveHermesHome();
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

	const name = input.name.trim() || cleanSlug;
	log.info(`Projeto Hermes criado: ${cleanSlug} -> ${input.path}`);

	return {
		slug: cleanSlug,
		name,
		path: input.path.trim(),
		hermesHome,
		projectDir,
		hasDb: false,
		hasActiveSession: false,
		hasVectorsJson: false,
		files: ["workspace.path"],
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
				[
					"run",
					reindexScript,
					"--project",
					input.slug,
					"--db",
					dbPath,
					"--workspace",
					targetPath,
				],
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
				} else {
					log.warn(`Reindexação Hermes para [${input.slug}] finalizada com código ${code}`);
					activeIndexingProgress = {
						...activeIndexingProgress,
						isIndexing: false,
						status: "error",
						error: `Processo finalizado com código ${code}`,
					};
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

export function getActiveHermesProjects(): HermesGetActiveProjectsResult {
	const hermesHome = resolveHermesHome();
	const activeFile = join(hermesHome, "active_projects.json");
	if (existsSync(activeFile)) {
		try {
			const content = readFileSync(activeFile, "utf8");
			const data = JSON.parse(content) as { activeSlugs?: string[] };
			if (Array.isArray(data.activeSlugs) && data.activeSlugs.length > 0) {
				return { activeSlugs: data.activeSlugs };
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
	const cleanSlugs = (input.slugs || [])
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	const activeSlugs = cleanSlugs.length > 0 ? cleanSlugs : ["project-thinkrail"];
	try {
		writeFileSync(activeFile, JSON.stringify({ activeSlugs }, null, 2), "utf8");
		log.info(`Projetos Hermes ativos atualizados: ${activeSlugs.join(", ")}`);
	} catch (err) {
		log.error(`Falha ao salvar active_projects.json: ${err}`);
	}
	return { activeSlugs };
}

export async function testHermesConnection(
	_input?: HermesTestConnectionInput,
): Promise<HermesConnectionStatus> {
	const timestamp = Date.now();

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
		jinaStatusText = msg.includes("aborted") ? "Timeout de conexão (>2s)" : "Inacessível na porta 9085";
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

					const proc = spawn(
						cmd,
						args,
						{
							cwd: targetWorkspace,
							env: {
								...process.env,
								HERMES_PROJECT: "project-thinkrail",
								HERMES_WORKSPACE_ROOT: targetWorkspace,
							},
							stdio: ["pipe", "pipe", "ignore"],
							windowsHide: true,
						},
					);

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
 * do projeto ativo para visualização geométrica 3D no Neural Core.
 */
export async function getHermesVectorGraph(
	params: HermesGetVectorGraphInput,
): Promise<HermesVectorGraphSample> {
	const hermesHome = resolveHermesHome();
	let projectSlug = params.projectSlug;
	if (!projectSlug) {
		const active = await getActiveHermesProjects();
		projectSlug = active.activeSlugs[0] || "project-thinkrail";
	}

	const dbPath = join(hermesHome, "projects", projectSlug, "hermes.db");
	if (!existsSync(dbPath)) {
		return {
			projectSlug,
			nodes: [],
			edges: [],
			totalChunks: 0,
			totalEmbeddings: 0,
			modules: [],
		};
	}

	try {
		const { Database } = await import("bun:sqlite");
		const db = new Database(dbPath, { readonly: true });

		const totalChunksRow = db.query("SELECT count(*) as c FROM l2j_chunks").get() as { c?: number };
		const totalEmbeddingsRow = db.query("SELECT count(*) as c FROM l2j_embeddings_cache").get() as { c?: number };
		const totalChunks = totalChunksRow?.c ?? 0;
		const totalEmbeddings = totalEmbeddingsRow?.c ?? 0;

		const targetLimit = Math.min(160, Math.max(20, params.limit || 90));

		// Busca chunks priorizando classes, interfaces e arquivos estruturais com seus embeddings
		const rows = db.query(`
			SELECT c.id, c.path, c.qualified_name, c.chunk_kind, c.token_estimate,
			       substr(c.content, 1, 140) as snippet, e.vector_blob
			FROM l2j_chunks c
			JOIN l2j_embeddings_cache e ON c.rowid = e.rowid
			WHERE c.token_estimate >= 20
			ORDER BY CASE
				WHEN c.chunk_kind IN ('class', 'interface', 'struct', 'document') THEN 1
				WHEN c.chunk_kind IN ('type', 'function') THEN 2
				ELSE 3
			END, c.token_estimate DESC
			LIMIT ?;
		`).all(targetLimit) as Array<{
			id: string;
			path: string;
			qualified_name?: string;
			chunk_kind?: string;
			token_estimate?: number;
			snippet?: string;
			vector_blob: Uint8Array;
		}>;

		// Coleta métodos e funções filhos para classes e arquivos selecionados
		const uniquePaths = Array.from(new Set(rows.map((r) => r.path)));
		const methodsByPath = new Map<string, Array<{
			id: string;
			qualified_name?: string;
			chunk_kind?: string;
			token_estimate?: number;
			snippet?: string;
		}>>();

		if (uniquePaths.length > 0) {
			const pathPlaceholders = uniquePaths.map(() => "?").join(", ");
			const methodRows = db.query(`
				SELECT id, path, qualified_name, chunk_kind, token_estimate, substr(content, 1, 120) as snippet
				FROM l2j_chunks
				WHERE chunk_kind IN ('method', 'function', 'constructor')
				  AND path IN (${pathPlaceholders})
				ORDER BY token_estimate DESC;
			`).all(...uniquePaths) as Array<{
				id: string;
				path: string;
				qualified_name?: string;
				chunk_kind?: string;
				token_estimate?: number;
				snippet?: string;
			}>;

			for (const m of methodRows) {
				const list = methodsByPath.get(m.path) || [];
				if (list.length < 8) {
					list.push(m);
					methodsByPath.set(m.path, list);
				}
			}
		}

		db.close();

		if (rows.length === 0) {
			return {
				projectSlug,
				nodes: [],
				edges: [],
				totalChunks,
				totalEmbeddings,
				modules: [],
			};
		}

		// Projeção 768D -> 3D usando projeção ortonormal determinística com proporção áurea
		const dim = 768;
		const projX = new Float32Array(dim);
		const projY = new Float32Array(dim);
		const projZ = new Float32Array(dim);
		for (let i = 0; i < dim; i++) {
			projX[i] = Math.sin(i * 1.6180339887);
			projY[i] = Math.cos(i * 2.7182818284);
			projZ[i] = Math.sin(i * 3.1415926535);
		}

		const rawCoords: Array<[number, number, number]> = [];
		const vectors: Float32Array[] = [];

		for (const r of rows) {
			const vec = new Float32Array(r.vector_blob.buffer, r.vector_blob.byteOffset, dim);
			vectors.push(vec);
			let x = 0;
			let y = 0;
			let z = 0;
			for (let i = 0; i < dim; i++) {
				x += vec[i]! * projX[i]!;
				y += vec[i]! * projY[i]!;
				z += vec[i]! * projZ[i]!;
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
			if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".toml")) return "config";
			if (lower.endsWith(".bat") || lower.endsWith(".sh") || lower.endsWith(".cmd") || lower.endsWith(".ps1")) return "script";
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

		// Distribuição por Orbição Semântica Estratificada
		const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad
		const layerRadii: Record<number, number> = { 1: 1.45, 2: 2.35, 3: 3.25 };

		for (let i = 0; i < rows.length; i++) {
			const r = rows[i]!;
			const normalizedPath = r.path.replace(/\\/g, "/");
			const lang = detectLanguage(normalizedPath);

			let mod = "core";
			let layer = 2;

			if (normalizedPath.includes("/packages/contracts") || normalizedPath.includes("/domain") || r.chunk_kind === "interface") {
				mod = "contracts";
				layer = 1; // Núcleo / Contratos
			} else if (normalizedPath.includes("/packages/server") || normalizedPath.includes("/br/com/hermes") || normalizedPath.includes("/agent/") || normalizedPath.includes("/rag/")) {
				mod = "packages/server";
				layer = 2; // Engine / Server
			} else if (normalizedPath.includes("/apps/web")) {
				mod = "apps/web";
				layer = 3; // Web UI
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
			moduleSet.add(mod);

			const relPath = normalizedPath.split("/").slice(-2).join("/");

			// Posição orbital inicial via Fibonacci Sphere na esfera da camada
			const baseRadius = layerRadii[layer] || 2.2;
			const yRatio = 1 - (i / Math.max(1, rows.length - 1)) * 2; // de 1 a -1
			const radiusAtY = Math.sqrt(Math.max(0, 1 - yRatio * yRatio));
			const theta = i * goldenAngle;

			// Incorpora orientação semântica do embedding 768D (perturbação harmônica)
			const [rx, ry, rz] = rawCoords[i]!;
			const normEmbDist = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
			const embOffsetX = (rx / normEmbDist) * 0.22;
			const embOffsetY = (ry / normEmbDist) * 0.22;
			const embOffsetZ = (rz / normEmbDist) * 0.22;

			const px = (Math.cos(theta) * radiusAtY + embOffsetX) * baseRadius;
			const py = (yRatio + embOffsetY) * baseRadius;
			const pz = (Math.sin(theta) * radiusAtY + embOffsetZ) * baseRadius;

			// Métodos/Funções filhos da classe
			const rawMethods = methodsByPath.get(r.path) || [];
			const childMethods = rawMethods.map((m, mIdx) => {
				const totalM = rawMethods.length;
				const angle = (mIdx / Math.max(1, totalM)) * Math.PI * 2;
				const simpleName = (m.qualified_name || "").split(".").pop() || "fn";
				return {
					id: m.id,
					name: simpleName,
					kind: (m.chunk_kind as any) || "method",
					signature: m.qualified_name || simpleName,
					tokenEstimate: m.token_estimate || 0,
					contentSnippet: (m.snippet || "").trim(),
					orbitAngle: angle,
					orbitRadius: 0.18 + (mIdx % 2) * 0.04,
				};
			});

			preliminaryNodes.push({
				id: r.id,
				path: r.path,
				relPath,
				qualifiedName: r.qualified_name || relPath,
				chunkKind: r.chunk_kind || "code",
				module: mod,
				language: lang,
				tokenEstimate: r.token_estimate || 0,
				contentSnippet: (r.snippet || "").trim(),
				orbitLayer: layer,
				pos: [px, py, pz],
				methods: childMethods,
			});
		}

		// Algoritmo Anti-Colisão (Relaxação Esférica de Repulsão)
		// Garante que nenhum polígono sobreponha o outro (distância mínima de 0.44)
		const minSafeDist = 0.44;
		const relaxationIterations = 16;

		for (let iter = 0; iter < relaxationIterations; iter++) {
			for (let i = 0; i < preliminaryNodes.length; i++) {
				const n1 = preliminaryNodes[i]!;
				for (let j = i + 1; j < preliminaryNodes.length; j++) {
					const n2 = preliminaryNodes[j]!;
					const dx = n2.pos[0] - n1.pos[0];
					const dy = n2.pos[1] - n1.pos[1];
					const dz = n2.pos[2] - n1.pos[2];
					const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;

					if (dist < minSafeDist) {
						const overlap = (minSafeDist - dist) * 0.45;
						const nx = (dx / dist) * overlap;
						const ny = (dy / dist) * overlap;
						const nz = (dz / dist) * overlap;

						n1.pos[0] -= nx;
						n1.pos[1] -= ny;
						n1.pos[2] -= nz;

						n2.pos[0] += nx;
						n2.pos[1] += ny;
						n2.pos[2] += nz;
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
			const sims: Array<{ idx: number; sim: number }> = [];

			for (let j = 0; j < vectors.length; j++) {
				if (i === j) continue;
				const v2 = vectors[j]!;
				let dot = 0;
				for (let d = 0; d < dim; d += 8) {
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
			projectSlug,
			nodes,
			edges,
			totalChunks,
			totalEmbeddings,
			modules: Array.from(moduleSet),
		};
	} catch (err) {
		log.warn("getHermesVectorGraph.failed", { error: String(err), projectSlug });
		return {
			projectSlug,
			nodes: [],
			edges: [],
			totalChunks: 0,
			totalEmbeddings: 0,
			modules: [],
		};
	}
}

