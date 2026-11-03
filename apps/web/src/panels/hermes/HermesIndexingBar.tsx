import { RiLoader4Line, RiSpeedUpLine, RiTimeLine } from "@remixicon/react";
import type { HermesIndexingProgress } from "@/store";

export function HermesIndexingBar({ progress }: { progress: HermesIndexingProgress }) {
	if (!progress.isIndexing) return null;

	const formatMs = (ms: number) => {
		if (ms < 1000) return `${ms}ms`;
		const seconds = (ms / 1000).toFixed(1);
		return `${seconds}s`;
	};

	const filesPerSec =
		progress.elapsedMs > 0 && progress.processedFiles > 0
			? Math.round((progress.processedFiles / (progress.elapsedMs / 1000)) * 10) / 10
			: null;

	return (
		<div className="flex flex-col gap-8 rounded-lg border border-primary-muted bg-control-bg-hovered p-12 shadow-xs transition-all">
			<div className="flex flex-wrap items-center justify-between gap-8">
				<div className="flex items-center gap-8 min-w-0">
					<RiLoader4Line className="size-16 animate-spin text-primary shrink-0" />
					<div className="flex flex-col min-w-0">
						<span className="tr-text-emphasis text-text-default">
							Indexando Projeto Hermes: {progress.projectSlug}
						</span>
						{progress.currentFile ? (
							<span className="tr-text-metadata text-text-muted truncate max-w-sm">
								{progress.currentFile}
							</span>
						) : null}
					</div>
				</div>

				<div className="flex items-center gap-12 text-text-muted tr-text-metadata">
					{filesPerSec !== null ? (
						<div className="flex items-center gap-4">
							<RiSpeedUpLine className="size-14 text-primary" />
							<span>{filesPerSec} arq/s</span>
						</div>
					) : null}

					<div className="flex items-center gap-4">
						<RiTimeLine className="size-14 text-text-muted" />
						<span>Decorridos: {formatMs(progress.elapsedMs)}</span>
					</div>

					<div className="rounded-sm bg-control-bg px-6 py-2 tr-text-emphasis text-primary">
						{progress.percentage}%
					</div>
				</div>
			</div>

			{/* Barra de Progresso Minimalista */}
			<div className="relative h-6 w-full overflow-hidden rounded-full bg-border-default">
				<div
					className="h-full bg-primary transition-all duration-300 ease-out"
					style={{ width: `${progress.percentage}%` }}
				/>
			</div>

			{/* Predição de tempo restante */}
			<div className="flex items-center justify-between tr-text-metadata text-text-muted">
				<span>
					{progress.processedFiles} de {progress.totalFiles} arquivos processados (AST + FTS5 +
					Embeddings)
				</span>
				<span className="tr-text-emphasis text-text-default">
					{progress.estimatedRemainingMs !== null
						? progress.estimatedRemainingMs > 0
							? `~${formatMs(progress.estimatedRemainingMs)} restantes`
							: "Concluindo..."
						: "Calculando estimativa..."}
				</span>
			</div>
		</div>
	);
}
