export interface McpCallMetric {
	id: string;
	toolCallId: string;
	server: string;
	tool: string;
	toolName: string;
	startedAt: number;
	endedAt?: number | undefined;
	durationMs?: number | undefined;
	status: "running" | "success" | "error";
	args?: unknown;
	isError?: boolean | undefined;
	errorMessage?: string | undefined;
}

export interface McpTelemetryState {
	metrics: McpCallMetric[];
	activeCalls: Record<
		string,
		{ toolCallId: string; toolName: string; startedAt: number; args?: unknown }
	>;
}

export const INITIAL_MCP_TELEMETRY: McpTelemetryState = {
	metrics: [],
	activeCalls: {},
};

export function recordMcpToolStart(
	state: McpTelemetryState,
	toolCallId: string,
	toolName: string,
	args?: unknown,
	startedAt: number = Date.now(),
): McpTelemetryState {
	return {
		...state,
		activeCalls: {
			...state.activeCalls,
			[toolCallId]: { toolCallId, toolName, startedAt, args },
		},
	};
}

export function recordMcpToolEnd(
	state: McpTelemetryState,
	toolCallId: string,
	toolName: string,
	isError: boolean,
	result?: unknown,
	endedAt: number = Date.now(),
): McpTelemetryState {
	const active = state.activeCalls[toolCallId];
	const startedAt = active?.startedAt ?? endedAt;
	const durationMs = Math.max(0, endedAt - startedAt);

	let server = "";
	let tool = toolName;
	if (toolName.startsWith("mcp__")) {
		const parts = toolName.slice(5).split("__");
		server = parts[0] || "";
		tool = parts.slice(1).join("__") || parts[0] || toolName;
	}

	const nextActive = { ...state.activeCalls };
	delete nextActive[toolCallId];

	const newMetric: McpCallMetric = {
		id: crypto.randomUUID ? crypto.randomUUID() : `${toolCallId}-${endedAt}`,
		toolCallId,
		server,
		tool,
		toolName,
		startedAt,
		endedAt,
		durationMs,
		status: isError ? "error" : "success",
		args: active?.args,
		isError,
		errorMessage: isError && typeof result === "string" ? result : undefined,
	};

	// Keep the latest 200 call metrics
	const metrics = [newMetric, ...state.metrics].slice(0, 200);

	return {
		...state,
		metrics,
		activeCalls: nextActive,
	};
}

export function clearMcpMetrics(
	state: McpTelemetryState,
	serverFilter?: string,
): McpTelemetryState {
	if (!serverFilter) {
		return {
			...state,
			metrics: [],
		};
	}
	return {
		...state,
		metrics: state.metrics.filter((m) => m.server.toLowerCase() !== serverFilter.toLowerCase()),
	};
}
