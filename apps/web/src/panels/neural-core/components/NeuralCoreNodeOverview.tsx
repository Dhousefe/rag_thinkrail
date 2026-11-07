import type { HermesVectorNode } from "@thinkrail/contracts";
import {
	RiFileCopyLine,
	RiFunctionLine,
	RiNodeTree,
} from "@remixicon/react";
import { toast } from "@/store";

export interface NeuralCoreNodeOverviewProps {
	activeNode: HermesVectorNode;
	activeNeighbors: HermesVectorNode[];
	onFocusNeighbor: (neighbor: HermesVectorNode) => void;
	onSelectMethodQuery: (methodName: string) => void;
	getModuleClasses: (moduleName?: string) => { border: string; text: string; dot: string };
}

export function NeuralCoreNodeOverview({
	activeNode,
	activeNeighbors,
	onFocusNeighbor,
	onSelectMethodQuery,
	getModuleClasses,
}: NeuralCoreNodeOverviewProps) {
	const handleCopySnippet = () => {
		if (activeNode.contentSnippet) {
			void navigator.clipboard.writeText(activeNode.contentSnippet);
			toast.success("Snippet copiado", activeNode.qualifiedName || activeNode.relPath);
		}
	};

	return (
		<div className="flex flex-col gap-6 min-h-0">
			{/* Vizinhos Conectados 1-Hop com badges de módulo */}
			{activeNeighbors.length > 0 && (
				<div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-2 border-b border-border-default pb-4 shrink-0">
					<span className="tr-text-metadata text-text-muted shrink-0 select-none flex items-center gap-4">
						<RiNodeTree className="size-12 text-primary" />
						Vizinhos Conectados ({activeNeighbors.length}):
					</span>
					<div className="flex flex-wrap items-center gap-4 min-w-0">
						{activeNeighbors.map((nb) => {
							const nbStyle = getModuleClasses(nb.module);
							return (
								<button
									key={nb.id}
									type="button"
									onClick={() => onFocusNeighbor(nb)}
									className={`flex items-center gap-4 rounded-md border border-border-default bg-container-workspace-bg px-6 py-2 tr-code-text text-text-default hover:border-primary shrink-0 transition-colors border-l-2 ${nbStyle.border} cursor-pointer shadow-xs`}
									title={`Focar em ${nb.qualifiedName || nb.relPath}`}
								>
									<span>{nb.qualifiedName || nb.relPath}</span>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Sub-Órbitas: Métodos, Funções e Símbolos Filhos */}
			{activeNode.methods && activeNode.methods.length > 0 && (
				<div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 py-2 border-b border-border-default pb-4 shrink-0">
					<span className="tr-text-metadata text-text-muted shrink-0 select-none flex items-center gap-4">
						<RiFunctionLine className="size-12 text-feedback-info" />
						Métodos & Funções ({activeNode.methods.length}):
					</span>
					<div className="flex flex-wrap items-center gap-4 min-w-0">
						{activeNode.methods.map((m) => (
							<button
								type="button"
								key={m.id || m.name}
								className="flex items-center gap-2 rounded-md bg-container-workspace-bg border border-border-default px-6 py-2 tr-code-text text-text-default hover:border-primary hover:text-primary cursor-pointer shrink-0 transition-colors shadow-xs"
								title={`${m.signature || m.name} (~${m.tokenEstimate || 0} tokens)`}
								onClick={() => onSelectMethodQuery(m.name)}
							>
								<span className="tr-text-emphasis">{m.name}()</span>
								{(m.tokenEstimate ?? 0) > 0 && (
									<span className="tr-text-metadata text-text-muted">
										~{m.tokenEstimate}t
									</span>
								)}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Snippet de Código com Cópia Rápida e Scroll Suave */}
			{activeNode.contentSnippet && (
				<div className="flex flex-col gap-4 min-h-0 flex-1">
					<div className="flex items-center justify-between gap-4">
						<span className="tr-text-metadata text-text-muted select-none">
							Amostra de Código Extraída:
						</span>
						<button
							type="button"
							onClick={handleCopySnippet}
							className="flex items-center gap-2 text-text-muted hover:text-primary tr-text-metadata transition-colors cursor-pointer"
							title="Copiar código amostra"
						>
							<RiFileCopyLine className="size-12" />
							<span>Copiar</span>
						</button>
					</div>
					<div className="max-h-[160px] overflow-y-auto rounded-lg bg-container-workspace-bg p-8 border border-border-default select-text shadow-xs">
						<pre className="tr-code-text text-text-muted whitespace-pre-wrap leading-relaxed">
							{activeNode.contentSnippet}
						</pre>
					</div>
				</div>
			)}
		</div>
	);
}

