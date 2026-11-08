import { describe, expect, it } from "bun:test";
import type { HermesChunkItem, HermesVectorNode } from "@thinkrail/contracts";

describe("Neural Core Search and Filtering logic", () => {
	const mockNodes: HermesVectorNode[] = [
		{
			id: "node-1",
			path: "apps/web/src/panels/NeuralCorePanel.tsx",
			relPath: "apps/web/src/panels/NeuralCorePanel.tsx",
			qualifiedName: "NeuralCorePanel",
			chunkKind: "function",
			module: "apps/web",
			position: [0, 0, 0],
			tokenEstimate: 400,
			contentSnippet: "const cameraRef = useRef();",
			methods: [
				{
					id: "m-1",
					name: "handleCanvasClick",
					kind: "method",
					signature: "handleCanvasClick(e)",
					tokenEstimate: 50,
					orbitAngle: 0,
					orbitRadius: 0.2,
				},
			],
		},
		{
			id: "node-2",
			path: "apps/web/src/panels/neural-core/cameraController.ts",
			relPath: "apps/web/src/panels/neural-core/cameraController.ts",
			qualifiedName: "OrbitCameraController",
			chunkKind: "class",
			module: "apps/web",
			position: [1, 0, 1],
			tokenEstimate: 350,
			contentSnippet: "class OrbitCameraController { wasJustDragging() { return true; } }",
			methods: [
				{
					id: "m-2",
					name: "wasJustDragging",
					kind: "method",
					signature: "wasJustDragging()",
					tokenEstimate: 20,
					orbitAngle: 0,
					orbitRadius: 0.2,
				},
			],
		},
	];

	it("encontra nós pelo nome do método contido", () => {
		const q = "wasJustDragging";
		const matches = mockNodes.filter((n) => {
			const qn = (n.qualifiedName || "").toLowerCase();
			const hasMethod = (n.methods || []).some(
				(m) =>
					m.name.toLowerCase().includes(q.toLowerCase()) ||
					(m.signature || "").toLowerCase().includes(q.toLowerCase()),
			);
			return qn.includes(q.toLowerCase()) || hasMethod;
		});

		expect(matches.length).toBe(1);
		expect(matches[0]?.qualifiedName).toBe("OrbitCameraController");
	});

	it("filtra chunks por múltiplos termos em qualquer ordem", () => {
		const chunks: HermesChunkItem[] = [
			{
				id: "c-1",
				path: "apps/web/src/panels/neural-core/cameraController.ts",
				relPath: "cameraController.ts",
				qualifiedName: "wasJustDragging",
				chunkKind: "method",
				content: "public wasJustDragging(thresholdMs = 250): boolean",
				tokenEstimate: 30,
			},
			{
				id: "c-2",
				path: "apps/web/src/panels/NeuralCorePanel.tsx",
				relPath: "NeuralCorePanel.tsx",
				qualifiedName: "handleCanvasClick",
				chunkKind: "function",
				content: "const handleCanvasClick = (e) => {}",
				tokenEstimate: 40,
			},
		];

		const query = "camera dragging";
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		const filtered = chunks.filter((c) => {
			const name = (c.qualifiedName || "").toLowerCase();
			const content = (c.content || "").toLowerCase();
			const path = (c.path || "").toLowerCase();
			return terms.every((t) => name.includes(t) || content.includes(t) || path.includes(t));
		});

		expect(filtered.length).toBe(1);
		expect(filtered[0]?.id).toBe("c-1");
	});
});
