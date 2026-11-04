import { RiDatabase2Line, RiLoader4Line } from "@remixicon/react";
import { useCallback, useEffect, useRef } from "react";
import { toast, useAppStore } from "../store";
import { getTransport } from "../transport";

export function useHermesIndexingSync() {
	const indexingProgress = useAppStore((s) => s.hermesManagement.indexingProgress);
	const setHermesIndexingProgress = useAppStore((s) => s.setHermesIndexingProgress);
	const finishHermesIndexing = useAppStore((s) => s.finishHermesIndexing);
	const wasIndexingRef = useRef(false);

	const poll = useCallback(async () => {
		try {
			const progress = await getTransport().request("hermes.getIndexingProgress", {});
			if (!progress) return;

			setHermesIndexingProgress(progress);

			const justFinished =
				wasIndexingRef.current &&
				(!progress.isIndexing || progress.status === "completed" || progress.percentage >= 100);

			if (justFinished && progress.projectSlug) {
				finishHermesIndexing(progress.projectSlug);
				toast.success(
					`Projeto [${progress.projectSlug}] indexado com sucesso no Hermes RAG (${progress.totalFiles} arquivos).`,
					"Hermes RAG Indexado",
				);
			}

			wasIndexingRef.current = Boolean(progress.isIndexing);
		} catch {}
	}, [setHermesIndexingProgress, finishHermesIndexing]);

	useEffect(() => {
		const intervalMs = indexingProgress.isIndexing ? 500 : 3500;
		const timer = setInterval(() => {
			void poll();
		}, intervalMs);
		return () => clearInterval(timer);
	}, [indexingProgress.isIndexing, poll]);
}

export function HermesIndexingTopbarIndicator() {
	const indexingProgress = useAppStore((s) => s.hermesManagement.indexingProgress);

	if (
		!indexingProgress.isIndexing &&
		indexingProgress.status !== "indexing" &&
		indexingProgress.status !== "scanning"
	) {
		return null;
	}

	const {
		percentage = 0,
		processedFiles = 0,
		totalFiles = 0,
		projectSlug,
		currentFile,
		status,
	} = indexingProgress;
	const isScanning = status === "scanning" || totalFiles === 0;

	return (
		<div
			data-testid="hermes-indexing-topbar"
			className="inline-flex items-center gap-8 rounded-full border border-border-default bg-control-bg px-8 py-2 tr-text-metadata text-text-default shadow-xs transition-all hover:bg-control-bg-hovered"
			title={currentFile ? `Indexando: ${currentFile}` : "Indexação Hermes RAG em andamento"}
		>
			<div className="relative flex items-center justify-center">
				<RiLoader4Line className="size-14 animate-spin text-primary" />
				<RiDatabase2Line className="absolute size-8 text-primary" />
			</div>

			<span className="tr-text-emphasis text-primary">Hermes RAG:</span>

			<span className="max-w-100 truncate text-text-muted" title={projectSlug ?? undefined}>
				{projectSlug ?? "projeto"}
			</span>

			{isScanning ? (
				<span className="animate-pulse text-text-muted">Varrendo arquivos...</span>
			) : (
				<div className="flex items-center gap-6">
					<div className="h-5 w-40 overflow-hidden rounded-full bg-border-muted">
						<div
							className="h-full bg-primary transition-all duration-300 ease-out"
							style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
						/>
					</div>
					<span className="tabular-nums text-text-muted">
						{percentage}% ({processedFiles}/{totalFiles})
					</span>
				</div>
			)}
		</div>
	);
}
