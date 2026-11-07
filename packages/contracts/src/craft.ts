/**
 * Contratos, tipos e schemas para o motor Craft Anything no ThinkRail.
 * Suporta o pipeline completo: Study → Build → Verify → Ready.
 */

export type CraftTargetType = "website" | "desktop_app" | "game" | "binary" | "directory";

export type CraftInspectionMode = "clean_room" | "deep";

export type CraftStepKind = "study" | "build" | "verify" | "ready";

export type CraftStepStatus = "pending" | "in_progress" | "passed" | "failed" | "skipped";

export interface CraftStep {
	step: CraftStepKind;
	title: string;
	status: CraftStepStatus;
	detail?: string;
	startedAt?: number;
	completedAt?: number;
}

export interface CraftViewportDiff {
	viewport: "desktop" | "tablet" | "mobile";
	width: number;
	height: number;
	similarityScore: number; // 0 a 100%
	originalScreenshotUrl?: string;
	rebuiltScreenshotUrl?: string;
	diffOverlayUrl?: string;
	mismatchCount?: number;
}

export interface CraftSelfTestStepResult {
	step: string;
	passed: boolean;
	detail?: string;
}

export interface CraftSelfTestReport {
	version: number;
	passed: boolean;
	totalSteps: number;
	passedSteps: number;
	steps: CraftSelfTestStepResult[];
}

export interface CraftProjectConfig {
	id: string;
	name: string;
	target: string;
	targetType: CraftTargetType;
	mode: CraftInspectionMode;
	targetStack?: string;
	instructions: string;
	outputPath: string;
	generateAssets?: boolean;
	allowRun?: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface CraftProjectState {
	config: CraftProjectConfig;
	currentStep: CraftStepKind;
	steps: CraftStep[];
	feed: CraftFeedItem[];
	similarityScore?: number;
	viewportDiffs: CraftViewportDiff[];
	selfTest?: CraftSelfTestReport;
	briefingMarkdown?: string;
	unknowns: CraftUnknown[];
}

export interface CraftUnknown {
	id: string;
	category: string;
	question: string;
	status: "open" | "resolved" | "estimated";
	answer?: string;
}

export interface CraftApprovalRequest {
	id: string;
	projectId: string;
	title: string;
	command?: string;
	reason: string;
	dangerous?: boolean;
	status: "pending" | "approved" | "rejected";
}

export interface CraftUserQuestionRequest {
	id: string;
	projectId: string;
	question: string;
	options?: string[];
	allowCustomText?: boolean;
	answer?: string;
}

export type CraftFeedItem =
	| { kind: "step"; step: CraftStepKind; text: string; timestamp: number }
	| { kind: "agent"; text: string; streaming?: boolean; timestamp: number }
	| { kind: "work"; tools: string[]; notes: string[]; timestamp: number }
	| { kind: "approval"; request: CraftApprovalRequest; timestamp: number }
	| { kind: "question"; request: CraftUserQuestionRequest; timestamp: number }
	| { kind: "error"; message: string; remediation?: string; timestamp: number }
	| { kind: "user"; text: string; timestamp: number };

// RPC Payloads

export interface CraftStartProjectInput {
	name?: string;
	target: string;
	targetType: CraftTargetType;
	mode: CraftInspectionMode;
	targetStack?: string;
	instructions: string;
	outputPath?: string;
	generateAssets?: boolean;
	allowRun?: boolean;
}

export interface CraftStartProjectResult {
	projectId: string;
	projectState: CraftProjectState;
}

export interface CraftGetProjectStateInput {
	projectId: string;
}

export interface CraftListProjectsResult {
	projects: CraftProjectConfig[];
}

export interface CraftSubmitAnswerInput {
	projectId: string;
	requestId: string;
	answer: string;
}

export interface CraftSubmitApprovalInput {
	projectId: string;
	requestId: string;
	approved: boolean;
}

export interface CraftFollowUpInput {
	projectId: string;
	message: string;
}
