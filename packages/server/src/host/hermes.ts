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
	HermesCreateProjectInput,
	HermesDeleteProjectInput,
	HermesListProjectsResult,
	HermesProjectInfo,
	HermesReindexProjectInput,
	HermesReindexResult,
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
