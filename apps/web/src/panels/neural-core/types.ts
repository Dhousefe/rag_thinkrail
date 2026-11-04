export type NeuralActivityState = "idle" | "thinking" | "tool_exec" | "bash_exec" | "error";

export interface NeuralTelemetryState {
	activity: NeuralActivityState;
	intensity: number;
	tokenStreamingSpeed: number;
	activeToolName?: string | undefined;
	activeRagQuery?: string | undefined;
	activeRagToolName?: string | undefined;
	isRagSearching?: boolean | undefined;
	terminalCommand?: string | undefined;
	shockwavePulse: number;
	electricArcsCount: number;
}

export interface NeuralNode3D {
	id: string;
	label: string;
	kind: "core" | "tool" | "command" | "rag";
	position: [number, number, number];
	color: [number, number, number, number];
	radius: number;
	pulse: number;
}
