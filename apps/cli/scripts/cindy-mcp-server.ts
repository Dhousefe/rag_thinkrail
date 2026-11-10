/**
 * Cindy MCP Server para ThinkRail
 * ---------------------------------------------------------------------------
 * Servidor MCP em TypeScript executado com Bun.
 * Fornece ferramentas integradas do Cindy (pesquisa de código no Cindy,
 * gestão de skills, criação de documentos e inspeção de arquitetura).
 * Totalmente compatível com JSON-RPC 2.0 STDIO, sem logs poluindo o STDOUT.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Database } from "bun:sqlite";

const CINDY_ROOT = "D:\\Cindy\\cindy";
const CINDY_DB_PATH = join(homedir(), ".hermes", "projects", "cindy", "hermes.db");
const SKILLS_DIR = join(homedir(), ".agents", "skills");

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number | string;
	method: string;
	params?: any;
}

function sendResponse(id: number | string | null, result: any, isError = false) {
	const payload: any = {
		jsonrpc: "2.0",
		id,
	};
	if (isError) {
		payload.error = result;
	} else {
		payload.result = result;
	}
	process.stdout.write(JSON.stringify(payload) + "\n");
}

const TOOLS = [
	{
		name: "cindy_project_info",
		description:
			"Retorna diagnóstico completo do projeto Cindy (monorepo, pacotes, harness Pi e status do banco RAG).",
		inputSchema: {
			type: "object",
			properties: {},
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "cindy_list_skills",
		description:
			"Lista todas as skills do Cindy disponíveis e ativas no ThinkRail.",
		inputSchema: {
			type: "object",
			properties: {},
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "cindy_search_code",
		description:
			"Busca semântica e full-text cirúrgica no código-fonte indexado do projeto Cindy usando o RAG.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Termo de busca, método, classe ou padrão arquitetural no Cindy.",
				},
				limit: {
					type: "number",
					description: "Limite de resultados (padrão 5).",
				},
			},
			required: ["query"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "cindy_sync_skills",
		description:
			"Sincroniza novamente as skills mais recentes do Cindy para o diretório de skills do ThinkRail (~/.agents/skills).",
		inputSchema: {
			type: "object",
			properties: {},
		},
		annotations: { readOnlyHint: true },
	},
];

function handleCindySearchCode(query: string, limit = 5) {
	if (!existsSync(CINDY_DB_PATH)) {
		return `Banco RAG do Cindy não encontrado em: ${CINDY_DB_PATH}`;
	}
	try {
		const db = new Database(CINDY_DB_PATH, { readonly: true });
		const sanitized = query.replace(/[^\w\s-]/g, " ").trim();
		const rows = db
			.query(
				`
			SELECT path, content 
			FROM l2j_chunk_fts 
			WHERE l2j_chunk_fts MATCH ? 
			LIMIT ?;
		`,
			)
			.all(sanitized, limit) as { path: string; content: string }[];
		db.close();

		if (!rows || rows.length === 0) {
			return `Nenhum resultado encontrado para '${query}' no projeto Cindy.`;
		}

		return rows
			.map(
				(r, idx) =>
					`#${idx + 1} [cindy] ${r.path}:\n${(r.content || "").slice(0, 400)}...\n`,
			)
			.join("\n---\n");
	} catch (err: any) {
		return `Erro na busca RAG do Cindy: ${err.message}`;
	}
}

function handleCindyProjectInfo() {
	let filesCount = 0;
	let chunksCount = 0;
	if (existsSync(CINDY_DB_PATH)) {
		try {
			const db = new Database(CINDY_DB_PATH, { readonly: true });
			const fRow = db.query("SELECT count(*) as c FROM l2j_files").get() as any;
			const cRow = db.query("SELECT count(*) as c FROM l2j_chunks").get() as any;
			filesCount = fRow?.c || 0;
			chunksCount = cRow?.c || 0;
			db.close();
		} catch {}
	}

	return JSON.stringify(
		{
			project: "cindy",
			workspace: CINDY_ROOT,
			dbPath: CINDY_DB_PATH,
			indexedFiles: filesCount,
			indexedChunks: chunksCount,
			features: [
				"Pi Agent Integration (@cindy/maker-pi-manager)",
				"Office Document Authoring (@cindy/mcps/cindy_docs)",
				"Computer & Browser Automation Tools",
				"Continuous Long-Term Memory (Maker Memory)",
				"Bot Packages & Specialized Skills",
			],
		},
		null,
		2,
	);
}

function handleCindyListSkills() {
	if (!existsSync(SKILLS_DIR)) return "Nenhuma skill encontrada em ~/.agents/skills";
	const items = readdirSync(SKILLS_DIR).filter((f) => {
		return existsSync(join(SKILLS_DIR, f, "SKILL.md"));
	});
	return `Skills disponíveis no ThinkRail (${items.length}):\n- ` + items.join("\n- ");
}

// Processamento STDIO linha a linha
let buffer = "";
process.stdin.on("data", (chunk: Buffer) => {
	buffer += chunk.toString("utf-8");
	const lines = buffer.split("\n");
	buffer = lines.pop() || "";

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.startsWith("{")) continue;

		try {
			const req = JSON.parse(trimmed) as JsonRpcRequest;
			if (req.method === "initialize") {
				sendResponse(req.id, {
					protocolVersion: "2024-11-05",
					serverInfo: {
						name: "cindy-tools",
						version: "1.0.0",
					},
					capabilities: {
						tools: {},
					},
				});
			} else if (req.method === "notifications/initialized") {
				// no-op
			} else if (req.method === "tools/list") {
				sendResponse(req.id, {
					tools: TOOLS,
				});
			} else if (req.method === "tools/call") {
				const toolName = req.params?.name;
				const args = req.params?.arguments || {};
				let resultText = "";

				if (toolName === "cindy_project_info") {
					resultText = handleCindyProjectInfo();
				} else if (toolName === "cindy_list_skills") {
					resultText = handleCindyListSkills();
				} else if (toolName === "cindy_search_code") {
					resultText = handleCindySearchCode(args.query, args.limit);
				} else if (toolName === "cindy_sync_skills") {
					const proc = Bun.spawnSync(["bun", "scripts/cindy-sync-skills.ts"]);
					resultText = proc.stdout.toString("utf-8");
				} else {
					sendResponse(
						req.id,
						{
							code: -32601,
							message: `Tool não encontrada: ${toolName}`,
						},
						true,
					);
					continue;
				}

				sendResponse(req.id, {
					content: [
						{
							type: "text",
							text: resultText,
						},
					],
				});
			} else {
				sendResponse(req.id, {});
			}
		} catch (err: any) {
			process.stderr.write(`[cindy-mcp-server] Erro: ${err.message}\n`);
		}
	}
});
