import type { HermesVectorNode } from "@thinkrail/contracts";

/**
 * Resolve a classe ou nó pivô no grafo vetorial 3D correspondente a um arquivo
 * ou símbolo sendo manipulado pelo chat (ferramentas read, edit ou write).
 */
export function resolvePivotNode(
	filePath: string | undefined,
	vectorNodes: HermesVectorNode[],
	fallbackClassName?: string | undefined,
): HermesVectorNode | null {
	if ((!filePath && !fallbackClassName) || vectorNodes.length === 0) return null;

	const cleanPath = (filePath || "").replace(/\\/g, "/").toLowerCase().trim();
	const fileName = cleanPath.split("/").pop() || "";
	const baseName = fileName.replace(/\.[^.]+$/, "");
	const targetClassName = (fallbackClassName || baseName).toLowerCase().trim();

	// 1. Coleta todos os nós cujo path ou relPath corresponde ao arquivo
	const fileCandidates = vectorNodes.filter((node) => {
		const p = (node.path || "").replace(/\\/g, "/").toLowerCase();
		const rel = (node.relPath || "").replace(/\\/g, "/").toLowerCase();
		return (
			(cleanPath && (p.endsWith(cleanPath) || rel.endsWith(cleanPath))) ||
			(cleanPath && (cleanPath.endsWith(rel) || cleanPath.endsWith(p))) ||
			(fileName && (p.endsWith(`/${fileName}`) || rel.endsWith(`/${fileName}`) || rel === fileName))
		);
	});

	if (fileCandidates.length > 0) {
		// Prioridade 1: nó com chunkKind == "class"
		const classNode = fileCandidates.find(
			(n) => (n.chunkKind || "").toLowerCase() === "class",
		);
		if (classNode) return classNode;

		// Prioridade 2: nó cujo qualifiedName bate com a classe pivô
		if (targetClassName) {
			const nameMatch = fileCandidates.find((n) => {
				const qn = (n.qualifiedName || "").toLowerCase();
				return qn === targetClassName || qn.endsWith(`.${targetClassName}`) || qn.endsWith(`::${targetClassName}`);
			});
			if (nameMatch) return nameMatch;
		}

		// Prioridade 3: primeiro nó do arquivo
		return fileCandidates[0] ?? null;
	}

	// 2. Se não encontrou por caminho exato, tenta encontrar pelo nome da classe/símbolo pivô
	if (targetClassName && targetClassName.length >= 3) {
		const classNode = vectorNodes.find((n) => {
			const qn = (n.qualifiedName || "").toLowerCase();
			return (
				qn === targetClassName ||
				qn.endsWith(`.${targetClassName}`) ||
				qn.endsWith(`::${targetClassName}`)
			);
		});
		if (classNode) return classNode;
	}

	return null;
}
