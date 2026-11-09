import { describe, expect, it } from "bun:test";
import {
	computeNodeRelations,
	computeSemanticFingerprint,
	createVectorConstellationWireframe,
	FILE_TYPE_COLORS,
	getPolygonKindForFile,
	resolveFileTypeColor,
} from "./geometry";

describe("Neural Core Semantic Fingerprint & Anti-Plagiarism Auditor (v18)", () => {
	describe("Caso de Uso 1: Classificação Geométrica Poligonal por Extensão de Arquivo", () => {
		it("mapeia arquivos React TSX para cubo tridimensional", () => {
			expect(getPolygonKindForFile("NeuralCorePanel.tsx")).toBe("cube");
			expect(getPolygonKindForFile("apps/web/src/App.tsx")).toBe("cube");
		});

		it("mapeia arquivos TypeScript puros para octaedro", () => {
			expect(getPolygonKindForFile("geometry.ts")).toBe("octahedron");
			expect(getPolygonKindForFile("packages/server/engine.ts")).toBe("octahedron");
		});

		it("mapeia arquivos JavaScript para prisma", () => {
			expect(getPolygonKindForFile("legacy.js")).toBe("prism");
			expect(getPolygonKindForFile("component.jsx")).toBe("prism");
		});

		it("mapeia documentações Markdown para tetraedro sagrado", () => {
			expect(getPolygonKindForFile("README.md")).toBe("tetrahedron");
			expect(getPolygonKindForFile("SPEC.md")).toBe("tetrahedron");
		});

		it("mapeia arquivos de configuração para bipirâmide hexagonal", () => {
			expect(getPolygonKindForFile("package.json")).toBe("hex_bipyramid");
			expect(getPolygonKindForFile("turbo.json")).toBe("hex_bipyramid");
			expect(getPolygonKindForFile("config.yaml")).toBe("hex_bipyramid");
		});

		it("mapeia scripts de automação para diamante duplo", () => {
			expect(getPolygonKindForFile("build.sh")).toBe("diamond");
			expect(getPolygonKindForFile("deploy.bat")).toBe("diamond");
			expect(getPolygonKindForFile("run.ps1")).toBe("diamond");
		});

		it("mapeia arquivos de estilos para octaedro estrelado / merkaba", () => {
			expect(getPolygonKindForFile("globals.css")).toBe("star_octahedron");
			expect(getPolygonKindForFile("theme.scss")).toBe("star_octahedron");
		});

		it("mapeia contratos e definições de tipos para icosaedro geodésico", () => {
			expect(getPolygonKindForFile("packages/contracts/src/index.ts")).toBe("icosahedron");
			expect(getPolygonKindForFile("types.d.ts")).toBe("icosahedron");
		});
	});

	describe("Caso de Uso 2: Paleta Cromática Dedicada por Tipo de Arquivo", () => {
		it("atribui cores exclusivas e contrastantes para cada formato", () => {
			const colorTsx = resolveFileTypeColor("App.tsx");
			const colorTs = resolveFileTypeColor("math.ts");
			const colorMd = resolveFileTypeColor("README.md");
			const colorJson = resolveFileTypeColor("data.json");
			const colorCss = resolveFileTypeColor("styles.css");

			expect(colorTsx).toEqual(FILE_TYPE_COLORS.tsx!);
			expect(colorTs).toEqual(FILE_TYPE_COLORS.ts!);
			expect(colorMd).toEqual(FILE_TYPE_COLORS.md!);
			expect(colorJson).toEqual(FILE_TYPE_COLORS.json!);
			expect(colorCss).toEqual(FILE_TYPE_COLORS.css!);

			// Garante que TSX (Ciano) e TS (Azul Safira) têm coordenadas cromáticas distintas
			expect(colorTsx[0]).not.toEqual(colorTs[0]);
		});
	});

	describe("Caso de Uso 3: Auditor Anti-Plágio de Impressão Digital Semântica", () => {
		const mockNodes = [
			{
				id: "apps/web/src/panels/NeuralCorePanel.tsx",
				path: "apps/web/src/panels/NeuralCorePanel.tsx",
				module: "apps/web",
				fileExtension: "tsx",
				position: [0.1, 0.2, 0.3] as [number, number, number],
				methods: [{ id: "m1", name: "render" }, { id: "m2", name: "handleFocus" }],
			},
			{
				id: "apps/web/src/panels/neural-core/neuralEngine.ts",
				path: "apps/web/src/panels/neural-core/neuralEngine.ts",
				module: "apps/web",
				fileExtension: "ts",
				position: [0.4, 0.5, 0.6] as [number, number, number],
				methods: [{ id: "m3", name: "init" }, { id: "m4", name: "renderWebGpu" }],
			},
			{
				id: "packages/contracts/src/index.ts",
				path: "packages/contracts/src/index.ts",
				module: "contracts",
				fileExtension: "ts",
				position: [0.8, 0.2, -0.4] as [number, number, number],
			},
		];

		const mockEdges = [
			{
				source: 0,
				target: 1,
				kind: "imports" as const,
				similarity: 0.92,
			},
			{
				source: 0,
				target: 2,
				kind: "type_ref" as const,
				similarity: 0.88,
			},
		];

		it("calcula impressão digital semântica determinística para o repositório", () => {
			const fp1 = computeSemanticFingerprint(mockNodes, mockEdges);
			const fp2 = computeSemanticFingerprint(mockNodes, mockEdges);

			expect(fp1.fingerprintHash).toBe(fp2.fingerprintHash);
			expect(fp1.shortHash).toBe(fp2.shortHash);
			expect(fp1.fingerprintHash).toHaveLength(64);
			expect(fp1.totalClasses).toBe(3);
			expect(fp1.totalRelations).toBe(2);
			expect(fp1.entropy).toBeGreaterThan(0);
			expect(["VERIFIED_AUTHENTIC", "HIGH_DENSITY"]).toContain(fp1.integrityStatus);
		});

		it("detecta adulteração ou mutação de código modificando a impressão digital", () => {
			const fpOriginal = computeSemanticFingerprint(mockNodes, mockEdges);
			const tamperedNodes = [
				{
					...mockNodes[0]!,
					methods: [{ id: "m1", name: "plagiarizedMethod" }],
				},
				mockNodes[1]!,
				mockNodes[2]!,
			];
			const fpTampered = computeSemanticFingerprint(tamperedNodes, mockEdges);

			expect(fpTampered.fingerprintHash).not.toBe(fpOriginal.fingerprintHash);
			expect(fpTampered.shortHash).not.toBe(fpOriginal.shortHash);
		});
	});

	describe("Caso de Uso 4: Grafo de Dependências Pulsante sem Cruzamento 3D", () => {
		const nodes = [
			{
				id: "A",
				path: "src/A.tsx",
				module: "apps/web",
				position: [0, 0, 0] as [number, number, number],
				methods: [{ id: "mA", name: "doWork", signature: "doWork(b: B)" }],
			},
			{
				id: "B",
				path: "src/B.ts",
				module: "apps/web",
				position: [1, 0, 1] as [number, number, number],
				methods: [{ id: "mB", name: "helper", signature: "helper()" }],
			},
			{
				id: "C",
				path: "src/C.ts",
				module: "apps/web",
				position: [-1, 0, 1] as [number, number, number],
			},
		];
		const edges = [
			{ source: 0, target: 1, kind: "calls" as const, similarity: 0.9 },
			{ source: 0, target: 2, kind: "imports" as const, similarity: 0.8 },
		];

		it("identifica vizinhos e tipos de relação na seleção do nó", () => {
			const rels = computeNodeRelations(0, nodes, edges);
			expect(rels.directNeighbors.has(1)).toBe(true);
			expect(rels.directNeighbors.has(2)).toBe(true);
			expect(rels.callNeighbors.has(1)).toBe(true);
			expect(rels.importNeighbors.has(2)).toBe(true);
		});

		it("gera malha com feixes pulsantes e roteamento Manhattan sem NaN ou erros de índice", () => {
			const mesh = createVectorConstellationWireframe(
				nodes,
				edges,
				null,
				null,
				null,
				0,
				true,
				1.5, // animTime
			);

			expect(mesh.count).toBeGreaterThan(0);
			expect(mesh.vertices.length).toBeGreaterThan(0);
			expect(mesh.indices.length).toBeGreaterThan(0);

			// Verifica que todos os vértices gerados são numéricos e válidos
			for (let i = 0; i < Math.min(200, mesh.vertices.length); i++) {
				expect(Number.isNaN(mesh.vertices[i])).toBe(false);
			}
		});
	});
});
