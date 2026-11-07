import type { HermesChunkItem } from "@thinkrail/contracts";
import {
	RiCodeSSlashLine,
	RiFileCopyLine,
	RiFilter3Line,
	RiFunctionLine,
	RiInputField,
	RiNodeTree,
	RiRefreshLine,
} from "@remixicon/react";
import { useMemo, useState } from "react";
import { toast } from "@/store";

export interface NeuralCoreChunksViewProps {
	chunks: HermesChunkItem[];
	isLoading: boolean;
}

type ChunkFilterCategory = "all" | "methods" | "vars" | "types";

function getChunkKindMeta(kind?: string): { label: string; badgeClass: string; icon: any } {
	const k = (kind || "").toLowerCase();
	if (k.includes("class") || k.includes("struct") || k.includes("impl")) {
		return { label: "class", badgeClass: "bg-primary text-text-on-primary", icon: RiNodeTree };
	}
	if (k.includes("func") || k.includes("method") || k.includes("handler")) {
		return { label: "fn", badgeClass: "bg-feedback-info text-container-workspace-bg", icon: RiFunctionLine };
	}
	if (k.includes("const") || k.includes("var") || k.includes("let") || k.includes("field")) {
		return { label: "var", badgeClass: "bg-feedback-warning text-container-workspace-bg", icon: RiInputField };
	}
	if (k.includes("type") || k.includes("interface") || k.includes("enum")) {
		return { label: "type", badgeClass: "bg-feedback-success text-container-workspace-bg", icon: RiCodeSSlashLine };
	}
	return { label: kind || "chunk", badgeClass: "bg-control-bg text-text-muted", icon: RiCodeSSlashLine };
}

export function NeuralCoreChunksView({ chunks, isLoading }: NeuralCoreChunksViewProps) {
	const [activeFilter, setActiveFilter] = useState<ChunkFilterCategory>("all");
	const [searchQuery, setSearchQuery] = useState("");

	const filteredChunks = useMemo(() => {
		let list = chunks;
		if (activeFilter === "methods") {
			list = list.filter((c) => {
				const k = (c.chunkKind || "").toLowerCase();
				return k.includes("func") || k.includes("method");
			});
		} else if (activeFilter === "vars") {
			list = list.filter((c) => {
				const k = (c.chunkKind || "").toLowerCase();
				return k.includes("var") || k.includes("const") || k.includes("field");
			});
		} else if (activeFilter === "types") {
			list = list.filter((c) => {
				const k = (c.chunkKind || "").toLowerCase();
				return k.includes("type") || k.includes("interface") || k.includes("enum");
			});
		}

		if (searchQuery.trim().length > 0) {
			const q = searchQuery.toLowerCase().trim();
			const terms = q.split(/\s+/).filter(Boolean);
			list = list.filter((c) => {
				const name = (c.qualifiedName || c.relPath || "").toLowerCase();
				const sig = (c.signature || "").toLowerCase();
				const content = (c.content || "").toLowerCase();
				const kind = (c.chunkKind || "").toLowerCase();
				return terms.every(
					(term) =>
						name.includes(term) ||
						sig.includes(term) ||
						content.includes(term) ||
						kind.includes(term),
				);
			});
		}

		return list;
	}, [chunks, activeFilter, searchQuery]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-6 p-16 tr-text-metadata text-text-muted">
				<RiRefreshLine className="size-14 animate-spin text-feedback-warning" />
				<span>Carregando chunks indexados do SQLite Hermes...</span>
			</div>
		);
	}

	if (chunks.length === 0) {
		return (
			<div className="p-16 text-center tr-text-metadata text-text-muted">
				Nenhum chunk registrado para esta classe no SQLite Hermes.
			</div>
		);
	}

	const handleCopyChunk = (c: HermesChunkItem) => {
		void navigator.clipboard.writeText(c.content);
		toast.success("Chunk copiado para a área de transferência", c.qualifiedName || c.relPath);
	};

	return (
		<div className="flex flex-col gap-6 max-h-[300px] overflow-hidden min-h-0 flex-1">
			{/* Barra de Filtros Rápidos por Facetas e Campo de Filtro Interno */}
			<div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4 shrink-0 select-none">
				<div className="flex flex-wrap items-center gap-4">
					<RiFilter3Line className="size-12 text-text-muted" />
					{(
						[
							{
								id: "all",
								label:
									filteredChunks.length !== chunks.length
										? `Todos (${filteredChunks.length}/${chunks.length})`
										: `Todos (${chunks.length})`,
							},
							{ id: "methods", label: "Métodos" },
							{ id: "vars", label: "Variáveis / Const" },
							{ id: "types", label: "Tipos" },
						] as const
					).map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveFilter(tab.id)}
							className={`px-6 py-2 rounded tr-text-metadata transition-colors cursor-pointer ${
								activeFilter === tab.id
									? "bg-primary text-text-on-primary tr-text-emphasis shadow-xs"
									: "bg-container-workspace-bg text-text-muted hover:text-text-default hover:bg-control-bg"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Filtrar nestes chunks..."
					className="bg-container-workspace-bg border border-border-default rounded px-6 py-2 tr-code-text text-text-default placeholder:text-text-muted outline-none focus:border-primary max-w-[200px]"
				/>
			</div>

			{/* Lista de Chunks com Design UI/UX Pro Max */}
			<div className="flex flex-col gap-6 overflow-y-auto pr-4 min-h-0 flex-1">
				{filteredChunks.length === 0 ? (
					<div className="p-12 text-center tr-text-metadata text-text-muted">
						Nenhum chunk corresponde aos filtros selecionados.
					</div>
				) : (
					filteredChunks.map((c, idx) => {
						const meta = getChunkKindMeta(c.chunkKind);
						const MetaIcon = meta.icon;
						return (
							<div
								key={c.id || idx}
								className="rounded-lg border border-border-default bg-container-workspace-bg p-8 flex flex-col gap-4 hover:border-primary transition-colors shadow-xs"
							>
								{/* Cabeçalho do Chunk */}
								<div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4">
									<div className="flex items-center gap-6 min-w-0">
										<span
											className={`flex items-center gap-2 rounded px-6 py-2 tr-text-caption uppercase ${meta.badgeClass}`}
										>
											<MetaIcon className="size-10" />
											{meta.label}
										</span>
										<span className="tr-code-text text-text-default truncate tr-text-emphasis">
											{c.qualifiedName || c.relPath}
										</span>
									</div>

									<div className="flex items-center gap-6 tr-text-metadata text-text-muted shrink-0">
										<span>
											L{c.startLine || 1} - L{c.endLine || "?"}
										</span>
										<span>·</span>
										<span>~{c.tokenEstimate || 0} tokens</span>
										<span>·</span>
										<button
											type="button"
											onClick={() => handleCopyChunk(c)}
											className="hover:text-primary p-2 transition-colors cursor-pointer rounded"
											title="Copiar conteúdo do chunk"
											aria-label="Copiar conteúdo do chunk"
										>
											<RiFileCopyLine className="size-12" />
										</button>
									</div>
								</div>

								{/* Assinatura do Chunk */}
								{c.signature && (
									<span className="tr-code-text text-feedback-info bg-container-elevated-bg px-6 py-2 rounded break-all border border-border-default">
										{c.signature}
									</span>
								)}

								{/* Código Fonte do Chunk com Scroll Interno Próprio */}
								<div className="max-h-[140px] overflow-y-auto rounded bg-container-elevated-bg p-6 border border-border-default select-text">
									<pre className="tr-code-text text-text-muted whitespace-pre-wrap leading-relaxed">
										{c.content}
									</pre>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

