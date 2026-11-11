import { describe, expect, it } from "bun:test";
import {
	computeSemanticFingerprint,
	findKeepoutNodeConflict,
	getPolygonKindForFile,
	resolveFileTypeColor,
	type VectorEdgeInput,
	type VectorNodeInput,
} from "./geometry";

describe("Neural Core Geometry & Semantic Fingerprint", () => {
	it("detecta tipos poligonais e cores conforme o tipo/extensao de arquivo", () => {
		expect(getPolygonKindForFile("main.tsx")).toBe("cube");
		expect(getPolygonKindForFile("engine.ts")).toBe("octahedron");
		expect(getPolygonKindForFile("README.md")).toBe("tetrahedron");
		expect(getPolygonKindForFile("package.json")).toBe("hex_bipyramid");
		expect(getPolygonKindForFile("types.d.ts")).toBe("icosahedron");

		const tsColor = resolveFileTypeColor("file.ts");
		expect(tsColor).toBeDefined();
		expect(tsColor.length).toBe(4);
	});

	it("computa semantic fingerprint vazia para grafos vazios com determinismo", () => {
		const emptyResult = computeSemanticFingerprint([], []);
		expect(emptyResult.totalClasses).toBe(0);
		expect(emptyResult.totalRelations).toBe(0);
		expect(emptyResult.fingerprintHash).toBe("0000000000000000000000000000000000000000000000000000000000000000");
		expect(emptyResult.auditBadge).toBe("EMPTY");
	});

	it("computa fingerprint semântica determinística com nós e relações k-NN / AST", () => {
		const nodes: VectorNodeInput[] = [
			{
				id: "node_1",
				module: "apps/web",
				path: "apps/web/src/App.tsx",
				fileExtension: "tsx",
				position: [0.1, 0.2, 0.3],
				methods: [{ id: "m1", name: "render" }],
			},
			{
				id: "node_2",
				module: "packages/server",
				path: "packages/server/src/index.ts",
				fileExtension: "ts",
				position: [1.1, 0.5, -0.2],
				methods: [{ id: "m2", name: "startServer" }],
			},
		];

		const edges: VectorEdgeInput[] = [
			{
				source: 0,
				target: 1,
				similarity: 0.88,
				kind: "calls",
			},
		];

		const res1 = computeSemanticFingerprint(nodes, edges);
		const res2 = computeSemanticFingerprint(nodes, edges);

		expect(res1.fingerprintHash).toBe(res2.fingerprintHash);
		expect(res1.shortHash).toBe(res2.shortHash);
		expect(res1.totalClasses).toBe(2);
		expect(res1.totalRelations).toBe(1);
		expect(res1.entropy).toBeGreaterThan(0);
		expect(res1.auditBadge.startsWith("FINGERPRINT-")).toBe(true);
	});
	it("identifica conflitos de Keepout Zone para desobstrução de nós intermediários", () => {
		const nodes: VectorNodeInput[] = [
			{
				id: "node_start",
				module: "apps/web",
				path: "apps/web/src/Start.tsx",
				position: [0.0, 0.0, 0.0],
			},
			{
				id: "node_middle",
				module: "apps/web",
				path: "apps/web/src/Middle.tsx",
				position: [2.0, 0.0, 0.0],
			},
			{
				id: "node_end",
				module: "apps/web",
				path: "apps/web/src/End.tsx",
				position: [4.0, 0.0, 0.0],
			},
		];

		// Linha entre node_start (0) e node_end (2) atravessa a zona de node_middle (1)
		const conflict = findKeepoutNodeConflict(0.0, 0.0, 4.0, 0.0, nodes, 0, 2, 0.1);
		expect(conflict).not.toBeNull();
		expect(conflict?.id).toBe("node_middle");

		// Linha que passa afastada não deve acusar conflito
		const noConflict = findKeepoutNodeConflict(0.0, 5.0, 4.0, 5.0, nodes, 0, 2, 0.1);
		expect(noConflict).toBeNull();
	});
});
