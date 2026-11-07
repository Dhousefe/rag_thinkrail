/**
 * Contratos para o servidor nativo e gerenciado Jina Embeddings.
 * Suporta modo híbrido (DirectML GPU AMD RX 580 / CPU Nativo),
 * auto-heal, telemetria de latência e teste de integridade de vetores 768d.
 */

export type JinaServerStatus = "running" | "stopped" | "starting" | "error";

export type JinaEngineMode = "hybrid" | "directml" | "cpu_native";

export interface JinaServerInfo {
	status: JinaServerStatus;
	port: number;
	baseUrl: string;
	activeEngine: string;
	isGpuActive: boolean;
	pid?: number | undefined;
	uptimeMs: number;
	lastLatencyMs?: number | undefined;
	totalRequests: number;
	errorCount: number;
	statusMessage: string;
	autoStartEnabled: boolean;
	mode: JinaEngineMode;
	model: string;
}

export interface JinaStartInput {
	port?: number | undefined;
	mode?: JinaEngineMode | undefined;
}

export interface JinaStopInput {
	force?: boolean | undefined;
}

export interface JinaRestartInput {
	mode?: JinaEngineMode | undefined;
}

export interface JinaIntegrityTestResult {
	success: boolean;
	latencyMs: number;
	dimensions: number;
	isNormalized: boolean;
	normValue?: number | undefined;
	sampleDotProduct?: number | undefined;
	error?: string | undefined;
	provider: string;
	gpu: boolean;
	timestamp: number;
}

export interface JinaGetLogsInput {
	limit?: number | undefined;
}

export interface JinaGetLogsResult {
	logs: string[];
	totalLines: number;
}
