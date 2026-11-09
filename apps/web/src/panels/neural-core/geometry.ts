import type { HermesEdgeKind } from "@thinkrail/contracts";

export interface GeometryMeshData {
	// Array intercalado: [x, y, z, r, g, b, a, ...]
	vertices: Float32Array;
	// Índices para LINES (arestas wireframe), suportando até Uint32Array para dezenas de milhares de nós
	indices: Uint16Array | Uint32Array;
	count: number;
}

// 1. Gerador do Hipercubo 4D (Tesseract rotativo projetado em 3D)
export function createTesseractWireframe(scale = 1.0, angle4D = 0.0): GeometryMeshData {
	const v4: [number, number, number, number][] = [];
	for (let x = -1; x <= 1; x += 2) {
		for (let y = -1; y <= 1; y += 2) {
			for (let z = -1; z <= 1; z += 2) {
				for (let w = -1; w <= 1; w += 2) {
					v4.push([x * 0.7, y * 0.7, z * 0.7, w * 0.7]);
				}
			}
		}
	}

	// Rotação 4D simples no plano XW e ZW
	const cosA = Math.cos(angle4D);
	const sinA = Math.sin(angle4D);
	const projDistance = 2.2;

	const vertexFloats: number[] = [];
	for (const [px0, py0, pz0, pw0] of v4) {
		// Rotação no plano XW
		const x = px0 * cosA - pw0 * sinA;
		const w = px0 * sinA + pw0 * cosA;
		const y = py0;
		const z = pz0;

		// Projeção perspectiva 4D -> 3D
		const perspective = 1.0 / (projDistance - w * 0.6);
		const px = x * perspective * scale;
		const py = y * perspective * scale;
		const pz = z * perspective * scale;

		// Posição + Cor RGBA (Ciano / Azul Elétrico)
		vertexFloats.push(px, py, pz, 0.0, 0.85, 1.0, 0.9);
	}

	// 32 Arestas conectando os vértices que diferem em exatamente 1 bit
	const edgeIndices: number[] = [];
	for (let i = 0; i < 16; i++) {
		for (let bit = 0; bit < 4; bit++) {
			const j = i ^ (1 << bit);
			if (i < j) {
				edgeIndices.push(i, j);
			}
		}
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}

// 2. Gerador do Icosaedro Geodésico Sagrado
export function createIcosahedronWireframe(radius = 1.0): GeometryMeshData {
	const phi = (1.0 + Math.sqrt(5.0)) / 2.0;
	const a = 1.0;
	const b = 1.0 / phi;

	const rawVertices: [number, number, number][] = [
		[-a, b, 0],
		[a, b, 0],
		[-a, -b, 0],
		[a, -b, 0],
		[0, -a, b],
		[0, a, b],
		[0, -a, -b],
		[0, a, -b],
		[b, 0, -a],
		[b, 0, a],
		[-b, 0, -a],
		[-b, 0, a],
	];

	const vertexFloats: number[] = [];
	for (const [vx, vy, vz] of rawVertices) {
		const len = Math.sqrt(vx * vx + vy * vy + vz * vz || 1);
		const x = (vx / len) * radius;
		const y = (vy / len) * radius;
		const z = (vz / len) * radius;
		vertexFloats.push(x, y, z, 0.7, 0.3, 1.0, 0.85); // Magenta neural
	}

	const indices = [
		0, 11, 0, 5, 0, 1, 0, 7, 0, 10, 3, 9, 3, 4, 3, 2, 3, 6, 3, 8, 1, 5, 5, 9, 9, 4, 4, 2, 2, 10, 10,
		7, 7, 8, 8, 1, 1, 9, 4, 6, 2, 6, 6, 8, 7, 10, 5, 11, 11, 2, 11, 10, 11, 4, 11, 9, 5, 1, 7, 8,
	];

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(indices),
		count: indices.length,
	};
}

