import {
	type RemixiconComponentType,
	RiArrowRightLine,
	RiCloseLine,
	RiCodeSSlashLine,
	RiDatabase2Line,
	RiFileCodeLine,
	RiFunctionLine,
	RiInputField,
	RiNodeTree,
	RiRefreshLine,
	RiSearchLine,
} from "@remixicon/react";
import type { HermesChunkItem, HermesVectorNode } from "@thinkrail/contracts";
import { useEffect, useMemo, useRef, useState } from "react";

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

type SymbolCategoryFilter = "all" | "class" | "function" | "variable" | "type";

function getSymbolKindBadge(kind?: string): {
	label: string;
	color: string;
	icon: RemixiconComponentType;
} {
	const k = (kind || "").toLowerCase();
	if (k.includes("class") || k.includes("struct") || k.includes("impl")) {
		return { label: "class", color: "bg-primary text-text-on-primary", icon: RiNodeTree };
	}
	if (k.includes("func") || k.includes("method") || k.includes("handler")) {
		return {
			label: "fn",
			color: "bg-feedback-info text-container-workspace-bg",
			icon: RiFunctionLine,
		};
	}
	if (k.includes("const") || k.includes("var") || k.includes("let") || k.includes("field")) {
		return {
			label: "var",
			color: "bg-feedback-warning text-container-workspace-bg",
			icon: RiInputField,
		};
	}
	if (k.includes("type") || k.includes("interface") || k.includes("enum")) {
		return {
			label: "type",
			color: "bg-feedback-success text-container-workspace-bg",
			icon: RiCodeSSlashLine,
		};
	}
	return { label: "file", color: "bg-control-bg text-text-muted", icon: RiFileCodeLine };
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
	const [categoryFilter, setCategoryFilter] = useState<SymbolCategoryFilter>("all");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listContainerRef = useRef<HTMLDivElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);

	// Fecha o dropdown se o usuário clicar fora do componente
	useEffect(() => {
		if (!isSearchOpen) return;
		const handleClickOutside = (e: MouseEvent | TouchEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsSearchOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isSearchOpen]);

	// Filtra itens com base na faceta selecionada
	const filteredNodes = useMemo(() => {
		if (categoryFilter === "all") return searchMatches;
		return searchMatches.filter((n) => {
			const k = (n.chunkKind || "").toLowerCase();
			if (categoryFilter === "class") {
				return (
					k.includes("class") || k.includes("struct") || k.includes("impl") || k.includes("model")
				);
			}
			if (categoryFilter === "function") {
				return (
					k.includes("func") ||
					k.includes("method") ||
					k.includes("handler") ||
					k.includes("action") ||
					(n.methods && n.methods.length > 0)
				);
			}
			if (categoryFilter === "variable") {
				return (
					k.includes("const") ||
					k.includes("var") ||
					k.includes("field") ||
					k.includes("prop") ||
					k.includes("state")
				);
			}
			if (categoryFilter === "type") {
				return (
					k.includes("type") ||
					k.includes("interface") ||
					k.includes("enum") ||
					k.includes("schema")
				);
			}
			return true;
		});
	}, [searchMatches, categoryFilter]);

	const filteredChunks = useMemo(() => {
		if (categoryFilter === "all") return searchChunks;
		return searchChunks.filter((c) => {
			const k = (c.chunkKind || "").toLowerCase();
			if (categoryFilter === "class") return k.includes("class") || k.includes("struct");
			if (categoryFilter === "function") return k.includes("func") || k.includes("method");
			if (categoryFilter === "variable")
				return k.includes("const") || k.includes("var") || k.includes("field");
			if (categoryFilter === "type")
				return k.includes("type") || k.includes("interface") || k.includes("enum");
			return true;
		});
	}, [searchChunks, categoryFilter]);

	// Reseta índice ao alterar busca
	useEffect(() => {
		setSelectedIndex(0);
	}, [query, categoryFilter, searchDropdownTab]);

	// Navegação por teclado: ArrowUp, ArrowDown, Enter e Escape
	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (!isSearchOpen) {
			if (e.key === "ArrowDown" || e.key === "Enter") {
				setIsSearchOpen(true);
			}
			return;
		}

		const totalItems = searchDropdownTab === "nodes" ? filteredNodes.length : filteredChunks.length;
		if (totalItems === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((prev) => (prev + 1) % totalItems);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (searchDropdownTab === "nodes") {
				const item = filteredNodes[selectedIndex];
				if (item) {
					onSelectNode(item);
					setIsSearchOpen(false);
				}
			} else {
				const chunk = filteredChunks[selectedIndex];
				if (chunk) {
					onSelectChunk(chunk);
					setIsSearchOpen(false);
				}
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			setIsSearchOpen(false);
		}
	};

	return (
		<div ref={containerRef} className="relative flex-1 min-w-[260px] max-w-[460px]">
			{/* Input de Busca com Design Flutuante e Indicador Visual */}
			<div className="flex items-center gap-6 rounded-md border border-border-default bg-container-workspace-bg px-8 py-4 focus-within:border-primary transition-colors shadow-xs">
				<RiSearchLine className="size-14 text-text-muted shrink-0" />
				<input
					type="text"
					value={query}
					onChange={(e) => {
						onQueryChange(e.target.value);
						setIsSearchOpen(true);
					}}
					onFocus={() => setIsSearchOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder="Buscar classe, método, variável, constante ou chunk..."
					className="bg-transparent tr-code-text text-text-default placeholder:text-text-muted outline-none w-full"
				/>
				{isSearchingRemote ? (
					<RiRefreshLine className="size-12 text-feedback-warning animate-spin shrink-0" />
				) : query ? (
					<button
						type="button"
						onClick={() => onQueryChange("")}
						className="text-text-muted hover:text-text-default p-2 cursor-pointer rounded"
						aria-label="Limpar busca"
					>
						<RiCloseLine className="size-12" />
					</button>
				) : null}
			</div>

			{/* Dropdown Inteligente de Resultados da Busca com Abas e Filtros de Pílulas */}
			{isSearchOpen && query.trim().length >= 1 && (
				<div className="absolute bottom-full left-0 mb-4 w-full min-w-[340px] sm:min-w-[480px] max-w-[580px] max-h-[380px] overflow-hidden rounded-lg border border-border-default bg-container-elevated-bg shadow-2xl z-50 flex flex-col backdrop-blur-md">
					{/* Abas Superiores e Botão Fechar */}
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
							<span>Polígonos ({filteredNodes.length})</span>
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
							<span>Chunks RAG ({filteredChunks.length})</span>
						</button>

						<button
							type="button"
							onClick={() => setIsSearchOpen(false)}
							className="ml-auto text-text-muted hover:text-text-default p-2 cursor-pointer rounded"
							title="Fechar busca"
						>
							<RiCloseLine className="size-12" />
						</button>
					</div>

					{/* Barra de Filtros Rápidos por Facetas Semânticas (UI/UX Pro Max) */}
					<div className="flex items-center gap-4 px-6 py-2 border-b border-border-default bg-container-elevated-bg overflow-x-auto shrink-0 select-none">
						{(
							[
								{ id: "all", label: "Todos" },
								{ id: "class", label: "Classes" },
								{ id: "function", label: "Funções / Métodos" },
								{ id: "variable", label: "Variáveis / Const" },
								{ id: "type", label: "Types / Interfaces" },
							] as const
						).map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setCategoryFilter(tab.id)}
								className={`px-6 py-2 rounded tr-text-metadata transition-colors cursor-pointer shrink-0 ${
									categoryFilter === tab.id
										? "bg-control-bg text-primary border border-primary tr-text-emphasis"
										: "text-text-muted hover:text-text-default hover:bg-control-bg"
								}`}
							>
								{tab.label}
							</button>
						))}
					</div>

					{/* Área Scrollável de Resultados com Navegação por Teclado e Badges Semânticas */}
					<div
						ref={listContainerRef}
						className="overflow-y-auto max-h-[290px] p-4 flex flex-col gap-2 min-h-0"
					>
						{searchDropdownTab === "nodes" ? (
							filteredNodes.length > 0 ? (
								filteredNodes.map((n, idx) => {
									const modStyle = getModuleClasses(n.module);
									const badge = getSymbolKindBadge(n.chunkKind);
									const IconComp = badge.icon;
									const isCurrent = idx === selectedIndex;
									const qLower = query.toLowerCase().trim();
									const matchedMethods = (n.methods || []).filter(
										(m) =>
											m.name.toLowerCase().includes(qLower) ||
											(m.signature && m.signature.toLowerCase().includes(qLower)),
									);
									return (
										<button
											type="button"
											key={n.id}
											onClick={() => {
												onSelectNode(n);
												setIsSearchOpen(false);
											}}
											className={`flex items-center justify-between rounded px-8 py-6 cursor-pointer transition-colors group border-l-2 text-left w-full ${
												isCurrent
													? "bg-control-bg border-l-primary ring-1 ring-primary"
													: `hover:bg-control-bg ${modStyle.border}`
											}`}
										>
											<div className="flex flex-col min-w-0 flex-1 pr-6">
												<div className="flex items-center gap-4">
													<span
														className={`flex items-center gap-2 rounded px-4 py-2 tr-text-caption uppercase ${badge.color}`}
													>
														<IconComp className="size-10" />
														{badge.label}
													</span>
													<span className="tr-code-text text-text-default group-hover:text-primary tr-text-emphasis truncate">
														{n.qualifiedName || n.relPath}
													</span>
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
												{matchedMethods.length > 0 && (
													<div className="flex flex-wrap items-center gap-2 mt-2">
														{matchedMethods.slice(0, 3).map((m) => (
															<span
																key={m.id || m.name}
																className="px-4 py-2 rounded tr-code-text tr-text-caption bg-container-workspace-bg border border-feedback-info text-feedback-info"
															>
																{m.name}()
															</span>
														))}
														{matchedMethods.length > 3 && (
															<span className="tr-text-caption text-text-muted">
																+{matchedMethods.length - 3} mais
															</span>
														)}
													</div>
												)}
											</div>
											<RiArrowRightLine className="size-14 text-text-muted group-hover:text-primary shrink-0" />
										</button>
									);
								})
							) : (
								<div className="p-8 text-center flex flex-col items-center gap-4">
									<span className="tr-text-metadata text-text-muted">
										Nenhum polígono encontrado para este filtro.
									</span>
									{filteredChunks.length > 0 && (
										<button
											type="button"
											onClick={() => setSearchDropdownTab("chunks")}
											className="text-primary hover:underline tr-text-metadata cursor-pointer flex items-center gap-2"
										>
											<RiDatabase2Line className="size-12" />
											<span>Ver {filteredChunks.length} chunks RAG correspondentes</span>
										</button>
									)}
								</div>
							)
						) : filteredChunks.length > 0 ? (
							filteredChunks.map((chunk, idx) => {
								const badge = getSymbolKindBadge(chunk.chunkKind);
								const IconComp = badge.icon;
								const isCurrent = idx === selectedIndex;
								return (
									<button
										type="button"
										key={chunk.id}
										onClick={() => {
											onSelectChunk(chunk);
											setIsSearchOpen(false);
										}}
										className={`flex flex-col gap-2 rounded border bg-container-workspace-bg p-6 cursor-pointer transition-colors text-left w-full ${
											isCurrent
												? "border-primary ring-1 ring-primary bg-control-bg"
												: "border-border-default hover:border-primary"
										}`}
									>
										<div className="flex items-center justify-between gap-4">
											<div className="flex items-center gap-4 min-w-0">
												<span
													className={`flex items-center gap-2 rounded px-4 py-2 tr-text-caption uppercase ${badge.color}`}
												>
													<IconComp className="size-10" />
													{badge.label}
												</span>
												<span className="tr-code-text text-primary tr-text-emphasis truncate">
													{chunk.qualifiedName || chunk.relPath}
												</span>
											</div>
											<span className="tr-text-metadata text-text-muted shrink-0">
												L{chunk.startLine || 1}-{chunk.endLine || "?"}
											</span>
										</div>
										{chunk.signature && (
											<span className="tr-code-text text-text-muted truncate bg-container-elevated-bg p-2 rounded">
												{chunk.signature}
											</span>
										)}
									</button>
								);
							})
						) : (
							<span className="tr-text-metadata text-text-muted p-8 text-center">
								Nenhum chunk encontrado para este filtro.
							</span>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
