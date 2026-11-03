import type { HermesProjectInfo } from "@thinkrail/contracts";

/**
 * Contratos e tipos para o gerenciamento de projetos e ferramentas Hermes MCP.
 */

export type HermesProject = HermesProjectInfo;

export type HermesToolCategory = "rag" | "analysis" | "delegation" | "workflow" | "diagnostic";

export interface HermesToolDefinition {
	id: string;
	name: string;
	category: HermesToolCategory;
	description: string;
	readOnly: boolean;
	enabled: boolean;
}

export interface HermesIndexingProgress {
	isIndexing: boolean;
	projectSlug: string | null;
	processedFiles: number;
	totalFiles: number;
	percentage: number;
	startTime: number | null;
	elapsedMs: number;
	estimatedRemainingMs: number | null;
	currentFile?: string | undefined;
}

export interface HermesManagementState {
	projects: HermesProjectInfo[];
	isLoading: boolean;
	error: string | null;
	hermesHome: string | null;
	activeProjectSlug: string | null;
	toolToggles: Record<string, boolean>;
	indexingProgress: HermesIndexingProgress;
}

export const DEFAULT_HERMES_TOOLS: HermesToolDefinition[] = [
	{
		id: "mcp__hermes_rag__hermes_project_manager",
		name: "Gerenciador de Projetos",
		category: "rag",
		description:
			"Lista projetos disponíveis ou obtém diagnóstico detalhado de banco SQLite, sessões e status de indexação.",
		readOnly: true,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__hermes_index_code",
		name: "Indexador de Código (RAG)",
		category: "rag",
		description: "Indexa ou re-indexa código-fonte no subsistema RAG (AST + FTS5 + Embeddings).",
		readOnly: false,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__ast_skeleton_tree",
		name: "Árvore Esqueleto AST",
		category: "analysis",
		description:
			"Visão arquitetural compacta: árvore de tipos, classes, métodos públicos e interfaces sem corpos de código.",
		readOnly: true,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__compare_projects",
		name: "Comparador Semântico",
		category: "analysis",
		description:
			"Compara dois projetos via análise semântica e gera relatório detalhado de similaridade.",
		readOnly: true,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__hermes_health_check",
		name: "Diagnóstico de Saúde",
		category: "diagnostic",
		description:
			"Executa diagnóstico do ambiente Hermes (Java, integridade SQLite, FTS5, sqlite-vec, embeddings).",
		readOnly: true,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__delegate_bg",
		name: "Delegação Background",
		category: "delegation",
		description:
			"Dispara subagentes autônomos em background com prioridade e timeout configuráveis.",
		readOnly: false,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__break_into_tickets",
		name: "Decomposição em Tickets",
		category: "workflow",
		description: "Decompõe spec ou PRD em tickets tracer-bullet priorizados com blocking edges.",
		readOnly: true,
		enabled: true,
	},
	{
		id: "mcp__hermes_rag__resolve_conflicts",
		name: "Resolução de Conflitos",
		category: "workflow",
		description: "Resolve conflitos de merge/rebase combinando a intenção de ambos os lados.",
		readOnly: false,
		enabled: true,
	},
];

export const INITIAL_HERMES_MANAGEMENT_STATE: HermesManagementState = {
	projects: [],
	isLoading: false,
	error: null,
	hermesHome: null,
	activeProjectSlug: null,
	toolToggles: Object.fromEntries(DEFAULT_HERMES_TOOLS.map((t) => [t.id, true])),
	indexingProgress: {
		isIndexing: false,
		projectSlug: null,
		processedFiles: 0,
		totalFiles: 0,
		percentage: 0,
		startTime: null,
		elapsedMs: 0,
		estimatedRemainingMs: null,
	},
};
