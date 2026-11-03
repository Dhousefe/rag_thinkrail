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
	overallSuccess: boolean;
	timestamp: number;
}
