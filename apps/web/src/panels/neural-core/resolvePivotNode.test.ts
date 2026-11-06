import { describe, expect, it } from "bun:test";
import type { HermesVectorNode } from "@thinkrail/contracts";
import { resolvePivotNode } from "./resolvePivotNode";

describe("resolvePivotNode", () => {
	const mockNodes: HermesVectorNode[] = [
		{
			id: "node-1",
			path: "D:/Projet_Thinkrail/source/thinkrail/apps/web/src/panels/NeuralCorePanel.tsx",
			relPath: "apps/web/src/panels/NeuralCorePanel.tsx",
			qualifiedName: "NeuralCorePanel",
			chunkKind: "function",
			module: "apps/web",
			position: [0, 10, 0],
			tokenEstimate: 500,
			contentSnippet: "export function NeuralCorePanel() {...}",
		},
		{
			id: "node-2",
			path: "D:/Projet_Thinkrail/source/thinkrail/apps/web/src/panels/neural-core/neuralEngine.ts",
			relPath: "apps/web/src/panels/neural-core/neuralEngine.ts",
			qualifiedName: "NeuralCoreEngine",
			chunkKind: "class",
			module: "apps/web",
			position: [10, 20, 5],
			tokenEstimate: 1200,
			contentSnippet: "export class NeuralCoreEngine {...}",
		},
		{
			id: "node-3",
			path: "D:/Projet_Thinkrail/source/thinkrail/apps/web/src/panels/neural-core/neuralEngine.ts",
			relPath: "apps/web/src/panels/neural-core/neuralEngine.ts",
			qualifiedName: "NeuralCoreEngine.init",
			chunkKind: "method",
			module: "apps/web",
			position: [12, 22, 6],
			tokenEstimate: 200,
			contentSnippet: "async init() {...}",
		},
	];

	it("prioritizes class chunkKind when multiple nodes belong to the same file", () => {
		const result = resolvePivotNode("apps/web/src/panels/neural-core/neuralEngine.ts", mockNodes);
		expect(result?.id).toBe("node-2");
		expect(result?.qualifiedName).toBe("NeuralCoreEngine");
	});

	it("resolves Windows backslash paths correctly", () => {
		const result = resolvePivotNode("apps\\web\\src\\panels\\NeuralCorePanel.tsx", mockNodes);
		expect(result?.id).toBe("node-1");
	});

	it("resolves by base class name when full path is truncated or relative", () => {
		const result = resolvePivotNode("neuralEngine.ts", mockNodes);
		expect(result?.id).toBe("node-2");
	});

	it("returns null for non-matching files", () => {
		const result = resolvePivotNode("nonexistent/file.ts", mockNodes);
		expect(result).toBeNull();
	});
});
