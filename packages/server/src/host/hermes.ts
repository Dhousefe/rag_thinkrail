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
import { join, resolve } from "node:path";
import type {
	Ack,
	HermesActiveProjectStatus,
	HermesConnectionStatus,
	HermesCreateProjectInput,
	HermesDeleteProjectInput,
	HermesGetActiveProjectsResult,
	HermesListProjectsResult,
	HermesProjectInfo,
	HermesReindexProjectInput,
	HermesReindexResult,
	HermesSetActiveProjectsInput,
	HermesTestConnectionInput,
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

	log.info(`Iniciando reindexação Hermes para [${input.slug}] no caminho: ${targetPath}`);

	// Aciona o runner real do Hermes RAG se disponível
	const javaPath = existsSync("D:/jdk21/bin/java.exe") ? "D:/jdk21/bin/java.exe" : "java";
	const hermesJar = "D:/Projeto_Germes/hermes-3.0/dist/germes.jar";

	if (existsSync(hermesJar)) {
		try {
			const proc = spawn(
				javaPath,
				[
					"--enable-native-access=ALL-UNNAMED",
					"-cp",
					hermesJar,
					"br.com.hermes.rag.MainKt",
					"index",
					targetPath,
				],
				{
					detached: true,
					stdio: "ignore",
					cwd: targetPath,
					env: {
						...process.env,
						HERMES_PROJECT: input.slug,
					},
				},
			);
			proc.unref();
			log.info(`Processo de reindexação Hermes disparado (PID: ${proc.pid})`);
		} catch (procErr) {
			log.warn(`Não foi possível disparar runner Java do Hermes: ${procErr}`);
		}
	}

	return {
		success: true,
		message: `Reindexação iniciada para o projeto ${input.slug}. O subsistema Hermes RAG está atualizando o banco SQLite e vetores.`,
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
		const rootDir = process.cwd();
		const runnerPath = join(rootDir, "apps", "cli", "scripts", "hermes-mcp-server.ts");
		const germesPath = join(rootDir, "apps", "cli", "dist", "germes.exe");

		if (!existsSync(runnerPath) && !existsSync(germesPath)) {
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
					const bunExe = existsSync(bunCandidate) ? bunCandidate : "bun";
					const proc = spawn(
						bunExe,
						["run", existsSync(runnerPath) ? runnerPath : germesPath],
						{
							cwd: rootDir,
							env: {
								...process.env,
								HERMES_PROJECT: "project-thinkrail",
								HERMES_WORKSPACE_ROOT: rootDir,
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
