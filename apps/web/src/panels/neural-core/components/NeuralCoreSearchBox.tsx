import type { HermesChunkItem, HermesVectorNode } from "@thinkrail/contracts";
import {
	RiArrowRightLine,
	RiCloseLine,
	RiDatabase2Line,
	RiNodeTree,
	RiRefreshLine,
	RiSearchLine,
} from "@remixicon/react";
import { useState } from "react";

export interface NeuralCoreSearchBoxProps {
	query: string;
	onQueryChange: (query: string) => void;
	isSearchingRemote: boolean;
	searchMatches: HermesVectorNode[];
	searchChunks: HermesChunkItem[];
	onSelectNode: (node: HermesVectorNode) => void;
	onSelectChunk: (chunk: HermesChunkItem) => void;
	getModuleClasses: (moduleName?: string) => { border: string; text: string; dot: string };
}

export function NeuralCoreSearchBox({
	query,
	onQueryChange,
	isSearchingRemote,
	searchMatches,
	searchChunks,
	onSelectNode,
	onSelectChunk,
	getModuleClasses,
}: NeuralCoreSearchBoxProps) {
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [searchDropdownTab, setSearchDropdownTab] = useState<"nodes" | "chunks">("nodes");

	return (
		<div className="relative flex-1 min-w-[240px] max-w-[420px]">
			{/* Input de Busca com Design Flutuante */}
			<div className="flex items-center gap-6 rounded border border-border-default bg-container-workspace-bg px-8 py-4 focus-within:border-primary transition-colors shadow-xs">
				<RiSearchLine className="size-14 text-text-muted shrink-0" />
				<input
					type="text"
					value={query}
					onChange={(e) => {
						onQueryChange(e.target.value);
						setIsSearchOpen(true);
					}}
					onFocus={() => setIsSearchOpen(true)}
					placeholder="Buscar classe, arquivo, método ou chunk..."
					className="bg-transparent tr-code-text text-text-default placeholder:text-text-muted outline-none w-full"
				/>
				{isSearchingRemote ? (
					<RiRefreshLine className="size-12 text-feedback-warning animate-spin shrink-0" />
				) : query ? (
					<button
						type="button"
						onClick={() => onQueryChange("")}
						className="text-text-muted hover:text-text-default p-2 cursor-pointer"
						aria-label="Limpar busca"
					>
						<RiCloseLine className="size-12" />
					</button>
				) : null}
			</div>

			{/* Dropdown de Resultados da Busca (Nós e Chunks com Abas) */}
			{isSearchOpen && query.trim().length >= 2 && (
				<div className="absolute bottom-full left-0 right-0 mb-4 max-h-[300px] overflow-hidden rounded-md border border-border-default bg-container-elevated-bg shadow-2xl z-50 flex flex-col backdrop-blur-md">
					{/* Abas do Dropdown */}
					<div className="flex items-center border-b border-border-default bg-container-workspace-bg px-6 py-4 gap-4 shrink-0">
						<button
							type="button"
							onClick={() => setSearchDropdownTab("nodes")}
							className={`flex items-center gap-4 px-8 py-2 rounded tr-code-text transition-colors cursor-pointer ${
								searchDropdownTab === "nodes"
									? "bg-primary text-text-on-primary shadow-xs tr-text-emphasis"
									: "text-text-muted hover:text-text-default hover:bg-control-bg"
							}`}
						>
							<RiNodeTree className="size-12" />
							<span>Polígonos ({searchMatches.length})</span>
						</button>

						<button
							type="button"
							onClick={() => setSearchDropdownTab("chunks")}
							className={`flex items-center gap-4 px-8 py-2 rounded tr-code-text transition-colors cursor-pointer ${
								searchDropdownTab === "chunks"
									? "bg-primary text-text-on-primary shadow-xs tr-text-emphasis"
									: "text-text-muted hover:text-text-default hover:bg-control-bg"
							}`}
						>
							<RiDatabase2Line className="size-12" />
							<span>Chunks RAG ({searchChunks.length})</span>
						</button>

						<button
							type="button"
							onClick={() => setIsSearchOpen(false)}
							className="ml-auto text-text-muted hover:text-text-default p-2 cursor-pointer"
							title="Fechar busca"
						>
							<RiCloseLine className="size-12" />
						</button>
					</div>

					{/* Área Scrollável de Resultados */}
					<div className="overflow-y-auto max-h-[240px] p-4 flex flex-col gap-2 min-h-0">
						{searchDropdownTab === "nodes" ? (
							searchMatches.length > 0 ? (
								searchMatches.map((n) => {
									const modStyle = getModuleClasses(n.module);
									return (
										<button
											type="button"
											key={n.id}
											onClick={() => {
												onSelectNode(n);
												setIsSearchOpen(false);
											}}
											className={`flex items-center justify-between rounded px-8 py-6 hover:bg-control-bg cursor-pointer transition-colors group border-l-2 text-left w-full ${modStyle.border}`}
										>
											<div className="flex flex-col min-w-0 flex-1 pr-6">
												<div className="flex items-center gap-4">
													<span className="tr-code-text text-text-default group-hover:text-primary tr-text-emphasis truncate">
														{n.qualifiedName || n.relPath}
													</span>
													{n.chunkKind && (
														<span className="rounded bg-control-bg px-4 py-2 tr-text-metadata text-text-muted uppercase shrink-0">
															{n.chunkKind}
														</span>
													)}
												</div>
												<div className="flex items-center gap-4 tr-text-metadata text-text-muted truncate mt-2">
													<span>{n.relPath}</span>
													{n.projectSlug && (
														<>
															<span>·</span>
															<span className="text-primary truncate">[{n.projectSlug}]</span>
														</>
													)}
													{n.methods && n.methods.length > 0 && (
														<>
															<span>·</span>
															<span>{n.methods.length} métodos</span>
														</>
													)}
												</div>
											</div>
											<RiArrowRightLine className="size-14 text-text-muted group-hover:text-primary shrink-0" />
										</button>
									);
								})
							) : (
								<span className="tr-text-metadata text-text-muted p-8 text-center">
									Nenhum polígono encontrado.
								</span>
							)
						) : searchChunks.length > 0 ? (
							searchChunks.map((chunk) => (
								<button
									type="button"
									key={chunk.id}
									onClick={() => {
										onSelectChunk(chunk);
										setIsSearchOpen(false);
									}}
									className="flex flex-col gap-2 rounded border border-border-default bg-container-workspace-bg p-6 hover:border-primary cursor-pointer transition-colors text-left w-full"
								>
									<div className="flex items-center justify-between gap-4">
										<span className="tr-code-text text-primary tr-text-emphasis truncate">
											{chunk.qualifiedName || chunk.relPath}
										</span>
										<span className="rounded bg-control-bg px-4 py-2 tr-text-metadata text-text-muted uppercase shrink-0">
											{chunk.chunkKind}
										</span>
									</div>
									{chunk.signature && (
										<span className="tr-code-text text-text-muted truncate">{chunk.signature}</span>
									)}
									<div className="flex items-center gap-6 tr-text-metadata text-text-muted">
										<span>
											L{chunk.startLine || 1} - L{chunk.endLine || "?"}
										</span>
										<span>·</span>
										<span>~{chunk.tokenEstimate || 0} tokens</span>
									</div>
								</button>
							))
						) : (
							<span className="tr-text-metadata text-text-muted p-8 text-center">
								Nenhum chunk encontrado para a busca.
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
