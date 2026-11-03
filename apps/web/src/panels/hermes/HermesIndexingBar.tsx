import {
	RiCheckLine,
	RiFileCodeLine,
	RiLoader4Line,
	RiSpeedUpLine,
	RiTimeLine,
} from "@remixicon/react";
import type { HermesIndexingProgress } from "@/store";

export function HermesIndexingBar({ progress }: { progress: HermesIndexingProgress }) {
	const isVisible = progress.isIndexing || progress.status === "completed";
	if (!isVisible) return null;

	const formatMs = (ms: number) => {
		if (ms < 1000) return `${ms}ms`;
		const seconds = (ms / 1000).toFixed(1);
		return `${seconds}s`;
	};

	const isCompleted = progress.status === "completed" || (!progress.isIndexing && progress.percentage >= 100);

	const filesPerSec =
		progress.elapsedMs > 0 && progress.processedFiles > 0
			? Math.round((progress.processedFiles / (progress.elapsedMs / 1000)) * 10) / 10
			: null;

	return (
		<div className="flex flex-col gap-12 rounded-lg border border-border-default bg-container-workspace-bg p-16 shadow-xs transition-all">
			<div className="flex flex-wrap items-center justify-between gap-12">
				<div className="flex items-center gap-12 min-w-0">
					{isCompleted ? (
						<div className="flex size-24 items-center justify-center rounded-full bg-feedback-success text-text-on-primary shrink-0">
							<RiCheckLine className="size-16" />
						</div>
					) : (
						<RiLoader4Line className="size-20 animate-spin text-primary shrink-0" />
					)}
					<div className="flex flex-col min-w-0">
						<span className="tr-text-emphasis text-text-default">
							{isCompleted
								? `Reindexação Concluída: ${progress.projectSlug}`
								: `Indexando Projeto Hermes: ${progress.projectSlug || "..."}`}
						</span>
						{progress.currentFile ? (
							<span className="flex items-center gap-4 tr-text-metadata text-text-muted truncate max-w-md">
								<RiFileCodeLine className="size-14 shrink-0" />
								<span className="truncate tr-code-text">{progress.currentFile}</span>
							</span>
						) : null}
					</div>
				</div>

				<div className="flex items-center gap-12 text-text-muted tr-text-metadata">
					{filesPerSec !== null ? (
						<div className="flex items-center gap-4">
							<RiSpeedUpLine className="size-16 text-primary" />
							<span>{filesPerSec} arq/s</span>
						</div>
					) : null}

					<div className="flex items-center gap-4">
						<RiTimeLine className="size-16 text-text-muted" />
						<span>Decorridos: {formatMs(progress.elapsedMs)}</span>
					</div>

					<div
						className={`rounded px-6 py-2 tr-text-emphasis ${
							isCompleted
								? "bg-feedback-success text-text-on-primary"
								: "bg-control-bg text-primary"
						}`}
					>
						{progress.percentage}%
					</div>
				</div>
			</div>

			{/* Barra de Progresso com Animação Fluida */}
			<div className="relative h-8 w-full overflow-hidden rounded-full bg-border-default">
				<div
					className={`h-full transition-all duration-200 ease-out ${
						isCompleted ? "bg-feedback-success" : "bg-primary"
					}`}
					style={{ width: `${Math.max(2, Math.min(100, progress.percentage))}%` }}
				/>
			</div>

			{/* Predição de tempo restante e contadores */}
			<div className="flex items-center justify-between tr-text-metadata text-text-muted">
				<span>
					{progress.totalFiles > 0
						? `${progress.processedFiles.toLocaleString()} de ${progress.totalFiles.toLocaleString()} arquivos processados (AST + FTS5 + Embeddings)`
						: "Varrendo diretórios do projeto..."}
				</span>
				<span className="tr-text-emphasis text-text-default">
					{isCompleted
						? "Concluído!"
						: progress.estimatedRemainingMs !== null
							? progress.estimatedRemainingMs > 0
								? `~${formatMs(progress.estimatedRemainingMs)} restantes`
								: "Concluindo..."
							: "Calculando estimativa preditiva..."}
				</span>
			</div>
		</div>
	);
}
