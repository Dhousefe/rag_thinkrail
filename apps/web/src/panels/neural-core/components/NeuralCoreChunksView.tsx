import type { HermesChunkItem } from "@thinkrail/contracts";
import { RiFileCopyLine, RiRefreshLine } from "@remixicon/react";
import { toast } from "@/store";

export interface NeuralCoreChunksViewProps {
	chunks: HermesChunkItem[];
	isLoading: boolean;
}

export function NeuralCoreChunksView({ chunks, isLoading }: NeuralCoreChunksViewProps) {
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
		<div className="flex flex-col gap-6 max-h-[280px] overflow-y-auto pr-4 min-h-0 flex-1">
			{chunks.map((c, idx) => (
				<div
					key={c.id || idx}
					className="rounded-md border border-border-default bg-container-workspace-bg p-8 flex flex-col gap-4 hover:border-primary transition-colors"
				>
					{/* Cabeçalho do Chunk */}
					<div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-default pb-4">
						<div className="flex items-center gap-6 min-w-0">
							<span className="rounded bg-control-bg px-6 py-2 tr-code-text text-primary uppercase shrink-0">
								{c.chunkKind}
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
								className="hover:text-primary p-2 transition-colors cursor-pointer"
								title="Copiar conteúdo do chunk"
								aria-label="Copiar conteúdo do chunk"
							>
								<RiFileCopyLine className="size-12" />
							</button>
						</div>
					</div>

					{/* Assinatura do Chunk */}
					{c.signature && (
						<span className="tr-code-text text-feedback-info bg-container-elevated-bg px-6 py-2 rounded break-all">
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
			))}
		</div>
	);
}
