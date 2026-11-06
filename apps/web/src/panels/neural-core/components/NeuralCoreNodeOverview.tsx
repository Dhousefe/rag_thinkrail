import type { HermesVectorNode } from "@thinkrail/contracts";
import { RiNodeTree } from "@remixicon/react";

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
	return (
		<div className="flex flex-col gap-8 min-h-0">
			{/* Vizinhos Conectados 1-Hop */}
			{activeNeighbors.length > 0 && (
				<div className="flex items-center gap-8 overflow-x-auto py-2 no-scrollbar border-b border-border-default pb-6 shrink-0">
					<span className="tr-text-metadata text-text-muted shrink-0 select-none flex items-center gap-4">
						<RiNodeTree className="size-12 text-primary" />
						Vizinhos Conectados ({activeNeighbors.length}):
					</span>
					<div className="flex items-center gap-4">
						{activeNeighbors.map((nb) => {
							const nbStyle = getModuleClasses(nb.module);
							return (
								<button
									key={nb.id}
									type="button"
									onClick={() => onFocusNeighbor(nb)}
									className={`flex items-center gap-4 rounded border border-border-default bg-container-workspace-bg px-6 py-2 tr-code-text text-text-default hover:border-primary shrink-0 transition-colors border-l-2 ${nbStyle.border} cursor-pointer`}
									title={`Focar em ${nb.qualifiedName || nb.relPath}`}
								>
									<span>{nb.qualifiedName || nb.relPath}</span>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Sub-Órbitas: Métodos e Funções Filhos da Classe */}
			{activeNode.methods && activeNode.methods.length > 0 && (
				<div className="flex items-center gap-8 overflow-x-auto py-2 no-scrollbar shrink-0">
					<span className="tr-text-metadata text-text-muted shrink-0 select-none">
						Sub-Órbitas ({activeNode.methods.length}):
					</span>
					<div className="flex items-center gap-4">
						{activeNode.methods.map((m) => (
							<button
								type="button"
								key={m.id || m.name}
								className="rounded bg-container-workspace-bg border border-border-default px-6 py-2 tr-code-text text-text-default hover:border-primary cursor-pointer shrink-0 transition-colors"
								title={m.signature || m.name}
								onClick={() => onSelectMethodQuery(m.name)}
							>
								• {m.name}()
							</button>
						))}
					</div>
				</div>
			)}

			{/* Snippet de Código com Scroll Interno Ajustado */}
			{activeNode.contentSnippet && (
				<div className="flex flex-col gap-4 min-h-0 flex-1">
					<span className="tr-text-metadata text-text-muted select-none">
						Amostra de Código Extraída:
					</span>
					<div className="max-h-[160px] overflow-y-auto rounded bg-container-workspace-bg p-8 border border-border-default select-text">
						<pre className="tr-code-text text-text-muted whitespace-pre-wrap leading-relaxed">
							{activeNode.contentSnippet}
						</pre>
					</div>
				</div>
			)}
		</div>
	);
}
