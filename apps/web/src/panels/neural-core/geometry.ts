export type GeometryShapeType = "tesseract" | "icosahedron" | "merkaba" | "torus" | "dodecahedron";

export interface GeometryMeshData {
	// Array intercalado: [x, y, z, r, g, b, a, ...]
	vertices: Float32Array;
	// Índices para LINES (arestas wireframe)
	indices: Uint16Array;
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
	position: [number, number, number];
	isMatchedBySearch?: boolean | undefined;
	methods?: VectorMethodNode[] | undefined;
}

export interface VectorEdgeInput {
	source: number;
	target: number;
	similarity: number;
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

/** Detecta tipo de polígono conforme a extensão do arquivo */
export function getPolygonKindForFile(
	pathOrExt?: string,
): "cube" | "octahedron" | "tetrahedron" | "hex_bipyramid" | "prism" | "diamond" {
	if (!pathOrExt) return "octahedron";
	const clean = pathOrExt.toLowerCase();
	if (
		clean.endsWith(".ts") ||
		clean.endsWith(".tsx") ||
		clean.endsWith(".js") ||
		clean.endsWith(".jsx") ||
		clean === "ts" ||
		clean === "tsx"
	) {
		return "cube"; // TypeScript / React -> Cubo
	}
	if (clean.endsWith(".kt") || clean.endsWith(".java") || clean === "kt" || clean === "java") {
		return "octahedron"; // Kotlin / Java -> Octaedro
	}
	if (clean.endsWith(".md") || clean.endsWith(".txt") || clean.endsWith(".doc") || clean === "md") {
		return "tetrahedron"; // Docs / Markdown -> Tetraedro
	}
	if (
		clean.endsWith(".json") ||
		clean.endsWith(".yaml") ||
		clean.endsWith(".yml") ||
		clean.endsWith(".toml") ||
		clean.endsWith(".xml")
	) {
		return "hex_bipyramid"; // Configurações -> Bipirâmide Hexagonal
	}
	if (
		clean.endsWith(".bat") ||
		clean.endsWith(".sh") ||
		clean.endsWith(".ps1") ||
		clean.endsWith(".cmd")
	) {
		return "prism"; // Scripts / Shell -> Prisma Triangular
	}
	return "diamond";
}

export interface SearchingNodeAnimState {
	nodeId: string;
	animProgress: number; // 0.0 a 1.0 (2 segundos)
}

export function createVectorConstellationWireframe(
	nodes: VectorNodeInput[],
	edges: VectorEdgeInput[],
	highlightedNodeIndex: number | null = null,
	_activeSearchQuery?: string | null,
	searchingAnim?: SearchingNodeAnimState | null,
): GeometryMeshData {
	const vertexFloats: number[] = [];
	const edgeIndices: number[] = [];
	let vOffset = 0;

	// 1. Gera nós com poliedros específicos por tipo de arquivo
	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		if (!n) continue;
		const [cx, cy, cz] = n.position;
		const isHighlight = i === highlightedNodeIndex;
		const isMatched = Boolean(n.isMatchedBySearch);
		const isSearchingTarget = Boolean(searchingAnim && searchingAnim.nodeId === n.id);

		// Tamanho base reduzido e harmonioso para visual limpo sem sobreposição
		let s = 0.024;
		if (isSearchingTarget && searchingAnim) {
			// Animação de vida gradativa em 2 segundos (pulso orgânico, expansão e breathing)
			const p = Math.max(0, Math.min(1, searchingAnim.animProgress));
			const lifePulse = 1.0 + Math.sin(p * Math.PI * 4) * 0.45 * (1.0 - p * 0.35);
			s *= 2.2 * lifePulse;
		} else if (isMatched) {
			s *= 1.8;
		} else if (isHighlight) {
			s *= 1.7; // Destaque nítido ao passar o mouse
		}

		const defaultCol: [number, number, number, number] = MODULE_COLORS.core ?? [0.9, 0.9, 1.0, 0.8];
		let col: [number, number, number, number];
		if (isSearchingTarget && searchingAnim) {
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
			col = MODULE_COLORS[n.module] ?? defaultCol;
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
		} else {
			// Octaedro Padrão (Kotlin/Java/Core): 6 vértices, 12 arestas
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

	// 2. Conexões de arestas k-NN entre os nós com linha direta
	for (const edge of edges) {
		if (edge.source >= nodes.length || edge.target >= nodes.length) continue;
		const n1 = nodes[edge.source];
		const n2 = nodes[edge.target];
		if (!n1 || !n2) continue;

		const p1 = n1.position;
		const p2 = n2.position;

		const v1Idx = vOffset;
		const v2Idx = vOffset + 1;

		// Cor da linha de similaridade com opacidade proporcional ao cosseno
		const alpha = Math.min(0.65, Math.max(0.15, edge.similarity * 0.8));
		vertexFloats.push(p1[0], p1[1], p1[2], 0.2, 0.7, 0.9, alpha);
		vertexFloats.push(p2[0], p2[1], p2[2], 0.5, 0.3, 0.9, alpha);
		vOffset += 2;

		edgeIndices.push(v1Idx, v2Idx);
	}

	return {
		vertices: new Float32Array(vertexFloats),
		indices: new Uint16Array(edgeIndices),
		count: edgeIndices.length,
	};
}