// 3. Gerador dos Anéis Giroscópicos Cardânicos (Gimbal Rings)
export function createGimbalRingsWireframe(
	radii: [number, number, number],
	segments = 48,
): GeometryMeshData {
	const vertexFloats: number[] = [];
	const edgeIndices: number[] = [];
	let vertexOffset = 0;

	const axes: Array<{
		axis: "xy" | "yz" | "xz";
		r: number;
		color: [number, number, number, number];
	}> = [
		{ axis: "xy", r: radii[0], color: [0.0, 0.9, 1.0, 0.7] }, // Pitch ring (Ciano)
		{ axis: "yz", r: radii[1], color: [0.8, 0.2, 1.0, 0.7] }, // Roll ring (Magenta)
		{ axis: "xz", r: radii[2], color: [1.0, 0.75, 0.0, 0.8] }, // Yaw ring (Ouro/Âmbar)
	];

	for (const item of axes) {
		const startIdx = vertexOffset;
		const [cr, cg, cb, ca] = item.color;
		for (let i = 0; i < segments; i++) {
			const theta = (i / segments) * Math.PI * 2;
			const c = Math.cos(theta) * item.r;
			const s = Math.sin(theta) * item.r;

			let x = 0;
			let y = 0;
			let z = 0;
			if (item.axis === "xy") {
				x = c;
				y = s;
				z = 0;
			} else if (item.axis === "yz") {
				x = 0;
				y = c;
				z = s;
			} else {
				x = c;
				y = 0;
				z = s;
			}

			vertexFloats.push(x, y, z, cr, cg, cb, ca);

			const next = startIdx + ((i + 1) % segments);
			edgeIndices.push(vertexOffset, next);
			vertexOffset++;
		}
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}

// 4. Gerador de Feixes e Satélites de Ferramentas / MCP
export function createToolNodeSatellites(count = 6, orbitRadius = 2.4): GeometryMeshData {
	const vertexFloats: number[] = [];
	const edgeIndices: number[] = [];
	let vOffset = 0;

	for (let i = 0; i < count; i++) {
		const angle = (i / count) * Math.PI * 2;
		const cx = Math.cos(angle) * orbitRadius;
		const cy = Math.sin(angle * 2) * 0.4;
		const cz = Math.sin(angle) * orbitRadius;

		// Pequeno octaedro satélite
		const s = 0.12;
		const base = vOffset;
		const pts: [number, number, number][] = [
			[cx, cy + s, cz],
			[cx, cy - s, cz],
			[cx + s, cy, cz],
			[cx - s, cy, cz],
			[cx, cy, cz + s],
			[cx, cy, cz - s],
		];

		for (const [px, py, pz] of pts) {
			vertexFloats.push(px, py, pz, 0.0, 1.0, 0.6, 0.9);
			vOffset++;
		}

		// Conexões internas do octaedro
		const octEdges = [0, 2, 0, 3, 0, 4, 0, 5, 1, 2, 1, 3, 1, 4, 1, 5, 2, 4, 4, 3, 3, 5, 5, 2];
		for (const e of octEdges) {
			edgeIndices.push(base + e);
		}
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}

// 5. Gerador da Stella Octangula (Merkaba / Dois Tetraedros Sagrados Entrelaçados)
export function createMerkabaWireframe(scale = 1.2): GeometryMeshData {
	const vertexFloats: number[] = [];
	const edgeIndices: number[] = [];

	// Tetraedro 1 (Vértices dourados/âmbar com energia ascendente)
	const t1: [number, number, number][] = [
		[1, 1, 1],
		[1, -1, -1],
		[-1, 1, -1],
		[-1, -1, 1],
	];
	for (const [vx, vy, vz] of t1) {
		vertexFloats.push(
			vx * scale * 0.8,
			vy * scale * 0.8,
			vz * scale * 0.8,
			1.0,
			0.8,
			0.2,
			0.95, // Ouro Solar
		);
	}

	// Arestas do Tetraedro 1
	const t1Edges = [0, 1, 0, 2, 0, 3, 1, 2, 2, 3, 3, 1];
	edgeIndices.push(...t1Edges);

	// Tetraedro 2 (Invertido, Ciano/Azul elétrico com energia descendente)
	const t2: [number, number, number][] = [
		[-1, -1, -1],
		[-1, 1, 1],
		[1, -1, 1],
		[1, 1, -1],
	];
	for (const [vx, vy, vz] of t2) {
		vertexFloats.push(
			vx * scale * 0.8,
			vy * scale * 0.8,
			vz * scale * 0.8,
			0.0,
			0.85,
			1.0,
			0.95, // Ciano Elétrico
		);
	}

	// Arestas do Tetraedro 2 (offset 4)
	for (const e of t1Edges) {
		edgeIndices.push(e + 4);
	}

	// Arestas de Harmonia Sagrada conectando os centros das faces opostas
	const harmEdges = [0, 5, 0, 6, 0, 7, 4, 1, 4, 2, 4, 3];
	edgeIndices.push(...harmEdges);

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}

// 6. Gerador do Torus de Vórtice Harmônico (Torus Wireframe)
export function createTorusWireframe(
	majorRadius = 1.4,
	minorRadius = 0.5,
	radarRings = 24,
	tubeSegments = 16,
): GeometryMeshData {
	const vertexFloats: number[] = [];
	const edgeIndices: number[] = [];
	let vOffset = 0;

	for (let i = 0; i < radarRings; i++) {
		const u = (i / radarRings) * Math.PI * 2;
		const cu = Math.cos(u);
		const su = Math.sin(u);

		for (let j = 0; j < tubeSegments; j++) {
			const v = (j / tubeSegments) * Math.PI * 2;
			const cv = Math.cos(v);
			const sv = Math.sin(v);

			const x = (majorRadius + minorRadius * cv) * cu;
			const y = minorRadius * sv;
			const z = (majorRadius + minorRadius * cv) * su;

			// Gradiente espectral de vórtice (Ciano a Violeta)
			const t = i / radarRings;
			const r = 0.2 + 0.6 * Math.sin(t * Math.PI);
			const g = 0.8 * Math.cos(t * Math.PI * 0.5);
			const b = 1.0;
			vertexFloats.push(x, y, z, r, g, b, 0.75);

			// Aresta longitudinal (ao redor do tubo)
			const nextLong = i * tubeSegments + ((j + 1) % tubeSegments);
			edgeIndices.push(vOffset, nextLong);

			// Aresta circular (ao redor do anel principal)
			const nextRing = ((i + 1) % radarRings) * tubeSegments + j;
			edgeIndices.push(vOffset, nextRing);

			vOffset++;
		}
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}

// 7. Gerador do Dodecaedro Pentagonal Sagrado
export function createDodecahedronWireframe(radius = 1.15): GeometryMeshData {
	const phi = (1.0 + Math.sqrt(5.0)) / 2.0;
	const invPhi = 1.0 / phi;

	const rawVertices: [number, number, number][] = [
		// 8 vértices do cubo unitário (+-1, +-1, +-1)
		[-1, -1, -1],
		[-1, -1, 1],
		[-1, 1, -1],
		[-1, 1, 1],
		[1, -1, -1],
		[1, -1, 1],
		[1, 1, -1],
		[1, 1, 1],
		// 4 vértices (0, +-invPhi, +-phi)
		[0, -invPhi, -phi],
		[0, -invPhi, phi],
		[0, invPhi, -phi],
		[0, invPhi, phi],
		// 4 vértices (+-invPhi, +-phi, 0)
		[-invPhi, -phi, 0],
		[-invPhi, phi, 0],
		[invPhi, -phi, 0],
		[invPhi, phi, 0],
		// 4 vértices (+-phi, 0, +-invPhi)
		[-phi, 0, -invPhi],
		[-phi, 0, invPhi],
		[phi, 0, -invPhi],
		[phi, 0, invPhi],
	];

	const vertexFloats: number[] = [];
	for (const [vx, vy, vz] of rawVertices) {
		const len = Math.sqrt(vx * vx + vy * vy + vz * vz || 1);
		const x = (vx / len) * radius;
		const y = (vy / len) * radius;
		const z = (vz / len) * radius;
		vertexFloats.push(x, y, z, 0.3, 1.0, 0.7, 0.88); // Esmeralda / Jade Geométrico
	}

	// 30 Arestas que conectam vértices com distância pentagonal áurea mínima
	const edgeIndices: number[] = [];
	const minDist = (2.0 / phi) * (radius / Math.sqrt(3));
	const threshold = minDist * 1.15;

	for (let i = 0; i < rawVertices.length; i++) {
		const vxi = vertexFloats[i * 7] ?? 0;
		const vyi = vertexFloats[i * 7 + 1] ?? 0;
		const vzi = vertexFloats[i * 7 + 2] ?? 0;
		for (let j = i + 1; j < rawVertices.length; j++) {
			const vxj = vertexFloats[j * 7] ?? 0;
			const vyj = vertexFloats[j * 7 + 1] ?? 0;
			const vzj = vertexFloats[j * 7 + 2] ?? 0;
			const dx = vxi - vxj;
			const dy = vyi - vyj;
			const dz = vzi - vzj;
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (dist < threshold) {
				edgeIndices.push(i, j);
			}
		}
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}

// 8. Gerador de Malha da Constelação Vetorial (RAG VectorDB)
export interface VectorMethodNode {
	id: string;
	name: string;
	kind?: string | undefined;
	signature?: string | undefined;
	orbitAngle?: number | undefined;
	orbitRadius?: number | undefined;
}

export interface VectorNodeInput {
	id: string;
	module: string;
	path?: string | undefined;
	relPath?: string | undefined;
	fileExtension?: string | undefined;
	language?: string | undefined;
	qualifiedName?: string | undefined;
	imports?: string[] | undefined;
	position: [number, number, number];
	isMatchedBySearch?: boolean | undefined;
	methods?: VectorMethodNode[] | undefined;
}

export type GeometryShapeType = "tesseract" | "icosahedron" | "merkaba" | "torus" | "dodecahedron";

export interface VectorEdgeInput {
	source: number;
	target: number;
	similarity: number;
	kind?: HermesEdgeKind | undefined;
}

const MODULE_COLORS: Record<string, [number, number, number, number]> = {
	"apps/web": [0.0, 0.85, 1.0, 0.9], // Ciano brilhante
	"packages/server": [0.8, 0.3, 1.0, 0.9], // Magenta
	contracts: [1.0, 0.75, 0.0, 0.95], // Ouro
	"packages/ui": [0.1, 1.0, 0.6, 0.9], // Esmeralda
	scripts: [1.0, 0.4, 0.4, 0.85], // Coral
	extensions: [0.4, 0.6, 1.0, 0.85], // Safira
	core: [0.9, 0.9, 1.0, 0.8], // Prata
};

/** Resolve cor do módulo com suporte a particionamento multi-projeto (slug:mod) */
export function resolveModuleColor(modName?: string): [number, number, number, number] {
	if (!modName) return MODULE_COLORS.core ?? [0.9, 0.9, 1.0, 0.8];
	if (MODULE_COLORS[modName]) return MODULE_COLORS[modName]!;

	// Se for prefixado por projeto (ex: hermes-3-0:core ou cindy:packages/server)
	if (modName.includes(":")) {
		const parts = modName.split(":");
		const subMod = parts.slice(1).join(":");
		if (MODULE_COLORS[subMod]) {
			return MODULE_COLORS[subMod]!;
		}
	}

	// Hash determinístico para projetos externos
	let hash = 0;
	for (let i = 0; i < modName.length; i++) {
		hash = (hash << 5) - hash + modName.charCodeAt(i);
		hash |= 0;
	}
	const hue = Math.abs(hash % 360);
	// Converte HSV para RGB básico para cor viva
	const h = hue / 60;
	const c = 0.85;
	const x = c * (1 - Math.abs((h % 2) - 1));
	let r = 0;
	let g = 0;
	let b = 0;
	if (h < 1) {
		r = c;
		g = x;
	} else if (h < 2) {
		r = x;
		g = c;
	} else if (h < 3) {
		g = c;
		b = x;
	} else if (h < 4) {
		g = x;
		b = c;
	} else if (h < 5) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return [r + 0.15, g + 0.15, b + 0.15, 0.88];
}

/** Paleta cromática e tipos geométricos dedicados por extensão de arquivo */
export type PolygonKind =
	| "cube"
	| "octahedron"
	| "tetrahedron"
	| "hex_bipyramid"
	| "prism"
	| "diamond"
	| "star_octahedron"
	| "icosahedron";

export const FILE_TYPE_COLORS: Record<string, [number, number, number, number]> = {
	tsx: [0.0, 0.88, 1.0, 0.95], // React TSX -> Ciano Elétrico
	ts: [0.18, 0.58, 1.0, 0.95], // TypeScript -> Azul Safira
	jsx: [1.0, 0.78, 0.12, 0.95], // React JSX -> Ouro Solar
	js: [0.95, 0.72, 0.15, 0.95], // JavaScript -> Âmbar Dourado
	md: [0.78, 0.38, 1.0, 0.9], // Markdown / Docs -> Magenta Cósmico
	json: [0.12, 0.95, 0.58, 0.92], // JSON Configs -> Verde Esmeralda Neon
	yaml: [0.12, 0.95, 0.58, 0.92], // YAML -> Verde Esmeralda Neon
	yml: [0.12, 0.95, 0.58, 0.92], // YML -> Verde Esmeralda Neon
	toml: [0.12, 0.95, 0.58, 0.92], // TOML -> Verde Esmeralda Neon
	sh: [1.0, 0.48, 0.12, 0.92], // Shell Scripts -> Laranja Cobre
	bat: [1.0, 0.48, 0.12, 0.92], // Batch Scripts -> Laranja Cobre
	ps1: [1.0, 0.48, 0.12, 0.92], // PowerShell -> Laranja Cobre
	cmd: [1.0, 0.48, 0.12, 0.92], // Windows CMD -> Laranja Cobre
	css: [1.0, 0.28, 0.68, 0.92], // CSS Styles -> Rosa Neon Fluorescente
	scss: [1.0, 0.28, 0.68, 0.92], // SCSS Styles -> Rosa Neon Fluorescente
	less: [1.0, 0.28, 0.68, 0.92], // LESS Styles -> Rosa Neon Fluorescente
	contracts: [1.0, 0.88, 0.18, 0.98], // Contratos / DTOs -> Ouro Incandescente
	dts: [1.0, 0.88, 0.18, 0.98], // Type Definitions -> Ouro Incandescente
	java: [0.9, 0.4, 0.2, 0.9], // Java -> Bronze Intenso
	kt: [0.65, 0.35, 1.0, 0.9], // Kotlin -> Púrpura
};

/** Detecta tipo de polígono conforme a extensão do arquivo */
export function getPolygonKindForFile(pathOrExt?: string): PolygonKind {
	if (!pathOrExt) return "octahedron";
	const clean = pathOrExt.toLowerCase();
	if (clean.endsWith(".d.ts") || clean === "dts" || clean.includes("contracts")) {
		return "icosahedron"; // Contratos e Definições de Tipos -> Icosaedro Sagrado
	}
	if (clean.endsWith(".tsx") || clean === "tsx") {
		return "cube"; // React TSX -> Hipercubo 3D
	}
	if (clean.endsWith(".ts") || clean === "ts") {
		return "octahedron"; // TypeScript -> Octaedro de 8 Faces
	}
	if (clean.endsWith(".jsx") || clean.endsWith(".js") || clean === "jsx" || clean === "js") {
		return "prism"; // JavaScript -> Prisma Triangular
	}
	if (
		clean.endsWith(".md") ||
		clean.endsWith(".txt") ||
		clean.endsWith(".doc") ||
		clean === "md" ||
		clean === "txt"
	) {
		return "tetrahedron"; // Docs / Markdown -> Tetraedro de 4 Faces
	}
	if (
		clean.endsWith(".json") ||
		clean.endsWith(".yaml") ||
		clean.endsWith(".yml") ||
		clean.endsWith(".toml") ||
		clean.endsWith(".xml") ||
		clean === "json" ||
		clean === "yaml" ||
		clean === "yml"
	) {
		return "hex_bipyramid"; // Configurações -> Bipirâmide Hexagonal
	}
	if (
		clean.endsWith(".bat") ||
		clean.endsWith(".sh") ||
		clean.endsWith(".ps1") ||
		clean.endsWith(".cmd") ||
		clean === "sh" ||
		clean === "bat"
	) {
		return "diamond"; // Scripts / Shell -> Diamante Duplo Alongado
	}
	if (
		clean.endsWith(".css") ||
		clean.endsWith(".scss") ||
		clean.endsWith(".less") ||
		clean === "css" ||
		clean === "scss"
	) {
		return "star_octahedron"; // Estilos / CSS -> Octaedro Estrelado / Merkaba
	}
	return "octahedron";
}

/** Retorna cor única para o tipo de arquivo, com fallback para cor do módulo */
export function resolveFileTypeColor(
	pathOrExt?: string,
	moduleName?: string,
): [number, number, number, number] {
	if (pathOrExt) {
		const clean = pathOrExt.toLowerCase();
		if (clean.endsWith(".d.ts") || clean.includes("contracts")) {
			return FILE_TYPE_COLORS.contracts!;
		}
		for (const [ext, color] of Object.entries(FILE_TYPE_COLORS)) {
			if (clean.endsWith(`.${ext}`) || clean === ext) {
				return color;
			}
		}
	}
	return resolveModuleColor(moduleName);
}

/** Interface de auditoria anti-plágio de impressão digital semântica */
export interface SemanticFingerprintInfo {
	fingerprintHash: string;
	shortHash: string;
	entropy: number;
	totalClasses: number;
	totalRelations: number;
	density: number;
	typeDistribution: Record<string, number>;
	auditBadge: string;
	integrityStatus: "VERIFIED_AUTHENTIC" | "HIGH_DENSITY" | "BALANCED";
}

/**
 * Calcula a impressão digital semântica do repositório a partir dos nós e arestas indexados no RAG.
 * Gera um hash determinístico da topologia semântica do código para servir de auditor anti-plágio.
 */
export function computeSemanticFingerprint(
	nodes: VectorNodeInput[],
	edges: VectorEdgeInput[],
): SemanticFingerprintInfo {
	if (!nodes || nodes.length === 0) {
		return {
			fingerprintHash: "0000000000000000000000000000000000000000000000000000000000000000",
			shortHash: "00000000",
			entropy: 0,
			totalClasses: 0,
			totalRelations: 0,
			density: 0,
			typeDistribution: {},
			auditBadge: "EMPTY",
			integrityStatus: "BALANCED",
		};
	}

	// 1. Distribuição de tipos de arquivo
	const typeDistribution: Record<string, number> = {};
	for (const n of nodes) {
		const kind = getPolygonKindForFile(n.fileExtension || n.relPath || n.path);
		typeDistribution[kind] = (typeDistribution[kind] || 0) + 1;
	}

	// 2. Entropia de Shannon da variedade tipológica
	let entropy = 0;
	const totalNodes = nodes.length;
	for (const count of Object.values(typeDistribution)) {
		const p = count / totalNodes;
		if (p > 0) {
			entropy -= p * Math.log2(p);
		}
	}

	// 3. Hash determinístico baseado em nós, métodos, coordenadas vetoriais e arestas
	let h1 = 0xdeadbeef;
	let h2 = 0x41c64e6d;
	let h3 = 0x9e3779b9;
	let h4 = 0x85ebca6b;

	const sortedNodes = [...nodes].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
	for (const n of sortedNodes) {
		const str = `${n.id}:${n.module}:${n.methods?.length || 0}:${n.position.map((v) => v.toFixed(3)).join(",")}`;
		for (let i = 0; i < str.length; i++) {
			const c = str.charCodeAt(i);
			h1 = Math.imul(h1 ^ c, 2654435761);
			h2 = Math.imul(h2 ^ c, 1597334677);
			h3 = Math.imul(h3 ^ c, 2246822519);
			h4 = Math.imul(h4 ^ c, 3266489917);
		}
	}

	for (const e of edges) {
		const eStr = `${e.source}->${e.target}:${e.kind || ""}:${(e.similarity || 0).toFixed(2)}`;
		for (let i = 0; i < eStr.length; i++) {
			const c = eStr.charCodeAt(i);
			h1 = Math.imul(h1 ^ c, 2246822519);
			h2 = Math.imul(h2 ^ c, 3266489917);
		}
	}

	const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
	const part1 = toHex(h1) + toHex(h2);
	const part2 = toHex(h3) + toHex(h4);
	const part3 = toHex(h1 ^ h3) + toHex(h2 ^ h4);
	const part4 = toHex(h1 + h2) + toHex(h3 + h4);
	const fingerprintHash = `${part1}${part2}${part3}${part4}`.toLowerCase();
	const shortHash = fingerprintHash.substring(0, 10).toUpperCase();

	const totalRelations = edges.length;
	const maxPossibleEdges = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) / 2 : 1;
	const density = Math.min(1.0, totalRelations / maxPossibleEdges);

	let integrityStatus: "VERIFIED_AUTHENTIC" | "HIGH_DENSITY" | "BALANCED" = "VERIFIED_AUTHENTIC";
	if (density > 0.4) integrityStatus = "HIGH_DENSITY";

	const auditBadge = `FINGERPRINT-${shortHash}`;

	return {
		fingerprintHash,
		shortHash,
		entropy: Number(entropy.toFixed(3)),
		totalClasses: totalNodes,
		totalRelations,
		density: Number(density.toFixed(4)),
		typeDistribution,
		auditBadge,
		integrityStatus,
	};
}

export interface SearchingNodeAnimState {
	nodeId: string;
	animProgress: number; // 0.0 a 1.0 (2 segundos)
}

export interface VectorRelationInfo {
	directNeighbors: Set<number>;
	callNeighbors: Set<number>;
	typeNeighbors: Set<number>;
	importNeighbors: Set<number>;
}

export function computeNodeRelations(
	selectedIndex: number | null,
	nodes: VectorNodeInput[],
	edges: VectorEdgeInput[],
): VectorRelationInfo {
	const directNeighbors = new Set<number>();
	const callNeighbors = new Set<number>();
	const typeNeighbors = new Set<number>();
	const importNeighbors = new Set<number>();

	if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= nodes.length) {
		return { directNeighbors, callNeighbors, typeNeighbors, importNeighbors };
	}

	const selectedNode = nodes[selectedIndex];
	if (!selectedNode) {
		return { directNeighbors, callNeighbors, typeNeighbors, importNeighbors };
	}

	const selectedNormRel = (selectedNode.relPath || selectedNode.path || "").toLowerCase();
	const selectedBaseName =
		selectedNormRel
			.split("/")
			.pop()
			?.replace(/\.[^.]+$/, "") || "";
	const selectedQName = (selectedNode.qualifiedName || selectedBaseName).toLowerCase();

	// 1. Mapeamento via arestas k-NN / dependências existentes
	for (const edge of edges) {
		let otherIdx: number | null = null;
		if (edge.source === selectedIndex) {
			otherIdx = edge.target;
		} else if (edge.target === selectedIndex) {
			otherIdx = edge.source;
		}
		if (otherIdx !== null && otherIdx >= 0 && otherIdx < nodes.length) {
			directNeighbors.add(otherIdx);
			if (edge.kind === "calls") {
				callNeighbors.add(otherIdx);
			} else if (
				edge.kind === "extends" ||
				edge.kind === "implements" ||
				edge.kind === "type_ref"
			) {
				typeNeighbors.add(otherIdx);
			} else if (edge.kind === "imports") {
				importNeighbors.add(otherIdx);
			}
		}
	}

	// 2. Mapeamento Semântico no Código / AST: relações por imports, callers e types de métodos
	for (let i = 0; i < nodes.length; i++) {
		if (i === selectedIndex) continue;
		const other = nodes[i];
		if (!other) continue;

		const otherNormRel = (other.relPath || other.path || "").toLowerCase();
		const otherBaseName =
			otherNormRel
				.split("/")
				.pop()
				?.replace(/\.[^.]+$/, "") || "";
		const otherQName = (other.qualifiedName || otherBaseName).toLowerCase();

		// Relação de import no arquivo
		const isImported =
			(selectedNode.imports || []).some((imp) => {
				const impLower = imp.toLowerCase();
				return impLower.includes(otherBaseName) || impLower.includes(otherQName);
			}) ||
			(other.imports || []).some((imp) => {
				const impLower = imp.toLowerCase();
				return impLower.includes(selectedBaseName) || impLower.includes(selectedQName);
			});

		if (isImported) {
			directNeighbors.add(i);
			importNeighbors.add(i);
		}

		// Relação de chamadas entre métodos e assinaturas
		const isMethodLinked = (selectedNode.methods || []).some((m) => {
			const mName = m.name.toLowerCase();
			const mSig = (m.signature || "").toLowerCase();
			return (
				mSig.includes(otherBaseName) ||
				(other.methods || []).some((om) => {
					const omName = om.name.toLowerCase();
					return mSig.includes(omName) || (om.signature || "").toLowerCase().includes(mName);
				})
			);
		});

		if (isMethodLinked) {
			directNeighbors.add(i);
			callNeighbors.add(i);
		}
	}

	return { directNeighbors, callNeighbors, typeNeighbors, importNeighbors };
}

export function createVectorConstellationWireframe(
	nodes: VectorNodeInput[],
	edges: VectorEdgeInput[],
	highlightedNodeIndex: number | null = null,
	_activeSearchQuery?: string | null,
	searchingAnim?: SearchingNodeAnimState | null,
	selectedNodeIndex: number | null = null,
	showPcbLines: boolean = true,
	animTime: number = 0,
): GeometryMeshData {
	const vertexFloats: number[] = [];
	const edgeIndices: number[] = [];
	let vOffset = 0;

	// Calcula relações e dependências caso haja polígono selecionado
	const relations = computeNodeRelations(selectedNodeIndex, nodes, edges);
	const hasActiveSelection =
		selectedNodeIndex !== null && selectedNodeIndex >= 0 && selectedNodeIndex < nodes.length;

	// 1. Gera nós com poliedros específicos por tipo de arquivo
	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		if (!n) continue;
		const [cx, cy, cz] = n.position;
		const isSelected = hasActiveSelection && i === selectedNodeIndex;
		const isRelated = hasActiveSelection && relations.directNeighbors.has(i);
		const isUnrelated = hasActiveSelection && !isSelected && !isRelated;

		const isHighlight = i === highlightedNodeIndex;
		const isMatched = Boolean(n.isMatchedBySearch);
		const isSearchingTarget = Boolean(searchingAnim && searchingAnim.nodeId === n.id);

		// Tamanho base reduzido e harmonioso para visual limpo sem sobreposição
		let s = 0.024;
		if (isSelected) {
			// Polígono Selecionado: aumento nítido (2.4x)
			s *= 2.4;
		} else if (isRelated) {
			// Polígonos de Classes Relacionadas: destaque reforçado
			s *= 1.7;
		} else if (isUnrelated) {
			// Polígonos sem relação direta: escala equilibrada sem sumir da tela
			s *= 0.65;
		} else if (isSearchingTarget && searchingAnim) {
			// Animação de vida gradativa em 2 segundos (pulso orgânico, expansão e breathing)
			const p = Math.max(0, Math.min(1, searchingAnim.animProgress));
			const lifePulse = 1.0 + Math.sin(p * Math.PI * 4) * 0.45 * (1.0 - p * 0.35);
			s *= 2.2 * lifePulse;
		} else if (isMatched) {
			s *= 1.8;
		} else if (isHighlight) {
			s *= 1.7; // Destaque nítido ao passar o mouse
		}

		let col: [number, number, number, number];
		if (isSelected) {
			// Nó selecionado: Ouro elétrico vibrante com 100% de opacidade
			col = [1.0, 0.9, 0.1, 1.0];
		} else if (isRelated) {
			// Classes relacionadas: cores distintas conforme tipo de relação
			if (relations.callNeighbors.has(i)) {
				col = [0.1, 1.0, 0.65, 0.95]; // Verde esmeralda para Callers/Callees de métodos
			} else if (relations.importNeighbors.has(i)) {
				col = [0.2, 0.85, 1.0, 0.95]; // Ciano vívido para Imports / Dependências estruturais
			} else if (relations.typeNeighbors.has(i)) {
				col = [1.0, 0.5, 0.9, 0.95]; // Magenta / Violeta para Tipos / Interfaces
			} else {
				col = [0.4, 0.9, 1.0, 0.9]; // Azul safira para conexões k-NN próximas
			}
		} else if (isUnrelated) {
			// Outros polígonos não relacionados mantêm definição geométrica visível sem poluir
			const baseMod = resolveFileTypeColor(n.fileExtension || n.relPath || n.path, n.module);
			col = [baseMod[0] * 0.65, baseMod[1] * 0.65, baseMod[2] * 0.65, 0.22];
		} else if (isSearchingTarget && searchingAnim) {
			// Transição de cor gradativa: do ciano vibrante ao magenta e ouro esmeralda vivo
			const p = Math.max(0, Math.min(1, searchingAnim.animProgress));
			const r = 0.1 + p * 0.9;
			const g = 0.9 - Math.sin(p * Math.PI) * 0.4 + p * 0.3;
			const b = 1.0 - p * 0.85;
			col = [Math.min(1, r), Math.min(1, g), Math.min(1, b), 1.0];
		} else if (isMatched) {
			col = [1.0, 0.9, 0.2, 1.0]; // Dourado brilhante quando pesquisado no RAG
		} else if (isHighlight) {
			col = [0.2, 1.0, 0.85, 1.0]; // Ciano-água incandescente sob cursor
		} else {
			// Cor única por tipo de arquivo (extensão) para impressão digital cromática
			col = resolveFileTypeColor(n.fileExtension || n.relPath || n.path, n.module);
		}
		const [colR, colG, colB, colA] = col;

		const polyKind = getPolygonKindForFile(n.fileExtension || n.relPath || n.path);
		const base = vOffset;

		if (polyKind === "cube") {
			// Cubo 3D (TypeScript/React): 8 vértices, 12 arestas
			const d = s * 0.85;
			for (let dx = -1; dx <= 1; dx += 2) {
				for (let dy = -1; dy <= 1; dy += 2) {
					for (let dz = -1; dz <= 1; dz += 2) {
						vertexFloats.push(cx + dx * d, cy + dy * d, cz + dz * d, colR, colG, colB, colA);
						vOffset++;
					}
				}
			}
			const cubeEdges = [0, 1, 1, 3, 3, 2, 2, 0, 4, 5, 5, 7, 7, 6, 6, 4, 0, 4, 1, 5, 2, 6, 3, 7];
			for (const e of cubeEdges) edgeIndices.push(base + e);
		} else if (polyKind === "tetrahedron") {
			// Tetraedro Sagrado (Markdown/Docs): 4 vértices, 6 arestas
			const d = s * 1.3;
			const tPts: [number, number, number][] = [
				[cx + d, cy + d, cz + d],
				[cx + d, cy - d, cz - d],
				[cx - d, cy + d, cz - d],
				[cx - d, cy - d, cz + d],
			];
			for (const [ptX, ptY, ptZ] of tPts) {
				vertexFloats.push(ptX, ptY, ptZ, colR, colG, colB, colA);
				vOffset++;
			}
			const tetEdges = [0, 1, 0, 2, 0, 3, 1, 2, 2, 3, 3, 1];
			for (const e of tetEdges) edgeIndices.push(base + e);
		} else if (polyKind === "prism") {
			// Prisma Triangular (Scripts/Shell): 6 vértices, 9 arestas
			const r = s * 1.1;
			const h = s * 1.2;
			for (let tri = -1; tri <= 1; tri += 2) {
				for (let a = 0; a < 3; a++) {
					const angle = (a / 3) * Math.PI * 2;
					vertexFloats.push(
						cx + Math.cos(angle) * r,
						cy + tri * h,
						cz + Math.sin(angle) * r,
						colR,
						colG,
						colB,
						colA,
					);
					vOffset++;
				}
			}
			const prismEdges = [0, 1, 1, 2, 2, 0, 3, 4, 4, 5, 5, 3, 0, 3, 1, 4, 2, 5];
			for (const e of prismEdges) edgeIndices.push(base + e);
		} else if (polyKind === "hex_bipyramid") {
			// Bipirâmide Hexagonal (JSON/Configs): 8 vértices, 18 arestas
			const r = s * 1.0;
			const h = s * 1.4;
			// Ápice superior e inferior
			vertexFloats.push(cx, cy + h, cz, colR, colG, colB, colA);
			vertexFloats.push(cx, cy - h, cz, colR, colG, colB, colA);
			vOffset += 2;
			// Anel equatorial de 6 vértices
			for (let k = 0; k < 6; k++) {
				const ang = (k / 6) * Math.PI * 2;
				vertexFloats.push(
					cx + Math.cos(ang) * r,
					cy,
					cz + Math.sin(ang) * r,
					colR,
					colG,
					colB,
					colA,
				);
				vOffset++;
			}
			for (let k = 0; k < 6; k++) {
				const eq = 2 + k;
				const nextEq = 2 + ((k + 1) % 6);
				edgeIndices.push(base + 0, base + eq); // Ápice sup -> eq
				edgeIndices.push(base + 1, base + eq); // Ápice inf -> eq
				edgeIndices.push(base + eq, base + nextEq); // Anel equatorial
			}
		} else if (polyKind === "diamond") {
			// Diamante Duplo Alongado (Scripts e Automação): 6 vértices alongados no eixo Y
			const r = s * 0.75;
			const h = s * 1.6;
			const pts: [number, number, number][] = [
				[cx, cy + h, cz],
				[cx, cy - h, cz],
				[cx + r, cy, cz],
				[cx - r, cy, cz],
				[cx, cy, cz + r],
				[cx, cy, cz - r],
			];
			for (const [ptX, ptY, ptZ] of pts) {
				vertexFloats.push(ptX, ptY, ptZ, colR, colG, colB, colA);
				vOffset++;
			}
			const dEdges = [0, 2, 0, 3, 0, 4, 0, 5, 1, 2, 1, 3, 1, 4, 1, 5, 2, 4, 4, 3, 3, 5, 5, 2];
			for (const e of dEdges) edgeIndices.push(base + e);
		} else if (polyKind === "star_octahedron") {
			// Merkaba / Octaedro Estrelado (Estilos CSS/SCSS): dois tetraedros interpenetrados
			const d = s * 0.95;
			const t1: [number, number, number][] = [
				[cx + d, cy + d, cz + d],
				[cx + d, cy - d, cz - d],
				[cx - d, cy + d, cz - d],
				[cx - d, cy - d, cz + d],
			];
			const t2: [number, number, number][] = [
				[cx - d, cy - d, cz - d],
				[cx - d, cy + d, cz + d],
				[cx + d, cy - d, cz + d],
				[cx + d, cy + d, cz - d],
			];
			for (const [ptX, ptY, ptZ] of [...t1, ...t2]) {
				vertexFloats.push(ptX, ptY, ptZ, colR, colG, colB, colA);
				vOffset++;
			}
			const tetEdges = [0, 1, 0, 2, 0, 3, 1, 2, 2, 3, 3, 1];
			for (const e of tetEdges) {
				edgeIndices.push(base + e);
				edgeIndices.push(base + 4 + e);
			}
		} else if (polyKind === "icosahedron") {
			// Icosaedro Geodésico (Contratos e Definições de Tipos): 12 vértices, 30 arestas
			const phi = (1.0 + Math.sqrt(5.0)) / 2.0;
			const a = s * 0.9;
			const b = a / phi;
			const icoRaw: [number, number, number][] = [
				[-a, b, 0],
				[a, b, 0],
				[-a, -b, 0],
				[a, -b, 0],
				[0, -a, b],
				[0, a, b],
				[0, -a, -b],
				[0, a, -b],
				[b, 0, -a],
				[b, 0, a],
				[-b, 0, -a],
				[-b, 0, a],
			];
			for (const [vx, vy, vz] of icoRaw) {
				vertexFloats.push(cx + vx, cy + vy, cz + vz, colR, colG, colB, colA);
				vOffset++;
			}
			const icoEdges = [
				0, 11, 0, 5, 0, 1, 0, 7, 0, 10, 3, 9, 3, 4, 3, 2, 3, 6, 3, 8, 1, 5, 5, 9, 9, 4, 4, 2, 2,
				10, 10, 7, 7, 8, 8, 1, 1, 9, 4, 6, 2, 6, 6, 8, 7, 10, 5, 11, 11, 2, 11, 10, 11, 4, 11, 9,
				5, 1, 7, 8,
			];
			for (const e of icoEdges) edgeIndices.push(base + e);
		} else {
			// Octaedro Padrão (TypeScript .ts / Kotlin / Java): 6 vértices, 12 arestas
			const pts: [number, number, number][] = [
				[cx, cy + s, cz],
				[cx, cy - s, cz],
				[cx + s, cy, cz],
				[cx - s, cy, cz],
				[cx, cy, cz + s],
				[cx, cy, cz - s],
			];
			for (const [ptX, ptY, ptZ] of pts) {
				vertexFloats.push(ptX, ptY, ptZ, colR, colG, colB, colA);
				vOffset++;
			}
			const octEdges = [0, 2, 0, 3, 0, 4, 0, 5, 1, 2, 1, 3, 1, 4, 1, 5, 2, 4, 4, 3, 3, 5, 5, 2];
			for (const e of octEdges) edgeIndices.push(base + e);
		}

		// 1.1 Renderização de Sub-Órbita de Métodos/Funções para Classes AST
		if (n.methods && n.methods.length > 0) {
			const totalM = n.methods.length;
			for (let mIdx = 0; mIdx < totalM; mIdx++) {
				const m = n.methods[mIdx];
				if (!m) continue;
				const mAngle = m.orbitAngle ?? (mIdx / totalM) * Math.PI * 2;
				const mRadius = m.orbitRadius ?? 0.16;

				const mx = cx + Math.cos(mAngle) * mRadius;
				const my = cy + Math.sin(mAngle) * 0.45 * mRadius;
				const mz = cz + Math.sin(mAngle) * mRadius;

				// Micro-diamante para a função na sub-órbita
				const ms = s * 0.38;
				const mBase = vOffset;
				const [mColR, mColG, mColB, mColA]: [number, number, number, number] = isMatched
					? [1.0, 0.9, 0.2, 0.95]
					: [colR, colG, colB, 0.75];

				const mPts: [number, number, number][] = [
					[mx, my + ms, mz],
					[mx, my - ms, mz],
					[mx + ms, my, mz],
					[mx - ms, my, mz],
					[mx, my, mz + ms],
					[mx, my, mz - ms],
				];
				for (const [ptX, ptY, ptZ] of mPts) {
					vertexFloats.push(ptX, ptY, ptZ, mColR, mColG, mColB, mColA);
					vOffset++;
				}
				const mOctEdges = [0, 2, 0, 3, 0, 4, 0, 5, 1, 2, 1, 3, 1, 4, 1, 5, 2, 4, 4, 3, 3, 5, 5, 2];
				for (const me of mOctEdges) edgeIndices.push(mBase + me);

				// Linha orbital conectando o centro da classe ao ponto do método
				const lineStart = vOffset;
				vertexFloats.push(cx, cy, cz, colR, colG, colB, 0.25);
				vertexFloats.push(mx, my, mz, mColR, mColG, mColB, 0.45);
				vOffset += 2;
				edgeIndices.push(lineStart, lineStart + 1);
			}
		}

		// Feixe luminoso de Trajetória Graphify partindo do centro até nós combinados na busca
		if (isMatched) {
			const bStart = vOffset;
			vertexFloats.push(0, 0, 0, 1.0, 0.85, 0.0, 0.85); // Centro dourado
			vertexFloats.push(cx, cy, cz, 0.0, 1.0, 0.8, 0.95); // Nó ciano incandescente
			vOffset += 2;
			edgeIndices.push(bStart, bStart + 1);
		}
	}

	// 2. Conexões de arestas k-NN estilo Trilha de Circuito Impresso (PCB Traces Manhattan Routing)
	// Roteadas em ângulos retos (90° / vias) com elevação de camada de cobre para NUNCA transfixar o corpo dos nós
	// Pode ser ocultado via toggle para desobstruir a visualização de centenas de classes e polígonos.
	if (showPcbLines) {
		for (const edge of edges) {
			if (edge.source >= nodes.length || edge.target >= nodes.length) continue;
			const n1 = nodes[edge.source];
			const n2 = nodes[edge.target];
			if (!n1 || !n2) continue;

			const isConnectedToSelected =
				hasActiveSelection &&
				(edge.source === selectedNodeIndex || edge.target === selectedNodeIndex);
			const isEdgeUnrelated = hasActiveSelection && !isConnectedToSelected;

			const p1 = n1.position;
			const p2 = n2.position;

			// Camada de elevação da trilha (PCB Copper Trace Layer) com separação Multi-Camada (Multi-Layer PCB)
			// Para evitar cruzamento e sobreposição feia no mesmo plano Y, escalonamos a altura da trilha
			// em 4 camadas discretas de cobre baseadas no hash dos nós e no tipo de relação.
			const pairHash = Math.abs((edge.source * 31 + edge.target * 17) % 4);
			const layerOffset = pairHash * 0.018; // Camadas L1 a L4 (0.000, 0.018, 0.036, 0.054)
			const traceY = Math.max(p1[1], p2[1]) + 0.038 + layerOffset;
			let alpha = Math.min(0.75, Math.max(0.18, edge.similarity * 0.85));

			// Cores de trilha metálica condutora (Ouro/Cobre e Turquesa)
			const isCrossProject =
				n1.module.includes(":") &&
				n2.module.includes(":") &&
				n1.module.split(":")[0] !== n2.module.split(":")[0];
			let trColR = isCrossProject ? 1.0 : 0.15;
			let trColG = isCrossProject ? 0.75 : 0.85;
			let trColB = isCrossProject ? 0.2 : 0.95;

			if (isConnectedToSelected) {
				const otherIdx = edge.source === selectedNodeIndex ? edge.target : edge.source;
				if (relations.callNeighbors.has(otherIdx)) {
					// Chamada de método / Caller
					trColR = 0.1;
					trColG = 1.0;
					trColB = 0.65;
					alpha = 0.95;
				} else if (relations.importNeighbors.has(otherIdx)) {
					// Importação de dependência
					trColR = 0.2;
					trColG = 0.85;
					trColB = 1.0;
					alpha = 0.95;
				} else if (relations.typeNeighbors.has(otherIdx)) {
					// Tipo / Interface
					trColR = 1.0;
					trColG = 0.45;
					trColB = 0.9;
					alpha = 0.95;
				} else {
					// k-NN relevante
					trColR = 1.0;
					trColG = 0.85;
					trColB = 0.2;
					alpha = 0.9;
				}
			} else if (isEdgeUnrelated) {
				// Esmaecer arestas que não conectam ao nó selecionado
				alpha = 0.03;
				trColR *= 0.3;
				trColG *= 0.3;
				trColB *= 0.3;
			}

			// Roteamento Ortogonal com Alternância de Eixos (Anti-Colisão Manhattan):
			// Trilha ímpar desvia primeiro em X, trilha par desvia primeiro em Z.
			// Isso divide o tráfego espacial pela metade, impedindo linhas colineares cruzadas.
			const routeOrder = (edge.source + edge.target) % 2 === 0;
			const midX = p1[0] + (p2[0] - p1[0]) * (0.45 + (pairHash % 3) * 0.05);
			const midZ = p1[2] + (p2[2] - p1[2]) * (0.45 + (pairHash % 3) * 0.05);

			// Segmentos da trilha PCB com vias anti-transfixação:
			const tracePts: [number, number, number][] = routeOrder
				? [
						[p1[0], p1[1], p1[2]],
						[p1[0], traceY, p1[2]],
						[midX, traceY, p1[2]],
						[midX, traceY, p2[2]],
						[p2[0], traceY, p2[2]],
						[p2[0], p2[1], p2[2]],
					]
				: [
						[p1[0], p1[1], p1[2]],
						[p1[0], traceY, p1[2]],
						[p1[0], traceY, midZ],
						[p2[0], traceY, midZ],
						[p2[0], traceY, p2[2]],
						[p2[0], p2[1], p2[2]],
					];

			const baseIdx = vOffset;
			for (const [tx, ty, tz] of tracePts) {
				vertexFloats.push(tx, ty, tz, trColR, trColG, trColB, alpha);
				vOffset++;
			}

			// Adiciona os 5 segmentos interligados
			edgeIndices.push(
				baseIdx + 0,
				baseIdx + 1,
				baseIdx + 1,
				baseIdx + 2,
				baseIdx + 2,
				baseIdx + 3,
				baseIdx + 3,
				baseIdx + 4,
				baseIdx + 4,
				baseIdx + 5,
			);

			// Micro-via metálica (Pad circular de 4 pontos) no ponto de inflexão
			const viaR = 0.016;
			const viaBase = vOffset;
			vertexFloats.push(midX + viaR, traceY, midX ? p1[2] : 0, 1.0, 0.85, 0.3, alpha * 0.9);
			vertexFloats.push(midX - viaR, traceY, midX ? p1[2] : 0, 1.0, 0.85, 0.3, alpha * 0.9);
			vertexFloats.push(midX, traceY, p1[2] + viaR, 1.0, 0.85, 0.3, alpha * 0.9);
			vertexFloats.push(midX, traceY, p1[2] - viaR, 1.0, 0.85, 0.3, alpha * 0.9);
			vOffset += 4;
			edgeIndices.push(viaBase + 0, viaBase + 1, viaBase + 2, viaBase + 3);
		}
	}

	// 3. Linhas de Relacionamento de Dependências com Pulso Animado e Fluxo Direcional (Anti-Cruzamento)
	// Quando um polígono é selecionado, conecta todas as classes/arquivos relacionados (chamadas, imports, interfaces).
	// Utiliza canais discretos de altura Y e desvios ortogonais para que NUNCA se cruzem no espaço 3D.
	if (hasActiveSelection && selectedNodeIndex !== null) {
		const selNode = nodes[selectedNodeIndex];
		if (selNode) {
			const [sx, sy, sz] = selNode.position;
			let neighborOrder = 0;

			for (const neighborIdx of relations.directNeighbors) {
				const neighbor = nodes[neighborIdx];
				if (!neighbor) continue;
				const [nx, ny, nz] = neighbor.position;

				// Cores distintas dos polígonos: Neon de alto contraste para linhas de dependência e fluxo
				let rCol: [number, number, number] = [1.0, 0.65, 0.0]; // Ouro Solar (k-NN)
				if (relations.callNeighbors.has(neighborIdx)) {
					rCol = [0.2, 1.0, 0.1]; // Verde Fluorescente (Chamadas de Métodos / Callers / Callees)
				} else if (relations.importNeighbors.has(neighborIdx)) {
					rCol = [0.0, 0.75, 1.0]; // Ciano Elétrico (Importações Estruturais)
				} else if (relations.typeNeighbors.has(neighborIdx)) {
					rCol = [1.0, 0.15, 0.9]; // Magenta Laser (Interfaces e Definições de Tipos)
				}

				// Altura de camada Y dedicada por relação para NUNCA cruzar no espaço 3D
				const layerElevation = 0.048 + (neighborOrder % 12) * 0.024;
				const routeY = Math.max(sy, ny) + layerElevation;
				neighborOrder++;

				// Roteamento ortogonal Manhattan em 4 segmentos livres de colisão
				const waypoints: [number, number, number][] = [
					[sx, sy, sz], // Origem: Polígono selecionado
					[sx, routeY, sz], // Elevação vertical na camada de cobre dedicada
					[nx, routeY, sz], // Trânsito no plano X
					[nx, routeY, nz], // Trânsito no plano Z
					[nx, ny, nz], // Conexão vertical ao nó relacionado
				];

				// Desenha a linha subdividida em segmentos com onda de pulso viajante (fluxo direcional)
				const totalSegments = waypoints.length - 1;
				for (let seg = 0; seg < totalSegments; seg++) {
					const pStart = waypoints[seg]!;
					const pEnd = waypoints[seg + 1]!;
					const steps = 3; // Subdivisão fina para propagação do feixe de pulso

					for (let st = 0; st < steps; st++) {
						const u1 = (seg * steps + st) / (totalSegments * steps);
						const u2 = (seg * steps + st + 1) / (totalSegments * steps);

						const x1 = pStart[0] + (pEnd[0] - pStart[0]) * (st / steps);
						const y1 = pStart[1] + (pEnd[1] - pStart[1]) * (st / steps);
						const z1 = pStart[2] + (pEnd[2] - pStart[2]) * (st / steps);

						const x2 = pStart[0] + (pEnd[0] - pStart[0]) * ((st + 1) / steps);
						const y2 = pStart[1] + (pEnd[1] - pStart[1]) * ((st + 1) / steps);
						const z2 = pStart[2] + (pEnd[2] - pStart[2]) * ((st + 1) / steps);

						// Onda senoidal viajante no tempo animTime mostrando a direção do fluxo de dependência
						const wave1 = Math.sin(animTime * 6.5 - u1 * Math.PI * 4.0);
						const wave2 = Math.sin(animTime * 6.5 - u2 * Math.PI * 4.0);
						const alpha1 = Math.max(0.2, 0.45 + wave1 * 0.55);
						const alpha2 = Math.max(0.2, 0.45 + wave2 * 0.55);

						const lIdx = vOffset;
						vertexFloats.push(x1, y1, z1, rCol[0], rCol[1], rCol[2], alpha1);
						vertexFloats.push(x2, y2, z2, rCol[0], rCol[1], rCol[2], alpha2);
						vOffset += 2;
						edgeIndices.push(lIdx, lIdx + 1);
					}
				}

				// Indicador direcional de fluxo na chegada ao nó vizinho (Micro-flecha ou anel direcional 3D)
				const arrBase = vOffset;
				const arrSize = 0.018;
				const arrPulse = 0.5 + Math.sin(animTime * 8.0) * 0.5;
				const arrAlpha = Math.max(0.4, arrPulse);

				// Losango indicador de ponta no nó conectado
				vertexFloats.push(nx, ny + arrSize, nz, rCol[0], rCol[1], rCol[2], arrAlpha);
				vertexFloats.push(nx + arrSize, ny, nz, rCol[0], rCol[1], rCol[2], arrAlpha);
				vertexFloats.push(nx, ny - arrSize, nz, rCol[0], rCol[1], rCol[2], arrAlpha);
				vertexFloats.push(nx - arrSize, ny, nz, rCol[0], rCol[1], rCol[2], arrAlpha);
				vOffset += 4;
				edgeIndices.push(
					arrBase + 0,
					arrBase + 1,
					arrBase + 1,
					arrBase + 2,
					arrBase + 2,
					arrBase + 3,
					arrBase + 3,
					arrBase + 0,
				);
			}
		}
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint32Array(edgeIndices),
		count: edgeIndices.length,
	};
}
