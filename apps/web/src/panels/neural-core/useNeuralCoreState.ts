import { useEffect, useMemo, useRef, useState } from "react";
import { selectActiveWorkspace, useAppStore } from "@/store";
import type { NeuralActivityState, NeuralTelemetryState } from "./types";

export function useNeuralCoreState() {
	const activeWorkspace = useAppStore(selectActiveWorkspace);
	const mcpMetrics = useAppStore((s) => s.mcpTelemetry.metrics);
	const activeCalls = useAppStore((s) => s.mcpTelemetry.activeCalls);
	const connectionStatus = useAppStore((s) => s.status);

	const lastMetricCountRef = useRef(mcpMetrics.length);
	const [pulseKey, setPulseKey] = useState(0);

	// Detecta atividade geral do ThinkRail
	// Detecta atividade geral do ThinkRail e consultas RAG do Hermes MCP
	const state: NeuralTelemetryState = useMemo(() => {
		let activity: NeuralActivityState = "idle";
		let intensity = 0.0;
		let activeToolName: string | undefined;
		let activeRagQuery: string | undefined;
		let activeRagToolName: string | undefined;
		let isRagSearching = false;
		let toolArgs: any;

		const runningCallKeys = Object.keys(activeCalls);
		if (runningCallKeys.length > 0) {
			const firstKey = runningCallKeys[0];
			if (firstKey && activeCalls[firstKey]) {
				activity = "tool_exec";
				intensity = 1.0;
				activeToolName = activeCalls[firstKey].toolName;
				toolArgs = activeCalls[firstKey].args;
			}
		} else if (mcpMetrics.length > 0) {
			const latest = mcpMetrics[mcpMetrics.length - 1];
			if (latest) {
				const age = Date.now() - (latest.startedAt || 0);
				if (age < 5000) {
					activity = latest.status === "error" ? "error" : "tool_exec";
					intensity = Math.max(0.2, 1.0 - age / 5000);
					activeToolName = latest.toolName || latest.tool;
					toolArgs = latest.args;
				}
			}
		}

		let activeChatTool: "read" | "edit" | "write" | "ast" | "rag" | undefined;
		let activeChatFilePath: string | undefined;
		let activeChatPivotClass: string | undefined;

		// Extrai ferramentas de código do chat (read, edit, write, ast, rag) e identifica o arquivo/classe pivô
		if (activeToolName) {
			const toolLower = activeToolName.toLowerCase().trim();
			if (toolLower === "read" || toolLower.endsWith(":read")) {
				activeChatTool = "read";
			} else if (toolLower === "edit" || toolLower.endsWith(":edit")) {
				activeChatTool = "edit";
			} else if (toolLower === "write" || toolLower.endsWith(":write")) {
				activeChatTool = "write";
			} else if (toolLower.includes("ast_")) {
				activeChatTool = "ast";
			} else if (toolLower.includes("code_search") || toolLower.includes("cindy_search")) {
				activeChatTool = "rag";
			}

			if (toolArgs && typeof toolArgs === "object") {
				const rawPath = (toolArgs.path || toolArgs.file || toolArgs.target_path) as
					| string
					| undefined;
				if (rawPath && typeof rawPath === "string") {
					activeChatFilePath = rawPath.replace(/\\/g, "/");
					const fileName = activeChatFilePath.split("/").pop() || "";
					activeChatPivotClass = fileName.replace(/\.[^.]+$/, "");
				}

				const rawTarget = (toolArgs.target || toolArgs.symbol || toolArgs.target_path) as
					| string
					| undefined;
				if (rawTarget && typeof rawTarget === "string") {
					const cleanTarget = rawTarget.trim();
					if (cleanTarget.includes("/") || cleanTarget.includes("\\")) {
						const norm = cleanTarget.replace(/\\/g, "/");
						activeChatFilePath = activeChatFilePath || norm;
						const fileName = norm.split("/").pop() || "";
						activeChatPivotClass = fileName.replace(/\.[^.]+$/, "");
					} else if (/^[A-Za-z0-9_]+$/.test(cleanTarget)) {
						activeChatPivotClass = cleanTarget;
					}
				}
			}
		}

		// Extrai query/símbolo se for ferramenta RAG do Hermes ou Cindy
		if (activeToolName) {
			const lower = activeToolName.toLowerCase();
			if (
				lower.includes("code_search") ||
				lower.includes("ast_predict") ||
				lower.includes("ast_skeleton") ||
				lower.includes("ast_impact") ||
				lower.includes("memory_search") ||
				lower.includes("cindy_search") ||
				lower.includes("spec_grep")
			) {
				isRagSearching = true;
				activeRagToolName = activeToolName.split("__").pop() || activeToolName;
				if (toolArgs && typeof toolArgs === "object") {
					activeRagQuery =
						toolArgs.query ||
						toolArgs.target ||
						toolArgs.symbol ||
						toolArgs.target_path ||
						toolArgs.pattern;
				}
			}
		}

		const isBash =
			activeToolName?.toLowerCase().includes("bash") ||
			activeToolName?.toLowerCase().includes("shell");
		if (isBash) {
			activity = "bash_exec";
		}

		return {
			activity,
			intensity,
			tokenStreamingSpeed: isRagSearching
				? 60
				: activity === "tool_exec" || activity === "bash_exec"
					? 40
					: 0,
			activeToolName,
			activeRagQuery,
			activeRagToolName,
			isRagSearching,
			activeChatTool,
			activeChatFilePath,
			activeChatPivotClass,
			shockwavePulse: 0,
			electricArcsCount: isRagSearching ? 24 : activity === "tool_exec" ? 16 : 0,
		};
	}, [mcpMetrics, activeCalls]);

	// Shockwave imediato ao registrar nova chamada MCP ou evento
	useEffect(() => {
		if (mcpMetrics.length > lastMetricCountRef.current) {
			lastMetricCountRef.current = mcpMetrics.length;
			setPulseKey((k) => k + 1);
		}
	}, [mcpMetrics.length]);

	return {
		state,
		pulseKey,
		connectionStatus,
		workspaceName: activeWorkspace?.name || "Default Workspace",
	};
}
