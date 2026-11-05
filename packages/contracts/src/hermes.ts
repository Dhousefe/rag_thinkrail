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
	projectSlug?: string | undefined;
	projectRoot?: string | undefined;
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

export interface HermesProjectFreshnessItem {
	slug: string;
	name: string;
	path: string;
	isStale: boolean;
	changedFilesCount: number;
	changedFilesSample: string[];
	lastIndexedMs?: number | undefined;
	lastFileModifiedMs?: number | undefined;
	suggestedCommand: string;
}

export interface HermesCheckFreshnessResult {
	timestamp: number;
	projects: HermesProjectFreshnessItem[];
	anyStale: boolean;
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

// ---------------------------------------------------------------------------
// Contratos para Descoberta, Instalação e Gestão de Skills do Hermes MCP
// ---------------------------------------------------------------------------

export interface HermesSkillRepoResult {
	fullName: string;
	description: string;
	stars: number;
	url: string;
	topics: string[];
	source: string;
	installCmd: string;
	installs: number;
}

export interface HermesFindSkillsInput {
	query: string;
	limit?: number | undefined;
	minStars?: number | undefined;
}

export interface HermesFindSkillsResult {
	query: string;
	results: HermesSkillRepoResult[];
	formattedText?: string | undefined;
}

export interface HermesInstallSkillInput {
	repoUrl: string;
	skillName?: string | undefined;
}

export interface HermesInstallSkillResult {
	success: boolean;
	message: string;
	skillName?: string | undefined;
	destPath?: string | undefined;
}

export interface HermesInstalledSkill {
	name: string;
	active: boolean;
	path: string;
	folderName?: string | undefined;
	skillMdPath?: string | undefined;
	description?: string | undefined;
}

export interface HermesManageSkillsInput {
	action: "list" | "enable" | "disable" | "remove";
	skillName?: string | undefined;
}

export interface HermesManageSkillsResult {
	success: boolean;
	message: string;
	skills: HermesInstalledSkill[];
}

export interface HermesReadSkillInput {
	skillName: string;
	skillMdPath?: string | undefined;
}

export interface HermesReadSkillResult {
	success: boolean;
	message?: string | undefined;
	content?: string | undefined;
	skillName?: string | undefined;
	skillMdPath?: string | undefined;
}

export interface HermesRevealSkillFolderInput {
	path: string;
}

export interface HermesRevealSkillFolderResult {
	success: boolean;
	message: string;
}
