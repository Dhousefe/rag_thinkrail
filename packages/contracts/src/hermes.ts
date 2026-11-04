/**
 * Contratos para gerenciamento e telemetria de projetos Hermes RAG.
 * Alinhado com a estrutura de ~/.hermes/projects e hermes-tools.bat.
 */

export interface HermesProjectInfo {
	slug: string;
	name: string;
	path: string;
	hermesHome: string;
	projectDir: string;
	hasDb: boolean;
	dbSizeBytes?: number | undefined;
	dbSizeFormatted?: string | undefined;
	hasActiveSession: boolean;
	hasVectorsJson: boolean;
	files: string[];
	lastModifiedMs?: number | undefined;
}

export interface HermesListProjectsResult {
	hermesHome: string;
	projects: HermesProjectInfo[];
}

export interface HermesCreateProjectInput {
	slug: string;
	name: string;
	path: string;
}

export interface HermesEnsureProjectForPathInput {
	path: string;
	name?: string | undefined;
	autoIndex?: boolean | undefined;
}

export interface HermesEnsureProjectForPathResult {
	slug: string;
	name: string;
	path: string;
	isNewlyCreated: boolean;
	isAlreadyIndexed: boolean;
	isIndexing: boolean;
	dbSizeBytes?: number | undefined;
	message: string;
}

export interface HermesDeleteProjectInput {
	slug: string;
}

export interface HermesReindexProjectInput {
	slug: string;
	path?: string | undefined;
}

export interface HermesReindexResult {
	success: boolean;
	message: string;
	projectSlug: string;
	elapsedMs?: number | undefined;
}

export interface HermesTestConnectionInput {
	workspaceId?: string | undefined;
}

export interface HermesActiveProjectStatus {
	slug: string;
	name: string;
	path: string;
	hasDb: boolean;
	dbSizeBytes?: number | undefined;
	dbSizeFormatted?: string | undefined;
	chunksCount?: number | undefined;
	status: "ok" | "missing_db" | "error";
	errorMessage?: string | undefined;
}

export interface HermesConnectionStatus {
	jinaActive: boolean;
	jinaUrl: string;
	jinaLatencyMs?: number | undefined;
	jinaStatusText: string;
	mcpConnected: boolean;
	mcpServerName?: string | undefined;
	mcpLatencyMs?: number | undefined;
	mcpStatusText: string;
	toolsCount?: number | undefined;
	activeProjects: HermesActiveProjectStatus[];
	activeProjectsCount: number;
	overallSuccess: boolean;
	timestamp: number;
}

export interface HermesSetActiveProjectsInput {
	slugs: string[];
}

export interface HermesGetActiveProjectsResult {
	activeSlugs: string[];
}

export interface HermesAstChildSymbol {
	id: string;
	name: string;
	kind: "method" | "function" | "constructor" | "field" | "section";
	signature?: string | undefined;
	startLine?: number | undefined;
	endLine?: number | undefined;
	tokenEstimate?: number | undefined;
	contentSnippet?: string | undefined;
	orbitAngle?: number | undefined;
	orbitRadius?: number | undefined;
}

export interface HermesVectorNode {
	id: string;
	path: string;
	relPath: string;
	qualifiedName: string;
	chunkKind: string;
	module: string;
	position: [number, number, number];
	tokenEstimate: number;
	contentSnippet: string;
	language?: string | undefined;
	methods?: HermesAstChildSymbol[] | undefined;
	orbitLayer?: number | undefined;
}

export interface HermesVectorEdge {
	source: number;
	target: number;
	similarity: number;
}

export interface HermesVectorGraphSample {
	projectSlug: string;
	nodes: HermesVectorNode[];
	edges: HermesVectorEdge[];
	totalChunks: number;
	totalEmbeddings: number;
	modules: string[];
}

export interface HermesGetVectorGraphInput {
	projectSlug?: string | undefined;
	limit?: number | undefined;
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
	status?: "idle" | "scanning" | "indexing" | "completed" | "error" | undefined;
	error?: string | undefined;
}
